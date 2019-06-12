const Sequelize = require('sequelize');
const config = require('config');

const sequelize = new Sequelize(config.get('db.database'), config.get('db.username'), config.get('db.password'), {
  host: config.get('db.host'),
  dialect: 'mysql',
});

module.exports = sequelize;
