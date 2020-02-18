const constants = require('../lib/constants.js');

const isClient = function (req, res, next) {
  const user = req.decoded;

  if (!user.client || user.activeRoleId !== constants.roles.CLIENT) {
    return res.status(401).json({
      success: false,
      message: 'User is not client.',
      error: 'not_client'
    });
  } else {
    next();
  }
};

module.exports = isClient;
