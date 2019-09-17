const isClient = function (req, res, next) {
  const user = req.decoded;

  console.log('user!!!!!!!!!!!!!!!', user);

  if (!user.client) {
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
