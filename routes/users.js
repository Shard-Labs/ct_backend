const express = require('express');
const router = express.Router();
const models = require('../models');

/* GET users listing. */
router.get('/me', async (req, res) => {
  const id = req.decoded.id;

  if (id) {
    try {
      const user = await models.User.findByPk(id);

      return res.json({
        success: true,
        message: 'Success',
        data: user,
      });
    } catch(err) {
      return res.status(400).json({
        success: false,
        message: 'Something went wrong',
        data: err
      });
    }
  }
});

module.exports = router;
