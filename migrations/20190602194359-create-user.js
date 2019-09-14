'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      emailConfirmed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      confirmationHash: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
      },
      online: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      socketId: {
        type: Sequelize.STRING,
        defaultValue: null,
      },
      resetToken: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('users');
  }
};
