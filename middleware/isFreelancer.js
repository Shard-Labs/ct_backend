const constants = require('../lib/constants.js');

const isFreelancer = function (req, res, next) {
  const user = req.decoded;

  if (!user.freelancer || user.activeRoleId !== constants.roles.FREELANCER) {
    return res.status(401).json({
      success: false,
      message: 'User is not freelancer.',
      error: 'not_freelancer'
    });
  } else {
    next();
  }
};

module.exports = isFreelancer;
