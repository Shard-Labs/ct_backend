const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * Get all user unseen notifications
 */
router.get('/', async (req, res) => {
  const user = req.decoded;
  const notifications = await models.Notification.findAll({
    where: {
      receiverId: user.id,
    }
  });

  return res.json({
    success: true,
    message: 'Success',
    data: notifications,
  });
});

/**
 * Delete notification when seen
 */
router.put('/:notificationId/seen', async (req, res) => {
  const user = req.decoded;

  const notification = await models.Notification.findByPk(req.params.notificationId);

  if (notification) {
    if (notification.receiverId !== user.id) {
      return res.status(401).json({
        success: false,
        message: 'Not allowed',
      });
    }

    await notification.destroy();

    return res.json({
      success: true,
      message: 'Success',
    });
  }
});

module.exports = router;
