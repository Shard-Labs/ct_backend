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
          { model: models.User, as: 'user' },
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
        { model: models.User, as: 'user', attributes: ['email'] }
      ]
    });
    const link = `<a href='${config.get('frontendUrl')}/tasks/${task.id}'>CryptoTask</a>`;
    const logo = `<a href='${config.get('frontendUrl')}'><img alt='cryptotask' src='cid:logo@cryptotask' style='width:9rem;'/></a>`;
    const content = '<html><head></head><body><h5>Hello,<br> you have been invited from '
                    +`${task.owner.name} for project ${task.title}.`
                    +`<br>Visit ${link} to review the invitation.</h5>`
                    +`<h5>${task.owner.name} sent you this message with the application:</h5><p>${newInvitation.letter}</p>`
                    +`<h5>Thank you for being part of the CryptoTask family.</h5><p>${logo}</p></body></html>`;
    await mailer.sendMail({
      from: config.get('email.defaultFrom'), // sender address
      // to: task.owner.User.email, list of receivers
      to: `<${freelancer.user.email}>`, // list of receivers
      subject: 'New task invitation - Cryptotask', // Subject line
      text: `Hello, you have been invited from ${task.owner.name} for project ${task.title}. `
            +`Visit ${config.get('frontendUrl')}/tasks/${task.id} to review the invitation. `
            +`${task.owner.name} sent you this message with the application: ${newInvitation.letter}`
            +'Thank you for being part of the CryptoTask family.', // plain text body
      html: content, // html body
      attachments: [{
        filename: 'logo.png',
        path: __dirname + '/../assets/Logo/Cryptotask-logo.png',
        cid: 'logo@cryptotask'
      }], // attach logo to html
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
