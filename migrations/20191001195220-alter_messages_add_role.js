'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('messages', 'role', {
      type: Sequelize.STRING,
      after: 'senderId'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('messages', 'role');
  }
};
