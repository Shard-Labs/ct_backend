'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('freelancerProjectImage', {
      fileId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'files', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      freelancerProjectId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'freelancerProjects', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }, {
      uniqueKeys: {
        freelancer_project_file_unique: {
          fields: ['freelancerProjectId', 'fileId']
        }
      }
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('freelancerProjectImage');
  }
};
