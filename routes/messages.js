const express = require('express');
const router = express.Router();
const models = require('../models');
const Op = models.Sequelize.Op;
const config = require('config');
const storage = require('../lib/storage.js');
const multer = require('multer');
const multerS3 = require('multer-s3');

const upload = multer({
  storage: multerS3({
    s3: storage,
    bucket: config.get('storage.chatBucket'),
    acl: 'authenticated-read',
    key: function (req, file, cb) {
      const time = new Date().getTime();
      cb(null, `${req.params.applicationId}_${time}_${file.originalname}`);
    }
  })
});

/**
 * Get array of application which have unread messages associated
 */
router.get('/unread', async (req, res) => {
  const userId = req.decoded.id;

  const data = await models.sequelize.query('select A.id from Applications A right join Messages M on A.id = M.applicationId where M.read = 0 and M.senderId != :userId and (A.clientId = :userId or A.freelancerId = :userId) group by A.id;', {
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
 * Upload attachment
 */
router.post('/upload/:applicationId', upload.single('file'), async (req, res) => {
  console.log('uploading file', req.file);

  const file = req.file;

  const attachment = await models.Attachment.create({
    fileName: file.key,
    type: file.mimetype,
  });

  return res.json({
    success: true,
    data: attachment,
  });
});

/**
 * Get attachment data
 */
router.get('/attachment/:id', async (req, res) => {
  const userId = req.decoded.id;
  const attachmentId = req.params.id;
  const thumbnail = req.query.thumbnail;

  // check if user can access it
  const attachment = await models.Attachment.findByPk(attachmentId, {
    include: [{ model: models.Message }]
  });

  if (!attachment) {
    return res.status(404).json({
      success: false,
      message: 'Attachment not found',
    });
  }

  const application = await models.Application.findByPk(attachment.Message.applicationId);

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
        model: models.Attachment,
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
