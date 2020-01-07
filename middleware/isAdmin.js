const isAdmin = function (req, res, next) {
  const user = req.decoded;

  if (!user.roles.find(r => r.name === 'admin')) {
    return res.status(401).json({
      success: false,
      message: 'User is not administrator.',
      error: 'not_admin'
    });
  } else {
    next();
  }
};

module.exports = isAdmin;
