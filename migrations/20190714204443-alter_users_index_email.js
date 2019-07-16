'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addIndex('Users', ['email'], { transaction: t, unique: true }),
        queryInterface.addIndex('Users', ['confirmationHash'], { transaction: t, unique: true }),
      ]);
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeIndex('Users', 'users_email', { transaction: t }),
        queryInterface.removeIndex('Users', 'users_confirmationHash', { transaction: t }),
      ]);
    });
  }
};
