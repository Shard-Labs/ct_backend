'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
    },
    bio: {
      type: DataTypes.TEXT,
      defaultValue: null,
    },
    picture: {
      type: DataTypes.TEXT('long'),
      defaultValue: null,
    },
    emailConfirmed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    confirmationHash: {
      type: DataTypes.STRING,
    },
    online: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    socketId: {
      type: DataTypes.STRING,
      defaultValue: null,
    },
  }, {
    defaultScope: {
      attributes: { exclude: ['password', 'confirmationHash'] },
    },
    scopes: {
      withPassword: {
        attributes: { exclude: [] },
      }
    }
  });

  User.associate = models => {
    User.hasMany(models.Task, {
      foreignKey: 'postedBy'
    });

    User.hasMany(models.Application, {
      foreignKey: 'freelancerId'
    });

    User.belongsToMany(models.Skill, {
      as: 'Skills',
      through: 'SkillUser'
    });

    User.belongsToMany(models.Language, {
      as: 'Languages',
      through: 'LanguageUser'
    });
  };

  return User;
};
