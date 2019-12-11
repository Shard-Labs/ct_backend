'use strict';
module.exports = (sequelize, DataTypes) => {
  const Freelancer = sequelize.define('Freelancer', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.firstName && this.lastName ? `${this.firstName} ${this.lastName}` : '';
      }
    },
    occupation: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    travel: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pictureId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    resume: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    published: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    linkedin: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    web: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    blog: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  }, {
    tableName: 'freelancers',
  });

  Freelancer.associate = models => {
    Freelancer.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    Freelancer.belongsTo(models.File, {
      foreignKey: 'pictureId',
      as: 'avatar',
    });

    /* Freelancer.belongsTo(models.File, {
      foreignKey: 'resumeId',
      as: 'resume',
    }); */

    Freelancer.hasMany(models.Application, {
      foreignKey: 'freelancerId',
    });

    Freelancer.hasMany(models.Invitation, {
      foreignKey: 'freelancerId',
    });

    Freelancer.hasMany(models.Link, {
      foreignKey: 'freelancerId',
      as: 'links',
    });

    Freelancer.hasMany(models.Experience, {
      foreignKey: 'freelancerId',
      as: 'workExperiences'
    });

    Freelancer.hasMany(models.Project, {
      foreignKey: 'freelancerId',
      as: 'projects'
    });

    Freelancer.belongsToMany(models.Category, {
      as: 'categories',
      through: 'freelancerCategory',
    });

    Freelancer.belongsToMany(models.Skill, {
      as: 'skills',
      through: 'freelancerSkill',
    });

    Freelancer.belongsToMany(models.Language, {
      as: 'languages',
      through: 'freelancerLanguage',
    });
  };

  return Freelancer;
};
