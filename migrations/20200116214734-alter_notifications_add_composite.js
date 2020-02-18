'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addIndex('notifications', {
      fields: ['receiverId', 'type', 'referenceId'],
      unique: true,
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeIndex('notifications', 'notifications_receiver_id_type_reference_id');
  }
};
