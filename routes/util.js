const express = require('express');
const router = express.Router();
const models = require('../models');

/**
 * Get all categories available
 */
router.get('/categories', async (req, res) => {
  const categories = await models.Category.findAll();

  return res.json({
    success: true,
    message: 'Success',
    data: categories,
  });
});

/**
 * Get all skills available
 */
router.get('/skills', async (req, res) => {
  const skills = await models.Skill.findAll();

  return res.json({
    success: true,
    message: 'Success',
    data: skills,
  });
});

/**
 * Get skills for selected category
 */
router.get('/skills/:categoryId', async (req, res) => {
  const { categoryId } = req.params;
  const skills = await models.Skill.find({
    where: {
      categoryId: categoryId
    }
  });

  return res.json({
    success: true,
    message: 'Success',
    data: skills,
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
