const express = require('express');
const router = express.Router();
const models = require('../models');
const mailer = require('../lib/mailer.js');
const isFreelancer = require('../middleware/isFreelancer.js');
const isClient = require('../middleware/isClient.js');

/**
 * Get all freelancer applications with related tasks and clients
 */
router.get('/', isFreelancer, async (req, res) => {
  const user = req.decoded;

  const applications = await models.Application.find({
    where: {
      freelancerId: user.freelancer.id,
    }
  }, {
    include: [
      { model: models.Task, required: false, },
      { model: models.Client, required: false, },
    ]
  });

  return res.json({
    success: true,
    data: applications,
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
      { model: models.Task, required: false, },
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
      { model: models.Task, required: false, }
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
    isAllowed = user.client && application.Task.postedBy === user.client.id;
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
        attributes: ['id', 'userId']
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
      letter: req.body.letter,
    }, { transaction });

    // associate with task
    await newApp.setTask(task, { transaction });

    // associate with freelancer
    await newApp.setFreelancer(user.freelancer, { transaction });

    //associate with client
    await newApp.setClient(task.owner, { transaction });

    // send notification to task owner
    // TODO update TO: field with user email
    /*await mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      to: task.owner.email, // list of receivers
      subject: 'New task application - Cryptotask', // Subject line
      text: `Hi, you have new application for task ${task.title} from ${task.Owner.name}`, // plain text body
    });*/

    return res.json({
      success: true,
      data: newApp
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
