'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('tasks', 'location', {
        type: Sequelize.ENUM('onsite', 'remote'),
        after: 'postedBy'
      }),
      queryInterface.addColumn('tasks', 'type', {
        type: Sequelize.ENUM('fulltime', 'parttime'),
        after: 'postedBy'
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('tasks', 'location'),
      queryInterface.removeColumn('tasks', 'type'),
    ]);
  }
};
