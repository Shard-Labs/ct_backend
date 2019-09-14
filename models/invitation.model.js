'use strict';
module.exports = (sequelize, DataTypes) => {
  const Invitation = sequelize.define('Invitation', {
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
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    freelancerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    letter: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'invitations',
  });

  Invitation.associate = models => {
    Invitation.belongsTo(models.Task, {
      foreignKey: 'taskId'
    });

    Invitation.belongsTo(models.Client, {
      foreignKey: 'clientId',
    });

    Invitation.belongsTo(models.Freelancer, {
      foreignKey: 'freelancerId',
    });
  };

  return Invitation;
};
