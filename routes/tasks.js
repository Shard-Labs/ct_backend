const express = require('express');
const router = express.Router();
const Joi = require('@hapi/joi');
const config = require('config');
const es = require('../lib/es');
const models = require('../models');
const _ = require('lodash');
const mailer = require('../lib/mailer.js');

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
    published: Joi.boolean().optional(),
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

  // only if task is published add it to elastic search
  if (req.body.published) {
    const user = await models.User.findByPk(req.decoded.id);

    // index to elasticsearch
    const esData = {
      index: config.get('es.indexName'),
      id: taskData.id,
      type: config.get('es.tasksTypeName'),
      body: {
        ...req.body,
        timePosted: taskData.createdAt,
        stage: 0,
        postedBy: user.name,
      }
    };

    try {
      await es.index(esData);
    } catch (err) {
      res.status(400).json({
        success: false,
        message: 'Something went wrong',
        data: err
      });
    }
  }

  return res.json({
    success: true,
    message: 'Task successfully saved',
    data: taskData,
  });
});

router.put('/:taskId', async (req, res) => {
  const taskData = await models.Task.findByPk(req.params.taskId);

  // task does not exist
  if (!taskData) {
    return res.status(404).json({
      success: false,
      message: 'Task not found!',
    });
  }

  // user can only edit his own tasks
  if (taskData.postedBy !== req.decoded.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized!',
    });
  }

  // don't allow editing published tasks
  if (taskData.published) {
    return res.status(400).json({
      success: false,
      message: 'You can not edit published tasks',
    });
  }

  // validation
  const schema = Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().min(1).integer().required(),
    worktime: Joi.number().min(1).integer().required(),
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

  const updatableFields = ['title', 'description', 'price', 'worktime', 'published'];

  // save do database
  try {
    await taskData.update(req.body, {
      fields: updatableFields
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err
    });
  }

  // index to elasticsearch if published
  if (req.body.published) {
    const esData = {
      index: config.get('es.indexName'),
      id: taskData.id,
      type: config.get('es.tasksTypeName'),
      body: {
        doc: {
          ..._.pick(req.body, updatableFields),
        },
        doc_as_upsert: true, // upsert if not already there
      },
    };

    try {
      await es.update(esData);
    } catch (err) {
      res.status(400).json({
        success: false,
        message: 'Something went wrong',
        data: err
      });
    }
  }

  return res.json({
    success: true,
    message: 'Task successfully saved',
    data: taskData,
  });
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
    const task = await models.Task.findByPk(taskId, {
      include: [{
        model: models.User,
        as: 'Owner',
        attributes: ['id', 'email', 'name']
      }]
    });

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
      clientId: task.postedBy,
      freelancerId: req.decoded.id,
    });

    // send notification to task owner
    await mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      to: task.Owner.email, // list of receivers
      subject: 'New task application - Cryptotask', // Subject line
      text: `Hi, you have new application for task ${task.title} from ${task.Owner.name}`, // plain text body
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
        },
        include: [
          {
            model: models.User,
            as: 'Freelancer',
            attributes: ['id', 'name'],
          }
        ]
      });
    } else { // freelancer or other users (get only applications created by them)
      applications = await models.Application.findAll({
        where:{
          taskId: taskId,
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
