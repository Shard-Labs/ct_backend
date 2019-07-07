'use strict';
module.exports = (sequelize, DataTypes) => {
  const Language = sequelize.define('Language', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nativeName: {
      type: DataTypes.STRING,
    },
  });

  Language.associate = models => {
    Language.belongsToMany(models.User, {
      as: 'Users',
      through: 'LanguageUser'
    });
  };

  return Language;
};
