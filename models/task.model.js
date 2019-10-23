'use strict';
module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define('Task', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    postedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    location: {
      type: DataTypes.ENUM('onsite', 'remote'),
    },
    type: {
      type: DataTypes.ENUM('fulltime', 'parttime'),
    },
  }, {
    tableName: 'tasks',
    paranoid: true,
  });

  Task.associate = models => {
    Task.belongsTo(models.Client, {
      foreignKey: 'postedBy',
      as: 'owner',
    });

    Task.hasMany(models.Application, {
      foreignKey: 'taskId',
      as: 'applications',
    });

    Task.hasMany(models.Invitation, {
      foreignKey: 'taskId',
      as: 'invitations',
    });

    Task.belongsToMany(models.File, {
      as: 'attachments',
      through: 'fileTask',
    });

    Task.belongsToMany(models.Skill, {
      as: 'skills',
      through: 'taskSkill',
    });
  };

  return Task;
};
