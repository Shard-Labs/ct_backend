const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * Post new message
 */
router.post('/:applicationId', async (req, res) => {
  const userId = req.decoded.id;
  const applicationId = req.params.applicationId;

  const application = await models.Application.findByPk(applicationId, {
    include: [models.Task]
  });

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found',
    });
  }

  // check if current user can write to selected application messages
  if (userId === application.freelancerId || userId === application.Task.postedBy) {
    const message = await models.Message.create({
      senderId: userId,
      applicationId: applicationId,
      text: req.body.text
    });

    message.setDataValue('Sender', await message.getSender());

    return res.json({
      success: true,
      data: message
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized',
  });
});

/**
 * Get all messages for task application
 */
router.get('/:applicationId', async (req, res) => {
  const userId = req.decoded.id;
  const applicationId = req.params.applicationId;

  const application = await models.Application.findByPk(applicationId, {
    include: [models.Task]
  });

  // check if current user can access application messages
  if (userId === application.freelancerId || userId === application.Task.postedBy) {
    const messages = await models.Message.findAll({
      where: {
        applicationId: req.params.applicationId,
      },
      include: [{
        model: models.User,
        as: 'Sender'
      }]
    });

    return res.json({
      success: true,
      data: messages
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized',
  });
});

module.exports = router;
