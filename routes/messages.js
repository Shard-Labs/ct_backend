const express = require('express');
const router = express.Router();
const models = require('../models');
const Op = models.Sequelize.Op;
const constants = require('../lib/constants.js');

/**
 * Get all message threads for current user
 */
router.get('/threads', async (req, res) => {
  const user = req.decoded;
  const userConditions = [];

  if (user.freelancer) {
    userConditions.push({
      freelancerId: user.freelancer.id,
    });
  }

  if (user.client) {
    userConditions.push({
      clientId: user.client.id,
    });
  }

  const data = await models.Application.findAll({
    where: {
      [Op.or]: userConditions,
      status: {
        [Op.lte]: constants.applicationStatuses.ACCEPTED,
      },
    },
    include: [
      {
        model: models.Freelancer, as: 'freelancer', include: [
          { model: models.File, as: 'avatar' },
          { model: models.User, as: 'user' },
        ]
      },
      {
        model: models.Client, as: 'client', include: [
          { model: models.File, as: 'avatar' },
          { model: models.User, as: 'user' },
        ]
      },
      {
        model: models.Task,
        as: 'task',
        attributes: ['title']
      },
      {
        model: models.Message,
        as: 'lastMessage',
        required: false,
        include: [{
          model: models.User,
          as: 'sender',
          required: false,
          include: [
            { model: models.Freelancer, as: 'freelancer', required: false, },
            { model: models.Client, as: 'client', required: false, },
          ]
        }],
      }
    ]
  });

  return res.json({
    success: true,
    data,
  });
});

/**
 * Get array of application which have unread messages associated
 */
router.get('/unread', async (req, res) => {
  const userId = req.decoded.id;

  // language=MySQL
  const data = await models.sequelize.query(`WITH msgs AS (
  SELECT m.*, ROW_NUMBER() OVER(PARTITION BY applicationId ORDER BY id DESC) AS rn
  FROM messages AS m
  WHERE m.read = 0
    AND m.receiverId = :userId
)
SELECT m.*, t.title, a.taskId, a.clientId, a.freelancerId, c.name AS clientName, f.firstName, f.lastName
FROM msgs AS m
       LEFT JOIN applications AS a ON m.applicationId = a.id
       LEFT JOIN tasks AS t ON a.taskId = t.id
       LEFT JOIN clients AS c ON a.clientId = c.id
       LEFT JOIN freelancers f on a.freelancerId = f.id
WHERE m.rn = 1;`, {
    replacements: { userId: userId },
    type: models.sequelize.QueryTypes.SELECT,
  });

  const messages = data.map(m => ({
    id: m.id,
    text: m.text,
    task: m.title,
    createdAt: m.createdAt,
    applicationId: m.applicationId,
    taskId: m.taskId,
    senderId: m.role === 'client' ? m.clientId : m.freelancerId,
    senderName: m.role === 'client' ? m.clientName : `${m.firstName} ${m.lastName}`,
  }));

  return res.json({
    success: true,
    data: messages,
  });
});

/**
 * Set messages as read for selected application
 */
router.put('/read/:applicationId', async (req, res) => {
  const userId = req.decoded.id;
  const { applicationId } = req.params;

  // check if user can update application
  const application = await models.Application.findByPk(applicationId, {
    include: [
      { model: models.Client, as: 'client' },
      { model: models.Freelancer, as: 'freelancer' },
    ]
  });

  if (userId !== application.client.userId && userId !== application.freelancer.userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  await models.Message.update(
    { read: true },
    {
      where: {
        applicationId: applicationId,
        senderId: {
          [Op.ne]: userId
        }
      }
    }
  );

  return res.json({
    success: true,
  });
});

/**
 * Get all messages for task application
 */
router.get('/:applicationId', async (req, res) => {
  const userId = req.decoded.id;
  const applicationId = req.params.applicationId;
  const perPage = 20;
  const lastId = req.query.lastId;

  const application = await models.Application.findByPk(applicationId, {
    include: [
      { model: models.Client, as: 'client' },
      { model: models.Freelancer, as: 'freelancer' },
    ]
  });

  // check if user has access to messages
  if (userId !== application.client.userId && userId !== application.freelancer.userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  const conditions = {
    applicationId: req.params.applicationId,
  };

  if (lastId) {
    conditions['id'] = {
      [Op.lt]: lastId,
    };
  }

  const messages = await models.Message.findAll({
    where: conditions,
    include: [{
      model: models.User,
      as: 'sender',
      include: [
        {
          model: models.Freelancer, as: 'freelancer', include: [
            { model: models.File, as: 'avatar' },
          ]
        },
        {
          model: models.Client, as: 'client', include: [
            { model: models.File, as: 'avatar' },
          ]
        },
        { model: models.Role, as: 'roles' },
      ]
    }, {
      model: models.File,
      as: 'attachments'
    }],
    limit: perPage,
    order: [
      ['id', 'DESC'],
    ],
  });

  // get total of messages for pagination
  const total = await models.Message.count({
    where: {
      applicationId: applicationId,
    }
  });

  return res.json({
    success: true,
    data: { messages, total }
  });
});

module.exports = router;
