const jwt = require('jsonwebtoken');
const config = require('config');

const checkToken = function (req, res, next) {
  let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token is not valid',
      error: 'token_not_provided'
    });
  }

  if (token.startsWith('Bearer ')) {
    // Remove Bearer from string
    token = token.slice(7, token.length);
  }

  jwt.verify(token, config.get('jwt.secret'), (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid',
        error: 'invalid_token'
      });
    } else {
      req.decoded = decoded;
      next();
    }
  });
};

module.exports = {
  checkToken: checkToken
};
