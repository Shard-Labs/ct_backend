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
    password: Joi.string().min(6).required(),
    email: Joi.string().email().required(),
    name: Joi.string().optional(),
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

  // create email confirmation hash
  const confirmationHash = uuidv1();

  try {
    // create password hash
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(req.body.password, salt);

    // save to database
    await models.User.create({
      email: req.body.email,
      password: hash,
      name: req.body.name,
      emailConfirmed: false,
      confirmationHash: confirmationHash
    });

    // send email confirmation message
    await mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      to: req.body.email, // list of receivers
      subject: 'Email confirmation - Cryptotask', // Subject line
      text: `${config.get('frontendUrl')}/auth/confirm-email/${confirmationHash}`, // plain text body
    });

    res.json({
      success: true,
      message: 'User created',
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err
    });
  }
});

/**
 * Login user
 */
router.post('/login', async (req, res) => {
  // validation
  const schema = Joi.object().keys({
    password: Joi.string().min(6),
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
        emailConfirmed: true
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
        email: req.body.email,
      },
      config.get('jwt.secret'),
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      message: 'User successfully logged in',
      data: {
        token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      data: err
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

module.exports = router;
