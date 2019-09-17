'use strict';
module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define('Project', {
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
    pictureId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'freelancerProjects'
  });

  Project.associate = models => {
    Project.belongsTo(models.Freelancer, {
      foreignKey: 'freelancerId'
    });

    Project.belongsTo(models.File, {
      foreignKey: 'pictureId',
      as: 'cover',
    });

    Project.belongsToMany(models.File, {
      as: 'images',
      through: 'freelancerProjectImage',
      foreignKey: 'freelancerProjectId',
      otherKey: 'fileId',
    });
  };

  return Project;
};
