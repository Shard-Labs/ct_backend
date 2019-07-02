'use strict';
module.exports = (sequelize, DataTypes) => {
  const Attachment = sequelize.define('Attachment', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  Attachment.associate = models => {
    Attachment.belongsTo(models.Message, {
      foreignKey: 'messageId'
    });
  };

  return Attachment;
};
