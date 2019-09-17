const express = require('express');
const router = express.Router();
const models = require('../models');
const config = require('config');
const storage = require('../lib/storage.js');
const multer = require('multer');
const multerS3 = require('multer-s3');

const buckets = {
  private: { bucket: config.get('storage.privateBucket'), permissions: 'private' },
  public: { bucket: config.get('storage.publicBucket'), permissions: 'public-read' },
};

const upload = multer({
  storage: multerS3({
    s3: storage,
    bucket: (req, file, cb) => {
      const type = req.body.type || 'private';
      const bucket = buckets[type];
      cb(null, bucket.bucket);
    },
    acl: (req, file, cb) => {
      const type = req.body.type || 'private';
      const item = buckets[type];
      cb(null, item ? item.permissions : 'private');
    },
    key: (req, file, cb) => {
      const time = new Date().getTime();
      cb(null, `${time}_${file.originalname}`);
    }
  })
});

/**
 * Upload attachment
 */
router.post('/', upload.single('file'), async (req, res) => {
  const file = req.file;

  const attachment = await models.File.create({
    fileName: file.key,
    type: file.mimetype,
    permissions: req.body.type,
    uploadedBy: req.decoded.id,
  });

  return res.json({
    success: true,
    data: attachment,
  });
});

/**
 * Upload multiple attachments
 */
router.post('/multiple', upload.array('files'), async (req, res) => {
  const files = req.files;

  const attachments = await models.File.bulkCreate(files.map(file => ({
    fileName: file.key,
    type: file.mimetype,
    permissions: req.body.type,
    uploadedBy: req.decoded.id,
  })));

  return res.json({
    success: true,
    data: attachments,
  });
});

/**
 * Delete file
 */
router.delete('/:fileId', async (req, res) => {
  const attachment = await models.File.findByPk(req.params.fileId);
  const type = req.query.type;
  const bucket = buckets[type] || config.get('storage.filesBucket');

  if (attachment.uploadedBy !== req.decoded.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized!',
    });
  }

  try {
    const params = {
      bucket,
      key: attachment.fileName
    };

    await storage.deleteObject(params);
    await attachment.destroy();

    return res.json({
      success: true,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
      data: err
    });
  }
});

router.get('/:fileId', async (req, res) => {
  const user = req.decoded;
  const { fileId } = req.params;
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

module.exports = router;
