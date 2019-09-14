'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('freelancerSkill', {
      skillId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'skills', // name of Target model
          key: 'id', // key in Target model that we're referencing
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      freelancerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'freelancers', // name of Target model
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
        skill_freelancer_unique: {
          fields: ['freelancerId', 'skillId']
        }
      }
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('freelancerSkill');
  }
};
