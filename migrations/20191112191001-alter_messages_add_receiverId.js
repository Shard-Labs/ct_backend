'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('messages', 'receiverId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      after: 'senderId',
      references: {
        model: 'users', // name of Target model
        key: 'id', // key in Target model that we're referencing
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('messages', 'receiverId');
  }
};
