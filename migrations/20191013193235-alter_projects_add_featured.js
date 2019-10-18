'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('tasks', 'featured', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      after: 'postedBy'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('tasks', 'featured');
  }
};
