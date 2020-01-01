'use strict';
module.exports = (sequelize, DataTypes) => {
  const Feedback = sequelize.define('Feedback', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clientRate: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clientFeedback: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    freelancerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    freelancerRate: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    freelancerFeedback: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    freelancerCreatedAt: {
      allowNull: true,
      type: DataTypes.DATE
    },
  }, {
    tableName: 'feedbacks',
  });

  Feedback.associate = models => {
    Feedback.belongsTo(models.Client, {
      foreignKey: 'clientId',
      as: 'client'
    });

    Feedback.belongsTo(models.Freelancer, {
      foreignKey: 'freelancerId',
      as: 'freelancer'
    });

    Feedback.belongsTo(models.Application, {
      foreignKey: 'applicationId',
      as: 'application'
    });
  };

  return Feedback;
};
