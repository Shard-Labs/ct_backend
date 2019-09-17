'use strict';
module.exports = (sequelize, DataTypes) => {
  const Experience = sequelize.define('Experience', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    freelancerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    company: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    from: {
      allowNull: true,
      type: DataTypes.DATE
    },
    to: {
      allowNull: true,
      type: DataTypes.DATE
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'freelancerExperiences'
  });

  Experience.associate = models => {
    Experience.belongsTo(models.Freelancer, {
      foreignKey: 'freelancerId'
    });
  };

  return Experience;
};
