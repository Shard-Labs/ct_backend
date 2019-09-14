const express = require('express');
const router = express.Router();
const models = require('../models');
const config = require('config');
const storage = require('../lib/storage.js');
const multer = require('multer');
const multerS3 = require('multer-s3');

const buckets = {
  chat: { bucket: config.get('storage.chatBucket'), permissions: 'private' },
  task: { bucket: config.get('storage.taskAttachmentsBucket'), permissions: 'public-read' },
};

const upload = multer({
  storage: multerS3({
    s3: storage,
    bucket: (req, file, cb) => {
      const type = req.query.type || config.get('storage.filesBucket');
      const bucket = buckets[type];
      cb(null, bucket.bucket);
    },
    acl: (req, file, cb) => {
      const type = req.query.type;
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
    uploadedBy: req.decoded.id,
  });

  return res.json({
    success: true,
    data: attachment,
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

module.exports = router;
