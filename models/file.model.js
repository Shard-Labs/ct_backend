'use strict';
module.exports = (sequelize, DataTypes) => {
  const File = sequelize.define('File', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });

  File.associate = models => {
    File.belongsToMany(models.Message, {
      as: 'Messages',
      through: 'FileMessage',
    });
  };

  return File;
};
