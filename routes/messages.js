const express = require('express');
const router = express.Router();
const models = require('../models');
const Op = models.Sequelize.Op;
const config = require('config');
const storage = require('../lib/storage.js');

/**
 * Get array of application which have unread messages associated
 */
router.get('/unread', async (req, res) => {
  const userId = req.decoded.id;

  const data = await models.sequelize.query(`select A.id, T.title, M.text, M.createdAt
      from applications A
             right join messages M on A.id = M.applicationId
             right join (select msg.applicationId, max(msg.createdAt) createdDate
                         from Messages msg
                         where msg.read = 0 and msg.senderId != :userId group by msg.applicationId) one on one.applicationId = A.id and M.createdAt = one.createdDate
             left join Tasks T on A.taskId = T.id
      where M.read = 0
        and M.senderId != :userId
        and (A.clientId = :userId or A.freelancerId = :userId)
      group by A.id;`, {
    replacements: { userId: userId },
    type: models.sequelize.QueryTypes.SELECT,
  });

  return res.json({
    success: true,
    data: data,
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
