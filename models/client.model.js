'use strict';
module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define('Client', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    pictureId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    about: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  }, {
    tableName: 'clients',
  });

  Client.associate = models => {
    Client.belongsTo(models.User, {
      foreignKey: 'userId',
    });

    Client.belongsTo(models.File, {
      foreignKey: 'pictureId',
      as: 'avatar',
    });

    Client.hasMany(models.Task, {
      foreignKey: 'postedBy',
    });

    Client.hasMany(models.Application, {
      foreignKey: 'clientId',
    });

    Client.hasMany(models.Invitation, {
      foreignKey: 'clientId',
    });
  };

  return Client;
};
