const express = require('express');
const router = express.Router();
const models = require('../models');
const _ = require('lodash');
const Joi = require('@hapi/joi');
const isFreelancer = require('../middleware/isFreelancer.js');
const asyncForEach = require('../lib/asyncForEach.js');
const es = require('../lib/es');
const config = require('config');
const jwt = require('../middleware/jwt');
const userMiddleware = require('../middleware/userMiddleware.js');

/**
 * Search freelancers
 */
router.get('/', userMiddleware.getUser, async (req, res) => {
  const q = req.query.q;
  const page = req.query.page || 1;
  const perPage = req.query.perPage || 20;
  const from = (page - 1) * perPage;
  const category = req.query.category;
  const skill = req.query.skill;

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

  if ((category || skill) && !_.get(searchBody, 'query.bool.filter')) {
    _.set(searchBody, 'query.bool.filter', []);
  }

  if (category) {
    searchBody.query.bool.filter.push({ term: { categories: category, }, });
  }

  if (skill) {
    searchBody.query.bool.filter.push({ term: { skills: skill, }, });
  }

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

/**
 * Get all freelancers feedbacks
 */
router.get('/:id/feedbacks', userMiddleware.getUser, async (req, res) => {
  const id = req.params.id;

  try {
    const feedbacks = await models.Feedback.findAll({
      where: {
        freelancerId: id,
      },
      include: [
        { model: models.Client, as: 'client' },
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
 * Get single freelancer
 */
router.get('/:id', userMiddleware.getUser, async (req, res) => {
  const id = req.params.id;

  try {
    const freelancer = await models.Freelancer.findOne({
      where: {
        id,
        published: true,
      },
      include: [
        { model: models.File, as: 'avatar' },
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
router.post('/', jwt.checkToken, async (req, res) => {
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
      body: {
        ..._.pick(req.body, ['firstName', 'lastName', 'occupation', 'location', 'bio', 'avatar']),
        published: false,
      },
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
router.put('/', jwt.checkToken, isFreelancer, async (req, res) => {
  const user = req.decoded;

  const skillsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
    categoryId: Joi.number().integer().required(),
  }).optional();

  const categoriesSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
  }).optional();

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
    }).required(),
    skills: Joi.array().items(skillsSchema).optional(),
    categories: Joi.array().items(categoriesSchema).optional(),
    published: Joi.boolean().optional(),
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

    // update freelancer record
    await user.freelancer.update(
      _.omit(req.body, ['id', 'userId', 'avatar', 'skills', 'categories']),
      { transaction, }
    );

    await user.freelancer.setAvatar(req.body.avatar ? req.body.avatar.id : null, { transaction });

    const skills = req.body.skills;
    const categories = req.body.categories;

    if (skills && categories) {
      await user.freelancer.setSkills(skills.map(s => s.id), { transaction });
      await user.freelancer.setCategories(categories.map(s => s.id), { transaction });
    }

    // update in elastic
    const searchData = {
      index: config.get('es.freelancersIndexName'),
      id: user.freelancer.id,
      type: '_doc',
      body: {
        doc: {
          ..._.pick(req.body, [
            'firstName',
            'lastName',
            'occupation',
            'location',
            'bio',
            'avatar',
          ]),
          skills: skills.map(s => s.name),
          categories: categories.map(s => s.name),
          published: user.freelancer.published,
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };
    await es.update(searchData);

    await transaction.commit();

    // fetch it all on the end
    const data = await models.Freelancer.findByPk(user.freelancer.id, {
      include: [
        { model: models.Skill, as: 'skills' },
        { model: models.Category, as: 'categories' },
        { model: models.File, as: 'avatar' },
      ]
    });

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
router.put('/publish', jwt.checkToken, isFreelancer, async (req, res) => {
  const user = req.decoded;
  const fl = user.freelancer;

  // check if all required data is set
  if (!fl.firstName || !fl.lastName || !fl.pictureId || !fl.skills.length || !fl.categories.length) {
    return res.status(400).json({
      success: false,
      message: 'Freelancer details missing',
    });
  }

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
router.put('/skills', jwt.checkToken, isFreelancer, async (req, res) => {
  const user = req.decoded;

  const skillsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
    categoryId: Joi.number().integer().required(),
  }).optional();

  const categoriesSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
    name: Joi.string().required(),
  }).optional();

  // validation
  const schema = Joi.object().keys({
    skills: Joi.array().items(skillsSchema).required(),
    categories: Joi.array().items(categoriesSchema).required(),
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
router.put('/resume', jwt.checkToken, isFreelancer, async (req, res) => {
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
router.delete('/resume', jwt.checkToken, isFreelancer, async (req, res) => {
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
router.put('/experience', jwt.checkToken, isFreelancer, async (req, res) => {
  const user = req.decoded;

  const experienceSchema = Joi.object().keys({
    company: Joi.string().required(),
    title: Joi.string().required(),
    from: Joi.string().required(),
    to: Joi.string().optional().allow(null),
    description: Joi.string().optional().allow(null),
  }).optional();

  const schema = Joi.object().keys({
    resume: Joi.string().optional().allow(null),
    items: Joi.array().items(experienceSchema),
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

    // bulk create all the experiences
    const items = req.body.items.map(i => {
      return _.omit(i, ['id']);
    });

    const experiences = await models.Experience.bulkCreate(items, { transaction });

    await user.freelancer.setWorkExperiences(experiences, { transaction });

    // cleanup DB from obsolete data
    await models.Experience.destroy({
      where: {
        freelancerId: null
      },
      transaction,
    });

    // update resume data
    user.freelancer.resume = req.body.resume;

    await user.freelancer.save({ transaction });

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
router.put('/projects', jwt.checkToken, isFreelancer, async (req, res) => {
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

    await user.freelancer.setProjects(projects, { transaction });

    // cleanup DB from obsolete data
    await models.Project.destroy({
      where: {
        freelancerId: null
      },
      transaction,
    });

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
