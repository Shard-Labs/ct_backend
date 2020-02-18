const FeedbackChecker = require('../lib/FeedbackChecker.js');

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
      allowNull: true,
      get() {
        const fr = this.getDataValue('freelancerRate');

        if (!fr && !FeedbackChecker.isVisible(this.getDataValue('createdAt'))) {
          return null;
        }

        return this.getDataValue('clientRate');
      }
    },
    clientFeedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const fr = this.getDataValue('freelancerRate');

        if (!fr && !FeedbackChecker.isVisible(this.getDataValue('createdAt'))) {
          return null;
        }

        return this.getDataValue('clientFeedback');
      }
    },
    clientCreatedAt: {
      allowNull: true,
      type: DataTypes.DATE
    },
    freelancerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    freelancerRate: {
      type: DataTypes.INTEGER,
      allowNull: true,
      get() {
        const fr = this.getDataValue('clientRate');

        if (!fr && !FeedbackChecker.isVisible(this.getDataValue('createdAt'))) {
          return null;
        }

        return this.getDataValue('freelancerRate');
      }
    },
    freelancerFeedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const fr = this.getDataValue('clientRate');

        if (!fr && !FeedbackChecker.isVisible(this.getDataValue('createdAt'))) {
          return null;
        }

        return this.getDataValue('freelancerFeedback');
      }
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
