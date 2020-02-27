const express = require('express');
const router = express.Router();
const Joi = require('@hapi/joi');
const config = require('config');
const es = require('../lib/es');
const models = require('../models');
const _ = require('lodash');
const isClient = require('../middleware/isClient.js');
const Op = models.Sequelize.Op;
const constants = require('../lib/constants.js');
const jwt = require('../middleware/jwt');
const userMiddleware = require('../middleware/userMiddleware.js');
const smartContract = require('../lib/smartContract.js');

/**
 * Create new task
 */
router.post('/', jwt.checkToken, isClient, async (req, res) => {
  const user = req.decoded;

  // validation
  const attachmentsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
  }).optional();

  const skillsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
    categoryId: Joi.number().integer().required(),
  }).optional();

  const schema = Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    location: Joi.string().allow(null),
    type: Joi.string().allow(null),
    price: Joi.any().when('negotiablePrice', {
      is: true,
      then: Joi.number().integer().optional().allow(null),
      otherwise: Joi.number().min(1).integer().required()
    }),
    negotiablePrice: Joi.boolean().optional(),
    duration: Joi.any().when('negotiableDuration', {
      is: true,
      then: Joi.number().integer().optional().allow(null),
      otherwise: Joi.number().min(1).integer().required()
    }),
    negotiableDuration: Joi.boolean().optional(),
    attachments: Joi.array().items(attachmentsSchema).optional().allow(null),
    skills: Joi.array().items(skillsSchema).optional().allow(null),
    publicKey: Joi.any().optional().allow(null),
    sig: Joi.any().optional().allow(null),
    nonce: Joi.any().optional().allow(null),
    descriptionHash: Joi.any().optional().allow(null),
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

    // save task
    const task = await models.Task.create(_.omit(req.body, [
      'attachments', 'skills', 'publicKey', 'sig', 'nonce', 'descriptionHash'
    ]), { transaction });
    //console.log(task);

    // add association to client
    await user.client.addTask(task, { transaction });

    // associate attachments
    if (req.body.attachments && req.body.attachments.length) {
      await task.setAttachments(req.body.attachments.map(a => a.id), { transaction });
    }

    // associate skills
    if (req.body.skills && req.body.skills.length) {
      await task.setSkills(req.body.skills.map(a => a.id), { transaction });
    }

    // fetch categories for elastic indexing
    const categoryIds = req.body.skills ? req.body.skills.map(a => a.categoryId) : [];
    let categories = [];

    if (categoryIds.length) {
      categories = await models.Category.findAll({
        where: {
          id: {
            [Op.in]: _.uniq(categoryIds)
          }
        }
      });
    }

    // index to elasticsearch
    const searchData = {
      index: config.get('es.tasksIndexName'),
      id: task.id,
      type: '_doc',
      body: {
        title: task.title,
        description: task.description,
        price: task.price,
        negotiablePrice: task.negotiablePrice,
        duration: task.duration,
        negotiableDuration: task.negotiableDuration,
        timePosted: task.createdAt,
        location: task.location,
        status: constants.taskStatuses.CREATED,
        postedBy: user.client.name,
        skills: req.body.skills ? req.body.skills.map(s => s.name) : [],
        categories: categories.map(s => s.name),
      }
    };

    // index task data to elastic search
    await es.index(searchData);

    // commit DB transaction
    await transaction.commit();

    // update task with smart contract id
    if (req.body.publicKey && req.body.sig && req.body.nonce !== undefined && req.body.descriptionHash) {
      (smartContract.getContract())
        .methods
        .postTask(req.body.publicKey, req.body.sig, req.body.nonce, 'postTask', req.body.title, req.body.descriptionHash, req.body.price, req.body.duration)
        .then(resBc => {
          console.log(resBc);
          task.update({ bcId: resBc.decodedResult });
        })
        .catch((err) => {
          console.error(req.body.publicKey, req.body.sig, req.body.nonce, req.body.descriptionHash);
          console.error(err);
        });
    }

    return res.json({
      success: true,
      message: 'Task successfully created',
      data: task,
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

/**
 * Edit task
 */
router.put('/:taskId/reopen', jwt.checkToken, isClient, async (req, res) => {
  const { client } = req.decoded;
  const task = await models.Task.findByPk(req.params.taskId);

  // task does not exist
  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found!',
    });
  }

  // user can only edit his own tasks
  if (task.postedBy !== client.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized!',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    task.status = constants.taskStatuses.ACCEPTING;
    task.save({ transaction });

    // update in elastic
    const searchData = {
      index: config.get('es.tasksIndexName'),
      id: task.id,
      type: '_doc',
      body: {
        doc: {
          status: task.status,
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };

    await es.update(searchData);

    // commit DB transaction
    await transaction.commit();

    return res.json({
      success: true,
      message: 'Task successfully updated',
      data: task,
    });
  } catch (e) {
    if (transaction) await transaction.rollback();

    res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: e.message
    });
  }
});

