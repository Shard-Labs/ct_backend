const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Joi = require('@hapi/joi');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const config = require('config');
const models = require('../models');
const uuidv1 = require('uuid/v1');
const mailer = require('../lib/mailer.js');

/**
 * Register user
 * TODO add validation for existing email address
 */
router.post('/register', async (req, res) => {
  // validation
  const schema = Joi.object().keys({
    password: Joi.string().min(8).required(),
    passwordConfirmation: Joi.string().min(8).required().valid(Joi.ref('password')),
    email: Joi.string().email().required(),
    role: Joi.string().valid('freelancer', 'client').required(),
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

  // check if email already exists
  const exists = await models.User.findOne({
    where: {
      email: req.body.email,
    },
  });

  if (exists) {
    return res.status(400).json({
      success: false,
      message: 'User with same email address already exists',
    });
  }

  // create email confirmation hash
  const confirmationHash = uuidv1();

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    // create password hash
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(req.body.password, salt);

    // save to database
    const user = await models.User.create({
      email: req.body.email,
      password: hash,
      emailConfirmed: false,
      confirmationHash: confirmationHash
    }, { transaction });

    const role = await models.Role.findOne({
      where: {
        name: req.body.role
      }
    }, { transaction });

    await user.addRole(role, { transaction });

    // create default profiles
    if (req.body.role === 'freelancer') {
      await models.Freelancer.create({
        userId: user.id,
      }, { transaction });
    }

    if (req.body.role === 'client') {
      await models.Client.create({
        userId: user.id
      }, { transaction });
    }

    // send email confirmation message
    await mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      to: req.body.email, // list of receivers
      subject: 'Email confirmation - Cryptotask', // Subject line
      text: `${config.get('frontendUrl')}/confirm-email/${confirmationHash}`, // plain text body
    });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'User created',
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
 * Login user
 */
router.post('/login', async (req, res) => {
  // validation
  const schema = Joi.object().keys({
    password: Joi.string().min(8),
    email: Joi.string().email()
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

  try {
    const user = await models.User.scope('withPassword').findOne({
      where: {
        email: req.body.email,
        emailConfirmed: true,
        active: true,
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const passwordCheck = await bcrypt.compare(req.body.password, user.password);

    if (!passwordCheck) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // create jwt
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      config.get('jwt.secret'),
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      message: 'User successfully logged in',
      data: { token }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * User email confirmation
 */
router.post('/email-confirm', async (req, res) => {
  // validation
  const schema = Joi.object().keys({
    hash: Joi.string().required(),
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

  try {
    // get user by confirmation hash
    const user = await models.User.scope('withPassword').findOne({
      where: {
        confirmationHash: req.body.hash,
      }
    });

    // if no user or already confirmed throw exception
    if (!user || user.emailConfirmed) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // update user data
    user.emailConfirmed = true;
    user.confirmationHash = null;
    await user.save();

    return res.json({
      success: true,
      message: 'Email successfully confirmed',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err
    });
  }
});

/**
 * Forgot password
 */
router.post('/forgot-password', async (req, res) => {
  // validation
  const schema = Joi.object().keys({
    email: Joi.string().email().required(),
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

  const user = await models.User.findOne({
    where: {
      email: req.body.email
    }
  });

  const resetToken = uuidv1();

  user.resetToken = resetToken;

  await user.save();

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // send email confirmation message
  await mailer.sendMail({
    from: config.get('email.defaultFrom'), // sender address
    to: req.body.email, // list of receivers
    subject: 'Password reset - Cryptotask', // Subject line
    text: `${config.get('frontendUrl')}/reset-password/${resetToken}`, // plain text body
  });

  return res.json({
    success: true,
    message: 'User created',
  });
});

/**
 * Reset password
 */
router.post('/reset-password', async (req, res) => {
  // validation
  const schema = Joi.object().keys({
    password: Joi.string().min(6).required(),
    resetToken: Joi.string().required(),
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

  const user = await models.User.findOne({
    where: {
      resetToken: req.body.resetToken,
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Invalid token',
    });
  }

  try {
    // create password hash
    const salt = await bcrypt.genSalt(saltRounds);

    user.password = await bcrypt.hash(req.body.password, salt);
    user.resetToken = null;

    await user.save();

    return res.json({
      success: true,
      message: 'Password changed',
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
