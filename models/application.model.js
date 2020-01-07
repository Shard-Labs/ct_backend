'use strict';
module.exports = (sequelize, DataTypes) => {
  const Application = sequelize.define('Application', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    taskId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    freelancerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    invitationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    letter: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'applications',
  });

  Application.associate = models => {
    Application.hasMany(models.Message, {
      foreignKey: 'applicationId'
    });

    Application.belongsTo(models.Task, {
      foreignKey: 'taskId',
      as: 'task',
    });

    Application.belongsTo(models.Invitation, {
      foreignKey: 'invitationId'
    });

    Application.belongsTo(models.Client, {
      foreignKey: 'clientId',
      as: 'client',
    });

    Application.belongsTo(models.Freelancer, {
      foreignKey: 'freelancerId',
      as: 'freelancer',
    });

    Application.belongsTo(models.Message, {
      foreignKey: 'lastMessageId',
      as: 'lastMessage',
    });

    Application.hasOne(models.Feedback, {
      foreignKey: 'applicationId',
      as: 'feedback',
    });
  };

  return Application;
};
