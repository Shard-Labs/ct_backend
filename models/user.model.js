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
  };

  return User;
};
