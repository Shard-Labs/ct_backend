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
    emailConfirmed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    confirmationHash: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    activeRoleId: {
      type: DataTypes.INTEGER,
      defaultValue: null,
    },
    lastLogin: {
      allowNull: true,
      type: DataTypes.DATE,
    },
  }, {
    tableName: 'users',
    defaultScope: {
      attributes: { exclude: ['password', 'confirmationHash', 'resetToken'] },
    },
    scopes: {
      withPassword: {
        attributes: { exclude: [] },
      }
    }
  });

  User.associate = models => {
    User.hasOne(models.Freelancer, {
      foreignKey: 'userId',
      as: 'freelancer'
    });

    User.hasOne(models.Client, {
      foreignKey: 'userId',
      as: 'client'
    });

    User.hasMany(models.Message, {
      foreignKey: 'senderId',
      as: 'messages',
    });

    User.belongsToMany(models.Role, {
      as: 'roles',
      through: 'userRole',
      foreignKey: 'userId',
      otherKey: 'roleId',
    });

    User.belongsTo(models.Role, {
      foreignKey: 'activeRoleId',
      as: 'activeRole',
    });
  };

  return User;
};
