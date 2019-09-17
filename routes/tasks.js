const express = require('express');
const router = express.Router();
const Joi = require('@hapi/joi');
const config = require('config');
const es = require('../lib/es');
const models = require('../models');
const _ = require('lodash');
const taskStatuses = require('../lib/taskStatuses.js');
const isClient = require('../middleware/isClient.js');

/**
 * Create new task
 */
router.post('/', isClient, async (req, res) => {
  const user = req.decoded;

  // validation
  const attachmentsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
  }).optional();

  const skillsSchema = Joi.object().keys({
    id: Joi.number().integer().required(),
  }).optional();

  const schema = Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().min(1).integer().required(),
    duration: Joi.number().min(1).integer().required(),
    attachments: Joi.array().items(attachmentsSchema).optional(),
    skills: Joi.array().items(skillsSchema).optional(),
  });

  const validation = Joi.validate(req.body, schema, {
    abortEarly: false,
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
    const task = await models.Task.create(_.omit(req.body, ['attachments', 'skills']), { transaction });

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

    // index to elasticsearch
    const searchData = {
      index: config.get('es.tasksIndexName'),
      id: task.id,
      type: config.get('es.tasksTypeName'),
      body: {
        title: task.title,
        description: task.description,
        price: task.price,
        duration: task.duration,
        timePosted: task.createdAt,
        status: taskStatuses.CREATED,
        postedBy: user.client.name,
      }
    };

    await es.index(searchData);

    await transaction.commit();

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

router.put('/:taskId', isClient, async (req, res) => {
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
  if (task.status > taskStatuses.APPLIED) {
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
  }).optional();

  const schema = Joi.object().keys({
    id: Joi.number().integer().optional(),
    postedBy: Joi.number().integer().optional(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().min(1).integer().required(),
    duration: Joi.number().min(1).integer().required(),
    status: Joi.number().optional(),
    attachments: Joi.array().items(attachmentsSchema).optional(),
    skills: Joi.array().items(skillsSchema).optional(),
  });

  const validation = Joi.validate(req.body, schema, {
    abortEarly: false,
  });

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      data: validation.error
    });
  }

  const taskData = _.pick(req.body, ['title', 'description', 'price', 'duration']);

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

    // update in elastic
    const searchData = {
      index: config.get('es.tasksIndexName'),
      id: task.id,
      type: config.get('es.tasksTypeName'),
      body: {
        doc: {
          title: task.title,
          description: task.description,
          price: task.price,
          duration: task.duration,
          timePosted: task.createdAt,
          status: task.status,
          postedBy: client.name,
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
router.delete('/:taskId', isClient, async (req, res) => {
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
      type: config.get('es.tasksTypeName'),
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
router.get('/search', async (req, res) => {
  const q = req.query.q;
  const page = req.query.page || 1;
  const perPage = req.query.perPage || 20;
  const from = (page - 1) * perPage;
  const sortBy = req.query.sortBy || 'timePosted';
  const sortDir = req.query.sortDir || 'desc';
  const sort = {};

  sort[sortBy] = sortDir;

  const searchBody = {
    from: from,
    size: perPage,
    sort: [sort]
  };

  if (q) {
    searchBody['query'] = {
      multi_match: {
        query: q,
        fields: ['title', 'description']
      }
    };
  } else {
    searchBody['query'] = {
      match_all: {}
    };
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
 * Get single task
 */
router.get('/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  const task = await models.Task.findByPk(taskId, {
    include: [{
      model: models.Client,
      as: 'owner',
    }, {
      model: models.File,
      as: 'attachments',
    }]
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
