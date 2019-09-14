'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('roles', [{
      name: 'freelancer',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'client',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'administrator',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('roles', null, {});
  }
};
