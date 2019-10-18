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
      const type = req.body.type || 'public';
      const bucket = buckets[type];
      cb(null, bucket.bucket);
    },
    acl: (req, file, cb) => {
      const type = req.body.type || 'public';
      const item = buckets[type];
      cb(null, item ? item.permissions : 'public');
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
  const bucket = buckets[attachment.permissions];

  if (attachment.uploadedBy !== req.decoded.id) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized!',
    });
  }

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const params = {
      bucket,
      key: attachment.fileName
    };

    await storage.deleteObject(params);
    await attachment.destroy({ transaction });
    await transaction.commit();

    return res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    return res.status(500).json({
      success: false,
      message: 'Something went wrong',
    });
  }
});

/**
 * Get private file signed url
 */
router.get('/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const thumbnail = req.query.thumbnail;

  const file = await models.File.findByPk(fileId);

  if (!file) {
    return res.status(404).json({
      success: false,
      message: 'File not found',
    });
  }

  if (file.permissions === 'public') {
    return res.json({
      success: true,
      message: 'File is public, you can access it using bucket public url',
    });
  }

  try {
    const key = thumbnail ? `thumbnails/${file.fileName}` : file.fileName;
    const params = { Bucket: config.get('storage.privateBucket'), Key: key };
    const url = await storage.getSignedUrl('getObject', params);

    return res.json({
      success: true,
      data: url,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

module.exports = router;