/**
 * Edit task
 */
router.put('/:taskId', jwt.checkToken, isClient, async (req, res) => {
  const user = req.decoded;
  const task = await models.Task.findByPk(req.params.taskId);

  // task does not exist
  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found!',
    });
  }

  // user can only edit his own tasks
  if (task.postedBy !== user.client.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized!',
    });
  }

  // don't allow editing published tasks
  if (task.status > constants.taskStatuses.CREATED) {
    return res.status(400).json({
      success: false,
      message: 'You can not edit tasks in progress',
    });
  }

  // validation
  const attachmentsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
  }).optional();

  const skillsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
    categoryId: Joi.number().integer().required(),
  }).optional();

  const schema = Joi.object().keys({
    id: Joi.number().integer().optional(),
    postedBy: Joi.number().integer().optional(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.any().when('negotiablePrice', {
      is: true,
      then: Joi.number().integer().optional().allow(null),
      otherwise: Joi.number().min(1).integer().required()
    }),
    negotiablePrice: Joi.boolean().optional(),
    duration: Joi.any().when('negotiableDuration', {
      is: true,
      then: Joi.number().integer().optional().allow(null),
      otherwise: Joi.number().min(1).integer().required()
    }),
    negotiableDuration: Joi.boolean().optional(),
    status: Joi.number().optional(),
    attachments: Joi.array().items(attachmentsSchema).optional(),
    skills: Joi.array().items(skillsSchema).optional(),
    location: Joi.string().required(),
    type: Joi.string().required(),
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

  const taskData = _.pick(req.body, ['title', 'description', 'price', 'negotiablePrice', 'duration', 'negotiableDuration', 'location', 'type']);

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    await task.update(taskData, { transaction });

    const attachments = req.body.attachments ? req.body.attachments.map(a => a.id) : [];
    const skills = req.body.skills ? req.body.skills.map(a => a.id) : [];

    // set attachments
    await task.setAttachments(attachments, { transaction });

    // set skills
    await task.setSkills(skills, { transaction });

    // fetch categories for elastic indexing
    const categoryIds = req.body.skills.map(a => a.categoryId);
    let categories = [];

    if (categoryIds.length) {
      categories = await models.Category.findAll({
        where: {
          id: {
            [Op.in]: _.uniq(categoryIds)
          }
        }
      });
    }

    // update in elastic
    const searchData = {
      index: config.get('es.tasksIndexName'),
      id: task.id,
      type: '_doc',
      body: {
        doc: {
          title: task.title,
          description: task.description,
          price: task.price,
          negotiablePrice: task.negotiablePrice,
          duration: task.duration,
          negotiableDuration: task.negotiableDuration,
          timePosted: task.createdAt,
          status: task.status,
          location: task.location,
          postedBy: user.client.name,
          skills: req.body.skills ? req.body.skills.map(s => s.name) : [],
          categories: categories.map(s => s.name),
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };

    await es.update(searchData);

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Task successfully updated',
      data: task,
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
 * Delete task
 * TODO delete attachments on s3 when deleting file
 */
router.delete('/:taskId', jwt.checkToken, isClient, async (req, res) => {
  const user = req.decoded;

  const task = await models.Task.findByPk(req.params.taskId);

  // task does not exist
  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found!',
    });
  }

  // user can only delete his own tasks
  if (task.postedBy !== user.client.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized!',
    });
  }

  try {
    await task.destroy();

    // delete from elastic
    await es.delete({
      index: config.get('es.tasksIndexName'),
      id: req.params.taskId,
      type: '_doc',
    });

    return res.json({
      success: true,
      message: 'Task successfully deleted',
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
 * Search tasks against elastic search server
 */
router.get('/search', userMiddleware.getUser, async (req, res) => {
  const q = req.query.q;
  const page = req.query.page || 1;
  const perPage = req.query.perPage || 20;
  const from = (page - 1) * perPage;
  const sortBy = req.query.sortBy || 'timePosted';
  const sortDir = req.query.sortDir || 'desc';
  const sort = {};
  const category = req.query.category;

  sort[sortBy] = sortDir;

  const searchBody = {
    from: from,
    size: perPage,
    sort: [sort]
  };

  if (q) {
    _.set(searchBody, 'query.bool.must.multi_match', {
      query: q,
      fields: ['title', 'description'],
    });
  }

  // filter out by status
  _.set(searchBody, 'query.bool.filter.0.terms.status', [
    constants.taskStatuses.CREATED,
    constants.taskStatuses.ACCEPTING
  ]);

  if (category) {
    _.set(searchBody, 'query.bool.filter.1.term.categories', category);
  }

  try {
    const result = await es.search({
      index: config.get('es.tasksIndexName'),
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
 * Get tasks that client created
 */
router.get('/my', jwt.checkToken, isClient, async (req, res) => {
  const user = req.decoded;
  const orderBy = req.query.order;
  const searchTerm = req.query.term;

  const where = {
    postedBy: user.client.id
  };

  if (searchTerm) {
    where.title = {
      [Op.like]: '%' + searchTerm + '%'
    };
  }

  let order = ['createdAt', 'DESC'];

  if (orderBy) {
    order = orderBy.split(',');
  }

  const tasks = await models.Task.findAll({
    where,
    order: [order],
    include: [
      { model: models.Skill, as: 'skills' },
    ]
  });

  return res.json({
    success: true,
    data: tasks,
  });
});

/**
 * Get single task
 */
router.get('/:taskId', userMiddleware.getUser, async (req, res) => {
  const taskId = req.params.taskId;
  const user = req.decoded;

  const include = [{
    model: models.Client,
    as: 'owner',
    include: [
      {
        model: models.File,
        as: 'avatar',
      }
    ]
  }, {
    model: models.File,
    as: 'attachments',
  }, {
    model: models.Skill,
    as: 'skills',
  }];

  if (user) {
    if (user.freelancer) {
      include.push({
        model: models.Application,
        as: 'applications',
        where: {
          freelancerId: user.freelancer.id
        },
        required: false,
        include: [
          {
            model: models.Feedback,
            as: 'feedback',
            required: false,
          },
        ]
      });
    } else if (user.client) {
      include.push({
        model: models.Application,
        as: 'applications',
        where: {
          clientId: user.client.id
        },
        required: false,
        include: [
          {
            model: models.Feedback,
            as: 'feedback',
            required: false,
          },
          {
            model: models.Freelancer,
            as: 'freelancer',
            include: [
              {
                model: models.File,
                as: 'avatar',
              },
              {
                model: models.Skill,
                as: 'skills',
              }
            ]
          },
        ]
      });
    }
  }

  const task = await models.Task.findByPk(taskId, {
    include
  });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found',
    });
  }

  return res.json({
    success: true,
    data: task,
  });
});

module.exports = router;
