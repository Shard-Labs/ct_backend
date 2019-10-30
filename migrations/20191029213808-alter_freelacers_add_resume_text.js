'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('freelancers', 'resume', {
      type: Sequelize.TEXT,
      after: 'resumeId'
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('freelancers', 'resume');
  }
};
