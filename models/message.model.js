'use strict';
module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    text: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'messages',
  });

  Message.associate = models => {
    Message.belongsTo(models.Application, {
      foreignKey: 'applicationId'
    });

    Message.belongsTo(models.User, {
      foreignKey: 'senderId',
      as: 'sender'
    });

    Message.belongsToMany(models.File, {
      as: 'attachments',
      through: 'fileMessage',
    });
  };

  return Message;
};
