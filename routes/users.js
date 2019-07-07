const express = require('express');
const router = express.Router();
const models = require('../models');
const Joi = require('@hapi/joi');
const es = require('../lib/es');
const config = require('config');
const bcrypt = require('bcrypt');
const saltRounds = 10;

/**
 * Get current user data
 */
router.get('/me', async (req, res) => {
  const id = req.decoded.id;

  if (id) {
    try {
      const user = await models.User.findByPk(id, {
        include: [
          {
            model: models.Skill,
            as: 'Skills'
          },
          {
            model: models.Language,
            as: 'Languages'
          }
        ]
      });

      return res.json({
        success: true,
        message: 'Success',
        data: user,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Something went wrong',
        data: err
      });
    }
  }
});

/**
 * Update current user data
 */
router.put('/me', async (req, res) => {
  const id = req.decoded.id;

  const schema = Joi.object().keys({
    name: Joi.string().optional(),
    bio: Joi.string().optional(),
    picture: Joi.string().optional(),
    Skills: Joi.array().items(Joi.object().keys({
      id: Joi.number().required()
    })).optional(),
    Languages: Joi.array().items(Joi.object().keys({
      id: Joi.number().required()
    })).optional(),
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
    const user = await models.User.findByPk(id);

    user.name = req.body.name;
    user.bio = req.body.bio;
    user.picture = req.body.picture;

    const skills = req.body.Skills || [];
    const languages = req.body.Languages || [];

    await user.setSkills(skills.map(s => s.id));
    await user.setLanguages(languages.map(s => s.id));

    await user.save();

    user.setDataValue('Skills', await user.getSkills());
    user.setDataValue('Languages', await user.getLanguages());

    // add data to elastic
    const esData = {
      index: config.get('es.usersIndexName'),
      id: user.id,
      type: config.get('es.usersTypeName'),
      body: {
        doc: {
          email: user.email,
          name: user.name,
          skills: skills.map(s => s.name),
          languages: languages.map(s => s.name),
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };

    await es.update(esData);

    return res.json({
      success: true,
      message: 'Success',
      data: user,
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
 * Get all skills available
 */
router.get('/skills', async (req, res) => {
  const skills = await models.Skill.findAll();

  return res.json({
    success: true,
    message: 'Success',
    data: skills,
  });
});

/**
 * Get all languages available
 */
router.get('/languages', async (req, res) => {
  const languages = await models.Language.findAll();

  return res.json({
    success: true,
    message: 'Success',
    data: languages,
  });
});

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
