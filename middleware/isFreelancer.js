const isFreelancer = function (req, res, next) {
  const user = req.decoded;

  if (!user.freelancer) {
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
