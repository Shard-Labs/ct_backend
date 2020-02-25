'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('tasks', 'negotiablePrice', {
        allowNull: false,
        defaultValue: false,
        type: Sequelize.BOOLEAN,
        after: 'price',
      }),
      queryInterface.addColumn('tasks', 'negotiableDuration', {
        allowNull: false,
        defaultValue: false,
        type: Sequelize.BOOLEAN,
        after: 'duration',
      })
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('tasks', 'negotiablePrice'),
      queryInterface.removeColumn('tasks', 'negotiableDuration')
    ]);
  }
};
