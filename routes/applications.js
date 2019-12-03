const express = require('express');
const router = express.Router();
const models = require('../models');
const mailer = require('../lib/mailer.js');
const isFreelancer = require('../middleware/isFreelancer.js');
const isClient = require('../middleware/isClient.js');
const config = require('config');
const constants = require('../lib/constants.js');

/**
 * Get all freelancer applications with related tasks and clients
 */
router.get('/', isFreelancer, async (req, res) => {
  const user = req.decoded;
  const status = req.query.status || constants.applicationStatuses.CREATED;

  const applications = await models.Application.findAll({
    where: {
      freelancerId: user.freelancer.id,
      status,
    },
    include: [
      {
        model: models.Task,
        as: 'task',
        required: false,
        include: [
          { model: models.Skill, as: 'skills' },
        ]
      },
      { model: models.Client, as: 'client', required: false, },
    ]
  });

  return res.json({
    success: true,
    data: applications,
  });
});

/**
 * Get all applications for current user with last message and task info
 */
router.get('/messages-info', async (req, res) => {
  const user = req.decoded;
  const role = user.roles[0].name;
  const oppositeRole = role === 'client' ? 'freelancer' : 'client';

  const conditions = {};
  conditions[`${role}Id`] = user[role].id;

  const applications = await models.Application.findAll({
    where: conditions,
    include: [
      includeRole = { 
        model: models[oppositeRole.charAt(0).toUpperCase() + oppositeRole.substring(1)],
        as: oppositeRole,
        required: false,
        include: [
          { model: models.File, as: 'avatar' },
          { model: models.User, required: true }
        ]
      },
      {
        model: models.Task,
        as: 'task',
        required: false
      }
    ],
    order: [
      ['id', 'ASC'],
    ],
  });

  let data = [];
  for(let i = 0; i < applications.length; ++i) {
    let info = {
      id: applications[i].id,
      taskId: applications[i].task.id,
      taskTitle: applications[i].task.title,
      role: applications[i][oppositeRole],
      online: applications[i][oppositeRole].User.online,
      status: applications[i].status,
      lastMsg: {}
    };

    const message = await models.Message.findOne({
      where: {
        applicationId: applications[i].id
      },
      include: [{
        model: models.User,
        as: 'sender',
        include: [
          { model: models.Freelancer, as: 'freelancer' },
          { model: models.Client, as: 'client' },
        ]
      }, {
        model: models.File,
        as: 'attachments'
      }],
      order: [
        ['id', 'DESC'],
      ]
    });

    if(message){
      info.lastMsg = {
        text: message.text,
        from: user.id === message.senderId ? 'You' : message.sender[message.role].name,
        date: message.updatedAt,
      };
    }
    else {
      info.lastMsg = {
        text: applications[i].letter,
        from: applications[i].client ? applications[i].client.name : applications[i].freelancer.name,
        date: applications[i].createdAt,
      };
    }
    data.push(info);
  }

  return res.json({
    success: true,
    data: {
      role: role,
      data: data,
    },
  });
});

/**
 * Get all applications for task and current client
 */
router.get('/task/:taskId', isClient, async (req, res) => {
  const user = req.decoded;

  const applications = await models.Application.find({
    where: {
      taskId: req.params.taskId,
      clientId: user.client.id,
    }
  }, {
    include: [
      { model: models.Task, required: false, as: 'task' },
      { model: models.Freelancer, required: false, },
    ]
  });

  return res.json({
    success: true,
    data: applications,
  });
});

/**
 * Get single application
 */
router.get('/:applicationId', async (req, res) => {
  const { applicationId } = req.params;
  const user = req.decoded;

  const application = await models.Application.findByPk(applicationId, {
    include: [
      {
        model: models.Task,
        as: 'task',
        required: false,
        include: [
          { model: models.Skill, as: 'skills' },
        ]
      },
      { model: models.Client, as: 'client', required: false, },
    ]
  });

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found',
    });
  }

  // check if current user can see application
  // only if application freelancer or client
  let isAllowed = user.freelancer && application.freelancerId === user.freelancer.id;

  if (!isAllowed) {
    isAllowed = user.client && application.task.postedBy === user.client.id;
  }

  if (!isAllowed) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  return res.json({
    success: true,
    data: application,
  });
});

