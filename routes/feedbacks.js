const express = require('express');
const router = express.Router();
const models = require('../models');
const Joi = require('@hapi/joi');
const constants = require('../lib/constants.js');
const moment = require('moment');
const config = require('config');
const FeedbackChecker = require('../lib/FeedbackChecker.js');

/**
 * Get feedback for application
 */
router.get('/:applicationId', async (req, res) => {
  const user = req.decoded;

  if (user.activeRoleId) {
    const feedback = await models.Feedback.findOne({
      where: {
        applicationId: req.params.applicationId,
      }
    });

    const date = moment(feedback.createdAt);
    const diff = moment().diff(date, 'days');

    if ((!feedback.clientFeedback || !feedback.freelancerFeedback) && diff < config.get('feedbackVisibleAfter')) {
      return res.json({
        success: true,
        data: {
          createdAt: feedback.createdAt,
        },
      });
    }

    return res.json({
      success: true,
      data: feedback,
    });
  }
});

/**
 * Create new feedback and finish application
 */
router.post('/', async (req, res) => {
  const user = req.decoded;

  // validation
  const schema = Joi.object().keys({
    applicationId: Joi.number().integer().required(),
    rate: Joi.number().integer().required(),
    message: Joi.string().required(),
    status: Joi.number().integer().required(),
  });

  const validation = Joi.validate(req.body, schema, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      data: validation.error
    });
  }

  const application = await models.Application.findByPk(req.body.applicationId);

  if (!application) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  // try to find existing feedback for application
  let feedback = await models.Feedback.findOne({
    where: {
      applicationId: req.body.applicationId,
    }
  });

  // check if feedback already exists and if its visible by date
  if (feedback && FeedbackChecker.isVisible(feedback.createdAt)) {
    return res.status(401).json({
      success: false,
      message: 'Feedback too old to update!',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    if (user.activeRoleId === constants.roles.FREELANCER) {
      if (feedback && feedback.freelancerRate) {
        if (transaction) await transaction.rollback();

        return res.status(400).json({
          success: false,
          message: 'Freelancer already set feedback',
        });
      }

      if (!feedback) {
        feedback = await models.Feedback.create({
          applicationId: req.body.applicationId,
          freelancerId: user.freelancer.id,
          freelancerRate: req.body.rate,
          freelancerFeedback: req.body.message,
          freelancerCreatedAt: new Date(),
          clientId: application.clientId,
        }, { transaction });
      } else {
        feedback.freelancerRate = req.body.rate;
        feedback.freelancerFeedback = req.body.message;
        feedback.freelancerCreatedAt = new Date();
        await feedback.save({ transaction });
      }
    } else if (user.activeRoleId === constants.roles.CLIENT) {
      if (feedback && feedback.clientRate) {
        if (transaction) await transaction.rollback();

        return res.status(400).json({
          success: false,
          message: 'Client already set feedback',
        });
      }

      if (!feedback) {
        feedback = await models.Feedback.create({
          applicationId: req.body.applicationId,
          clientId: user.client.id,
          clientRate: req.body.rate,
          clientFeedback: req.body.message,
          clientCreatedAt: new Date(),
          freelancerId: application.freelancerId,
        }, { transaction });
      } else {
        feedback.clientRate = req.body.rate;
        feedback.clientFeedback = req.body.message;
        feedback.clientCreatedAt = new Date();
        await feedback.save({ transaction });
      }
    }

    // set application status to finished or canceled
    application.status = req.body.status;
    await application.save({ transaction });

    await transaction.commit();

    return res.json({
      success: true,
      data: feedback,
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;
