const express = require('express');
const router = express.Router();
const models = require('../models');
const _ = require('lodash');
const Joi = require('@hapi/joi');
const isFreelancer = require('../middleware/isFreelancer.js');
const asyncForEach = require('../lib/asyncForEach.js');
const es = require('../lib/es');
const config = require('config');

/**
 * Search freelancers
 */
router.get('/', async (req, res) => {
  const q = req.query.q;
  const page = req.query.page || 1;
  const perPage = req.query.perPage || 20;
  const from = (page - 1) * perPage;
  const category = req.query.category;

  const searchBody = {
    from: from,
    size: perPage,
  };

  if (q) {
    _.set(searchBody, 'query.bool.must.multi_match', {
      query: q,
      fields: ['firstName', 'lastName', 'bio', 'skills', 'categories', 'occupation', 'location'],
    });

    _.set(searchBody, 'query.bool.filter', [
      { term: { published: true, }, },
    ]);
  } else {
    // simple initial load with no filtering
    searchBody['query'] = {
      bool: {
        must: [
          { term: { published: true, } },
        ],
      },
    };
  }

  if (category) {
    _.set(searchBody, 'query.bool.filter.1', { term: { categories: category, }, });
  }

  console.log(JSON.stringify(searchBody));

  try {
    const result = await es.search({
      index: config.get('es.freelancersIndexName'),
      body: searchBody,
    });

    return res.json({
      success: true,
      data: result.hits
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err
    });
  }
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const freelancer = await models.Freelancer.findOne({
      where: {
        id,
        published: true,
      },
      include: [
        { model: models.File, as: 'avatar' },
        { model: models.File, as: 'resume' },
        { model: models.Skill, as: 'skills' },
        { model: models.Category, as: 'categories' },
        { model: models.Experience, as: 'workExperiences' },
        {
          model: models.Project, as: 'projects', include: [
            { model: models.File, as: 'cover' },
            { model: models.File, as: 'images' },
          ]
        },
      ]
    });

    if (!freelancer) {
      return res.status(404).json({
        success: false,
        message: 'Freelancer does not exist!',
      });
    }

    return res.json({
      success: true,
      data: freelancer
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
 * Create new freelancer user
 */
router.post('/', async (req, res) => {
  const userId = req.decoded.id;

  // validation
  const schema = Joi.object().keys({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    occupation: Joi.string().optional().allow(null),
    location: Joi.string().optional().allow(null),
    travel: Joi.boolean().optional(),
    bio: Joi.string().optional().allow(null),
    linkedin: Joi.string().optional().allow(null),
    web: Joi.string().optional().allow(null),
    blog: Joi.string().optional().allow(null),
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

  // check if freelancer profile already exists for current user
  let exists = await models.Freelancer.findOne({
    where: {
      userId,
    },
  });

  if (exists) {
    return res.status(400).json({
      success: false,
      message: 'User already has freelancer profile',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const freelancerData = req.body;

    // create freelancer record
    const freelancer = await models.Freelancer.create({
      ...freelancerData,
      userId
    }, {
      transaction,
    });

    if (freelancerData.avatar) {
      await freelancer.setAvatar(freelancerData.avatar.id, { transaction });
    }

    // index to elasticsearch
    const searchData = {
      index: config.get('es.freelancersIndexName'),
      id: freelancer.id,
      type: '_doc',
      body: _.pick(req.body, ['firstName', 'lastName', 'occupation', 'location', 'bio', 'avatar']),
    };
    await es.index(searchData);

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Freelancer successfully created',
      data: await models.Freelancer.findByPk(freelancer.id, {
        include: [{
          model: models.File,
          as: 'avatar',
        }],
      }),
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
 * Update freelancer basic profile
 */
router.put('/', isFreelancer, async (req, res) => {
  const user = req.decoded;

  // validation
  const schema = Joi.object().keys({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    occupation: Joi.string().optional().allow(null),
    location: Joi.string().optional().allow(null),
    travel: Joi.boolean().optional(),
    bio: Joi.string().optional().allow(null),
    linkedin: Joi.string().optional().allow(null),
    web: Joi.string().optional().allow(null),
    blog: Joi.string().optional().allow(null),
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

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const freelancerData = _.omit(req.body, ['id', 'userId']);

    // update freelancer record
    await user.freelancer.update(freelancerData, { transaction, });

    if (freelancerData.avatar) {
      await user.freelancer.setAvatar(freelancerData.avatar.id, { transaction });
    } else {
      await user.freelancer.removeAvatar({ transaction });
    }

    // update in elastic
    const searchData = {
      index: config.get('es.freelancersIndexName'),
      id: user.freelancer.id,
      type: '_doc',
      body: {
        doc: {
          ..._.pick(req.body, ['firstName', 'lastName', 'occupation', 'location', 'bio', 'avatar']),
          published: user.freelancer.published,
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };
    await es.update(searchData);

    await transaction.commit();

    // fetch it all on the end
    const data = await models.Freelancer.findByPk(user.freelancer.id);

    return res.json({
      success: true,
      message: 'Freelancer successfully updated',
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
 * Publish freelancer profile
 */
router.put('/publish', isFreelancer, async (req, res) => {
  const user = req.decoded;

  try {
    user.freelancer.published = true;
    await user.freelancer.save();

    // update in elastic
    const searchData = {
      index: config.get('es.freelancersIndexName'),
      id: user.freelancer.id,
      type: '_doc',
      body: {
        doc: {
          published: true,
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };
    await es.update(searchData);

    return res.json({
      success: true,
      message: 'Freelancer successfully updated',
    });
  } catch (err) {
    console.error(err);

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * Update freelancer categories and skills
 */
router.put('/skills', isFreelancer, async (req, res) => {
  const user = req.decoded;

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const skills = req.body.skills || [];
    const categories = req.body.categories || [];

    await user.freelancer.setSkills(skills.map(s => s.id), { transaction });
    await user.freelancer.setCategories(categories.map(s => s.id), { transaction });

    // update in elastic
    const searchData = {
      index: config.get('es.freelancersIndexName'),
      id: user.freelancer.id,
      type: '_doc',
      body: {
        doc: {
          skills: skills.map(s => s.name),
          categories: categories.map(s => s.name),
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };
    await es.update(searchData);

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Freelancer successfully updated',
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
 * Update freelancer resume
 */
router.put('/resume', isFreelancer, async (req, res) => {
  const user = req.decoded;

  try {
    const resumeFile = await models.File.findOne({
      where: {
        id: req.body.id,
        uploadedBy: user.id,
      }
    });

    if (!resumeFile) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized!',
      });
    }

    user.freelancer.resumeId = resumeFile.id;
    await user.freelancer.save();

    return res.json({
      success: true,
      message: 'Freelancer successfully updated',
    });
  } catch (err) {
    console.error(err);

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * Update freelancer resume
 */
router.delete('/resume', isFreelancer, async (req, res) => {
  const user = req.decoded;

  try {
    user.freelancer.resumeId = null;
    await user.freelancer.save();

    return res.json({
      success: true,
      message: 'Freelancer successfully updated',
    });
  } catch (err) {
    console.error(err);

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * Update freelancer experiences
 */
router.put('/experience', isFreelancer, async (req, res) => {
  const user = req.decoded;

  // validation
  const experienceSchema = Joi.object().keys({
    company: Joi.string().required(),
    title: Joi.string().required(),
    from: Joi.string().required(),
    to: Joi.string().optional().allow(null),
    description: Joi.string().optional().allow(null),
  }).optional();

  const schema = Joi.array().items(experienceSchema);

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

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    // bulk create all the experiences
    const experiences = await models.Experience.bulkCreate(req.body, { transaction });

    await user.freelancer.setWorkExperiences(experiences, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Freelancer successfully updated',
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
 * Add freelancer projects
 */
router.put('/projects', isFreelancer, async (req, res) => {
  const user = req.decoded;

  // validation
  const projectSchema = Joi.object().keys({
    cover: Joi.object().keys({
      id: Joi.number().integer().required(),
    }).optional().allow(null),
    link: Joi.string().required(),
    title: Joi.string().required(),
    tags: Joi.string().optional().allow(null),
    description: Joi.string().required(),
    images: Joi.array().items(Joi.object().keys({
      id: Joi.number().required()
    })).optional().allow(null),
  }).optional();

  const schema = Joi.array().items(projectSchema);

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

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const projects = [];

    await asyncForEach(req.body, async p => {
      const project = await models.Project.create(_.omit(p, ['id', 'images', 'cover']), { transaction });

      // set images for project
      const images = p.images || [];
      await project.setImages(images.map(i => i.id), { transaction });

      // set cover for project
      if (p.cover) {
        await project.setCover(p.cover.id, { transaction });
      }

      projects.push(project.id);
    });

    // TODO this only updates old projects, make them disappear somehow
    await user.freelancer.setProjects(projects, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Freelancer successfully updated',
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
