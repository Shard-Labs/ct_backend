'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('applications', 'lastMessageId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: 'status',
      references: {
        model: 'messages', // name of Target model
        key: 'id', // key in Target model that we're referencing
      },
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('applications', 'lastMessageId');
  }
};
