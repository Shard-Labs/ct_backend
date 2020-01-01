const express = require('express');
const router = express.Router();
const models = require('../models');
const isClient = require('../middleware/isClient.js');
const isFreelancer = require('../middleware/isFreelancer.js');
const Joi = require('@hapi/joi');
const constants = require('../lib/constants.js');

/**
 * Create new feedback for client and finish application
 */
router.post('/client', isClient, async (req, res) => {
  const user = req.decoded;

  // validation
  const schema = Joi.object().keys({
    applicationId: Joi.integer().required(),
    rate: Joi.integer().required(),
    message: Joi.string().required(),
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

  if (!application || application.clientId !== user.client.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  const exists = await models.Feedback.findOne({
    where: {
      applicationId: req.body.applicationId,
      clientId: req.body.clientId,
    }
  });

  if (exists) {
    return res.status(400).json({
      success: false,
      message: 'Feedback already exists',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    // create new feedback record
    await models.Feedback.create({
      applicationId: req.body.applicationId,
      clientId: user.client.id,
      clientRate: req.body.rate,
      clientFeedback: req.body.message
    }, { transaction });

    // set application status to finished
    application.status = constants.applicationStatuses.FINISHED;
    await application.save({ transaction });

    return res.json({
      success: true,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * Create new feedback for client
 */
router.post('/freelancer', isFreelancer, async (req, res) => {
  const user = req.decoded;

  // validation
  const schema = Joi.object().keys({
    applicationId: Joi.integer().required(),
    rate: Joi.integer().required(),
    message: Joi.string().required(),
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

  if (!application || application.freelancerId !== user.freelancer.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  const feedback = await models.Feedback.findOne({
    where: {
      applicationId: req.body.applicationId,
      freelancerId: req.body.freelancerId,
    }
  });

  if (!feedback || feedback.freelancerRate) {
    return res.status(400).json({
      success: false,
      message: 'Feedback already exists',
    });
  }

  try {
    feedback.freelancerRate = req.body.rate;
    feedback.freelancerFeedback = req.body.message;
    feedback.freelancerCreatedAt = new Date();

    await feedback.save();

    return res.json({
      success: true,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

module.exports = router;
