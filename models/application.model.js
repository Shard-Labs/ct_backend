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
      allowNull: false,
    },
    freelancerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });

  Application.associate = models => {
    Application.belongsTo(models.Task, {
      foreignKey: 'taskId'
    });

    Application.belongsTo(models.User, {
      foreignKey: 'freelancerId',
      as: 'Freelancer'
    });
  };

  return Application;
};
