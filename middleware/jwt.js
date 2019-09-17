const jwt = require('jsonwebtoken');
const config = require('config');
const models = require('../models');

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
      models.User.findByPk(decoded.id, {
        include: [
          {
            model: models.Freelancer, as: 'freelancer', include: [
              { model: models.File, as: 'avatar' },
              { model: models.File, as: 'resume' },
              { model: models.Skill, as: 'skills' },
              { model: models.Category, as: 'categories' },
              { model: models.Experience, as: 'workExperiences' },
              {
                model: models.Project, as: 'projects', include: [
                  { model: models.File, as: 'cover' },
                  { model: models.File, as: 'images' },
                ]
              },
            ]
          },
          { model: models.Client, as: 'client' },
          { model: models.Role, as: 'roles' },
        ]
      }).then((user) => {
        req.decoded = user;
        next();
      });
    }
  });
};

module.exports = {
  checkToken: checkToken
};
