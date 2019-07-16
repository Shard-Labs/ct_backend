'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn('Users', 'resetToken', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: null,
        }, { transaction: t, after: 'email' }),
        queryInterface.addIndex('Users', ['resetToken'], { transaction: t, unique: true }),
      ]);
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn('Users', 'resetToken', { transaction: t }),
      ]);
    });
  }
};
