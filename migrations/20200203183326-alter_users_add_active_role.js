'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('users', 'activeRoleId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        after: 'socketId',
        references: {
          model: 'roles', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'RESTRICT',
        onDelete: 'RESTRICT',
      }),
      queryInterface.addColumn('users', 'lastLogin', {
        allowNull: true,
        type: Sequelize.DATE,
        after: 'socketId',
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('users', 'activeRoleId'),
      queryInterface.removeColumn('users', 'lastLogin'),
    ]);
  }
};
