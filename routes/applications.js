const express = require('express');
const router = express.Router();
const models = require('../models');

router.get('/:applicationId', async (req, res) => {
  const { applicationId } = req.params;
  const userId = req.decoded.id;

  const application = await models.Application.findByPk(applicationId, {
    include: [
      { model: models.Task, required: false, }
    ]
  });

  if (!application) {
    return res.status(404).json({
      success: false,
      message: 'Application not found',
    });
  }

  if (application.freelancerId !== userId && application.Task.postedBy !== userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  return res.json({
    success: true,
    data: application,
  });
});

module.exports = router;
