const express = require('express');
const router = express.Router();
const models = require('../models');
const mailer = require('../lib/mailer.js');
const isClient = require('../middleware/isClient.js');
const config = require('config');

/**
 * Get all invitations for task
 */
router.get('/task/:taskId', isClient, async (req, res) => {
  const { taskId } = req.params;
  const user = req.decoded;

  const invitations = await models.Invitation.find({
    where: {
      taskId,
      clientId: user.client.id
    }
  });

  return res.json({
    success: true,
    data: invitations,
  });
});

/**
 * Get single invitation
 */
router.get('/:invitationId', async (req, res) => {
  const { invitationId } = req.params;
  const user = req.decoded;

  const invitation = await models.Invitation.findByPk(invitationId, {
    include: [
      { model: models.Task, required: false, }
    ]
  });

  if (!invitation) {
    return res.status(404).json({
      success: false,
      message: 'Invitation not found',
    });
  }

  // check if current user can see invitation
  // only if invitation freelancer or client
  let isAllowed = user.freelancer && invitation.freelancerId === user.freelancer.id;

  if (!isAllowed) {
    isAllowed = user.client && invitation.Task.postedBy === user.client.id;
  }

  if (!isAllowed) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  return res.json({
    success: true,
    data: invitation,
  });
});

/**
 * Create new invitation
 * Only client can create it if already doesn't exist
 */
router.post('/', isClient, async (req, res) => {
  const taskId = req.body.taskId;
  const freelancerId = req.body.freelancerId;
  const user = req.decoded;

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    // get task data with client (owner)
    const task = await models.Task.findByPk(taskId, {
      include: [{
        model: models.Client,
        as: 'owner',
        attributes: ['id', 'userId', 'name'],
        include: [
          { model: models.User },
        ],
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

    // get invitation for selected task and freelancer if exists
    const invitation = await models.Invitation.findOne({
      where: {
        taskId: taskId,
        freelancerId,
      },
    }, { transaction });

    // if invitation already created
    if (invitation) {
      if (transaction) await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: 'You have already invited this freelancer for this task',
      });
    }

    // make new invitation
    const newInvitation = await models.Invitation.create({
      freelancerId: req.body.freelancerId,
      taskId: req.body.taskId,
      clientId: user.client.id,
      letter: req.body.letter,
    }, { transaction });

    // send notification to freelancer
    const freelancer = await models.Freelancer.findByPk(freelancerId,{
      include: [
        { model: models.User, attributes: ['email'] }
      ]
    })
    const content = `<html><body><p>Hi, you have new invitation for task <span style='font-weight:bold;'>${task.title}</span>`
                    +` from <span style='font-weight:bold;'>${task.owner.name}</span>.</p>`
                    +'<p>Click this link to visit our site: </p>'
                    +`<a href='${config.get('frontendUrl')}'>Visit CRYPTOTASK!</a></body></html>`;
    await mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      // to: task.owner.User.email, list of receivers
      to: `<${freelancer.User.email}>`, // list of receivers
      subject: 'New task invitation - Cryptotask', // Subject line
      text: `Hi, you have new invitation for task ${task.title} from ${task.owner.name}`, // plain text body
      html: content
    });

    await transaction.commit();

    return res.json({
      success: true,
      data: newInvitation
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
