'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('freelancers', 'featured', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      after: 'published'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('freelancers', 'featured');
  }
};
