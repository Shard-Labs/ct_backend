const express = require('express');
const router = express.Router();

module.exports = io => {
  require('../lib/socketHandler.js')(io);
  return router;
};
