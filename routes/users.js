const express = require('express');
const router = express.Router();
const models = require('../models');
const Joi = require('@hapi/joi');
const bcrypt = require('bcrypt');
const saltRounds = 10;

/**
 * Get current user data
 */
router.get('/me', async (req, res) => {
  return res.json({
    success: true,
    message: 'Success',
    data: req.decoded,
  });
});

/**
 * Get user online status
 */
router.get('/online/:userId', async (req, res) => {
  const user = await models.User.findByPk(req.params.userId);
  return res.json({
    success: true,
    message: 'Success',
    data: user.online,
  });
});

/**
 * Update user password
 */
router.put('/password', async (req, res) => {
  const id = req.decoded.id;

  const schema = Joi.object().keys({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
    newPasswordConfirmation: Joi.string().min(8).required().valid(Joi.ref('newPassword')),
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

  try {
    const user = await models.User.scope('withPassword').findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // check if old passwords match
    const passwordCheck = await bcrypt.compare(req.body.oldPassword, user.password);

    if (!passwordCheck) {
      return res.status(400).json({
        success: false,
        message: 'Old passwords does not match one saved in database!'
      });
    }

    const salt = await bcrypt.genSalt(saltRounds);
    user.password = await bcrypt.hash(req.body.newPassword, salt);

    await user.save();

    return res.json({
      success: true,
      message: 'Password changed!',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      data: err
    });
  }
});

module.exports = router;
