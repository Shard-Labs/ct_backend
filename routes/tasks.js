const express = require('express');
const router = express.Router();
const Joi = require('@hapi/joi');
const config = require('config');
const es = require('../lib/es');
const models = require('../models');
const taskStatuses = require('../lib/taskStatuses.js');

/**
 * Create new task
 */
router.post('/', async (req, res) => {
  // validation
  const schema = Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().min(1).integer().required(),
    worktime: Joi.number().min(1).integer().required(),
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

  let taskData;

  // save do database
  try {
    const tempData = { ...req.body, postedBy: req.decoded.id };

    taskData = await models.Task.create(tempData);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err
    });
  }

  // index to elasticsearch
  const esData = {
    index: config.get('es.indexName'),
    id: taskData.id,
    type: config.get('es.tasksTypeName'),
    body: {
      ...req.body,
      timePosted: taskData.createdAt,
      stage: 0,
    }
  };

  try {
    await es.index(esData);

    return res.json({
      success: true,
      message: 'Task successfully saved',
      data: taskData,
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
      index: config.get('es.indexName'),
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
 * Apply freelancer for task
 */
router.post('/apply/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const task = await models.Task.findByPk(taskId);
    const application = await models.Application.findOne({
      where: {
        taskId: taskId,
        freelancerId: req.decoded.id,
      }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    if (application) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this task!',
      });
    }

    // make new application
    const newApp = await models.Application.create({
      taskId: taskId,
      freelancerId: req.decoded.id,
    });

    return res.json({
      success: true,
      data: newApp
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
 * Get current user tasks
 */
router.get('/my', async (req, res) => {
  const userId = req.decoded.id;

  // user is working on as freelancer
  const workingOn = models.Task.findAll(/*{
    include: [{
      model: models.Application,
      required: true,
      through: {
        where: {
          freelancerId: req.decoded.id,
          stage: taskStatuses.WORKING,
        }
      }
    }]
  }*/);

  const appliedFor = models.Task.findAll(/*{
    include: [{
      model: models.Application,
      required: true,
      through: {
        where: {
          freelancerId: req.decoded.id,
          stage: taskStatuses.APPLIED,
        }
      }
    }]
  }*/);

  // user created as client
  const created = models.Task.findAll({
    where: {
      postedBy: userId,
    },
    include: [models.Application]
  });

  const data = await Promise.all([workingOn, created, appliedFor]);

  return res.json({
    success: true,
    data: {
      workingOn: data[0],
      created: data[1],
      appliedFor: data[2],
    },
  });
});

/**
 * Get single task
 */
router.get('/:taskId', async (req, res) => {
  const taskId = req.params.taskId;

  try {
    const task = await models.Task.findByPk(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    let applications;

    if (task.postedBy === req.decoded.id) { // client who created task
      applications = await models.Application.findAll({
        where: {
          taskId: taskId,
        }
      });
    } else { // freelancer or other users (get only applications created by them)
      applications = await models.Application.findAll({
        where:{
          freelancerId: req.decoded.id,
        },
      });
    }

    return res.json({
      success: true,
      data: { task, applications },
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
