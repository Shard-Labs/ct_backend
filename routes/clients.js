const express = require('express');
const router = express.Router();
const models = require('../models');
const _ = require('lodash');
const Joi = require('@hapi/joi');
const isClient = require('../middleware/isClient.js');
const storage = require('../lib/storage.js');

/**
 * Create new client user
 */
router.post('/', async (req, res) => {
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
router.put('/', isClient, async (req, res) => {
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

    if (clientData.avatar) {
      await user.client.setAvatar(clientData.avatar.id, { transaction });
    } else {
      await user.client.removeAvatar({ transaction });
    }

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
 * Get clients avatar signed URL from amazon S3
 */
router.get('/:clientId/avatar', async (req, res) => {
  const clientId = req.params.clientId;

  const client = await models.Client.findByPk(clientId, {
    include: [
      { model: models.File, as: 'avatar' }
    ]
  });

  if (client.avatar) {
    try {
      const key = client.avatar.fileName;
      const params = { Bucket: config.get('storage.privateBucket'), Key: key };
      const url = await storage.getSignedUrl('getObject', params);

      return res.json({
        success: true,
        data: url,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Something went wrong',
        data: err.message
      });
    }
  }

  return res.status(404).json({
    success: false,
    message: 'Avatar not found',
  });
});

module.exports = router;