/**
 * Create new application
 * Only freelancer can create one if already doesn't exist
 */
router.post('/', isFreelancer, async (req, res) => {
  const taskId = req.body.taskId;
  const user = req.decoded;

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    // get task data with client (owner)
    const task = await models.Task.findByPk(taskId, {
      include: [{
        model: models.Client,
        as: 'owner',
        attributes: ['id', 'userId'],
        include: [
          { model: models.User, attributes: ['id', 'email'] }
        ]
      }],
      transaction
    });

    // if task does not exist
    if (!task) {
      if (transaction) await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // get application for selected task and freelancer if exists
    const application = await models.Application.findOne({
      where: {
        taskId: taskId,
        freelancerId: user.freelancer.id,
      }
    }, { transaction });

    // if freelancer already applied
    if (application) {
      if (transaction) await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: 'You have already applied for this task!',
      });
    }

    // make new application
    const newApp = await models.Application.create({
      letter: req.body.letter || null,
    }, { transaction });

    // associate with task
    await newApp.setTask(task, { transaction });

    // associate with freelancer
    await newApp.setFreelancer(user.freelancer.id, { transaction });

    //associate with client
    await newApp.setClient(task.owner.id, { transaction });

    // create new message with application text as message text
    if (req.body.letter) {
      await models.Message.create({
        senderId: user.id,
        receiverId: task.owner.userId,
        role: 'freelancer',
        applicationId: newApp.id,
        text: req.body.letter,
      }, { transaction });
    }

    await transaction.commit();

    // send notification to task owner
    const content = `<html><body><p>Hi, you have new application for task <span style='font-weight:bold;'>${task.title}</span>`
                    +` from <span style='font-weight:bold;'>${user.freelancer.name}</span>.</p>`
                    +'<p>Click this link to visit our site: </p>'
                    +`<a href='${config.get('frontendUrl')}'>Visit CRYPTOTASK!</a></body></html>`;
    mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      to: `<${task.owner.User.email}>`, // list of receivers
      subject: 'New task application - Cryptotask', // Subject line
      text: `Hi, you have new application for task ${task.title} from ${user.freelancer.name}`, // plain text body
      html: content,
    });

    return res.json({
      success: true,
      data: newApp
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
});

/**
 * Accept freelancers application
 */
router.put('/:applicationId/hire', isClient, async (req, res) => {
  const user = req.decoded;
  const application = await models.Application.findByPk(req.params.applicationId);

  if (application.clientId !== user.client.id) {
    return res.status(401).json({
      success: false,
      message: 'Not allowed',
    });
  }

  const task = await models.Task.findByPk(application.taskId);

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    // update application status to accepted
    application.status = constants.applicationStatuses.ACCEPTED;
    await application.save({ transaction });

    // update task status to Hired
    task.status = constants.taskStatuses.HIRED;
    await task.save({ transaction });

    await transaction.commit();

    // send notification to applied freelancer
    const freelancer = await models.Freelancer.findByPk(application.freelancerId, {
      include: [
        { model: models.User, attributes: ['email'] }
      ]
    });
    const content = `<html><body><p>Hi, you have been hired for task <span style='font-weight:bold;'>${task.title}</span>.</p>`
                    +'<p>Click this link to visit our site: </p>'
                    +`<a href='${config.get('frontendUrl')}'>Visit CRYPTOTASK!</a></body></html>`;
    mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      to: `<${freelancer.User.email}>`, // list of receivers
      subject: 'Application accepted - Cryptotask', // Subject line
      text: `Hi, you have been hired for task ${task.title}`, // Plain text body
      html: content,
    });

    return res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
});

module.exports = router;
