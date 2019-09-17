const express = require('express');
const router = express.Router();
const models = require('../models');
const _ = require('lodash');
const Joi = require('@hapi/joi');

/**
 * Create new client user
 */
router.post('/', async (req, res) => {
  const userId = req.decoded.id;

  // validation
  const schema = Joi.object().keys({
    name: Joi.string().required(),
    location: Joi.string().optional(),
    pictureId: Joi.number().optional(),
    about: Joi.string().optional(),
  });

  const validation = Joi.validate(req.body, schema, {
    abortEarly: false
  });

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      data: validation.error
    });
  }

  // check if client profile already exists for current user
  let exists = await models.Client.findOne({
    where: {
      userId,
    },
  });

  if (exists) {
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
    const data = await models.Client.create({
      ...clientData,
      userId
    }, {
      transaction,
    });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Client successfully created',
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
 * Update client basic profile
 */
router.put('/', async (req, res) => {
  const userId = req.decoded.id;

  // validation
  const schema = Joi.object().keys({
    id: Joi.number().optional(),
    userId: Joi.number().optional(),
    name: Joi.string().required(),
    location: Joi.string().optional(),
    pictureId: Joi.number().optional(),
    about: Joi.string().optional(),
  });

  const validation = Joi.validate(req.body, schema, {
    abortEarly: false
  });

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      data: validation.error
    });
  }

  // check if client profile already exists for current user
  const client = await models.Client.findOne({
    where: {
      userId,
    },
  });

  if (!client) {
    return res.status(400).json({
      success: false,
      message: 'User has no client profile',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const clientData = req.body;

    // update client record
    const data = await client.update(clientData, { transaction, });

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

module.exports = router;
