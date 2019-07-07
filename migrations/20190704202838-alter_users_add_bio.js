'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn('Users', 'bio', {
          type: Sequelize.TEXT,
          allowNull: true,
          defaultValue: null,
        }, { transaction: t, after: 'email' }),
        queryInterface.addColumn('Users', 'picture', {
          type: Sequelize.TEXT('long'),
          allowNull: true,
          defaultValue: null,
        }, { transaction: t, after: 'bio' })
      ]);
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn('Users', 'bio', { transaction: t }),
        queryInterface.removeColumn('Users', 'picture', { transaction: t }),
      ]);
    });
  }
};
