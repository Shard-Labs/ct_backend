'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('tasks', 'bcId', {
      allowNull: true,
      defaultValue: null,
      type: Sequelize.INTEGER,
      after: 'status',
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('tasks', 'bcId');
  }
};
