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
      from Applications A
             right join Messages M on A.id = M.applicationId
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
  const application = await models.Application.findByPk(applicationId);

  if (userId !== application.clientId && userId !== application.freelancerId) {
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
 * Get attachment data
 */
router.get('/:messageId/attachment/:id', async (req, res) => {
  const userId = req.decoded.id;
  const attachmentId = req.params.id;
  const messageId = req.params.messageId;
  const thumbnail = req.query.thumbnail;

  // check if user can access it
  const attachment = await models.File.findByPk(attachmentId);

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found',
    });
  }

  const message = await models.Message.findByPk(messageId);
  const application = await models.Application.findByPk(message.applicationId);

  if (application.clientId !== userId && application.freelancerId !== userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  const key = thumbnail ? `thumbnails/${attachment.fileName}` : attachment.fileName;
  const params = { Bucket: config.get('storage.chatBucket'), Key: key };
  const url = await storage.getSignedUrl('getObject', params);

  return res.json({
    success: true,
    data: url
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
    include: [models.Task]
  });

  // check if current user can access application messages
  if (userId === application.freelancerId || userId === application.Task.postedBy) {
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
        as: 'Sender'
      }, {
        model: models.File,
        as: 'Attachments'
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
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized',
  });
});

module.exports = router;
