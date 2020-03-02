const express = require('express');
const router = express.Router();
const models = require('../models');
const _ = require('lodash');
const Joi = require('@hapi/joi');
const isClient = require('../middleware/isClient.js');
const jwt = require('../middleware/jwt');

/**
 * Create new client user
 */
router.post('/', jwt.checkToken, async (req, res) => {
  const user = req.decoded;

  // validation
  const schema = Joi.object().keys({
    name: Joi.string().required(),
    location: Joi.string().optional().allow(null),
    about: Joi.string().optional().allow(null),
    avatar: Joi.object().keys({
      id: Joi.number().integer().required(),
    }).optional().allow(null),
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

  if (user.client) {
    return res.status(400).json({
      success: false,
      message: 'User already has client profile',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const clientData = req.body;

    // create client record
    const client = await models.Client.create({
      ...clientData,
      userId: user.id
    }, {
      transaction,
    });

    if (clientData.avatar) {
      await client.setAvatar(clientData.avatar.id, { transaction });
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Client successfully created',
      data: client,
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * Update client basic profile
 */
router.put('/', jwt.checkToken, isClient, async (req, res) => {
  const user = req.decoded;

  // validation
  const schema = Joi.object().keys({
    name: Joi.string().required(),
    location: Joi.string().optional().allow(null),
    about: Joi.string().optional().allow(null),
    avatar: Joi.object().keys({
      id: Joi.number().integer().required(),
    }).optional().allow(null),
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

  if (!user.client) {
    return res.status(400).json({
      success: false,
      message: 'User has no client profile',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const clientData = _.omit(req.body, ['id', 'userId']);

    // update client record
    const data = await user.client.update(clientData, { transaction });

    await user.client.setAvatar(clientData.avatar ? clientData.avatar.id : null, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Client successfully updated',
      data,
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * Get all client tasks
 */
router.get('/:id/tasks', async (req, res) => {
  const id = req.params.id;

  try {
    const tasks = await models.Task.findAll({
      where: {
        postedBy: id,
      },
      order: [
        ['createdAt', 'DESC'],
      ],
    });

    return res.json({
      success: true,
      data: tasks
    });
  } catch (err) {
    console.error(err);

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
    });
  }
});

/**
 * Get all client feedbacks
 */
router.get('/:id/feedbacks', async (req, res) => {
  const id = req.params.id;

  try {
    const feedbacks = await models.Feedback.findAll({
      where: {
        clientId: id,
      },
      include: [
        { model: models.Freelancer, as: 'freelancer' },
        {
          model: models.Application, as: 'application', attributes: ['id', 'taskId'], include: [
            { model: models.Task, as: 'task' },
          ]
        },
      ]
    });

    return res.json({
      success: true,
      data: feedbacks
    });
  } catch (err) {
    console.error(err);

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
    });
  }
});

/**
 * Calculate average client rate
 */
router.get('/:id/rate', async (req, res) => {
  const id = req.params.id;

  const data = await models.Feedback.findAll({
    where: {
      clientId: id,
    },
  });

  let totalRate = 0;
  let countItems = 0;

  data.forEach(f => {
    if (f.freelancerRate) {
      countItems++;
      totalRate += f.freelancerRate;
    }
  });

  return res.json({
    success: true,
    data: {
      rate: countItems > 0 ? parseFloat((totalRate / countItems).toFixed(1)) : 0,
      count: countItems,
    },
  });
});

/**
 * Get client data
 */
router.get('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const client = await models.Client.findByPk(id, {
      include: [
        { model: models.File, as: 'avatar' },
      ]
    });

    return res.json({
      success: true,
      data: client
    });
  } catch (err) {
    console.error(err);

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
    });
  }
});

module.exports = router;
