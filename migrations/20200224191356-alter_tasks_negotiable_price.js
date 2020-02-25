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
      }),
      queryInterface.changeColumn('tasks', 'price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      }),
      queryInterface.changeColumn('tasks', 'duration', {
        type: Sequelize.INTEGER,
        allowNull: true
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('tasks', 'negotiablePrice'),
      queryInterface.removeColumn('tasks', 'negotiableDuration'),
      queryInterface.changeColumn('tasks', 'price', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      }),
      queryInterface.changeColumn('tasks', 'duration', {
        type: Sequelize.INTEGER,
        allowNull: false
      }),
    ]);
  }
};
