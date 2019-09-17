const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * Get all categories available
 */
router.get('/categories', async (req, res) => {
  const categories = await models.Category.findAll({
    include: [{
      model: models.Skill,
      as: 'skills',
    }]
  });

  return res.json({
    success: true,
    message: 'Success',
    data: categories,
  });
});

/**
 * Get all languages available
 */
router.get('/languages', async (req, res) => {
  const languages = await models.Language.findAll();

  return res.json({
    success: true,
    message: 'Success',
    data: languages,
  });
});

module.exports = router;
