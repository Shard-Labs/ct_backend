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
  }, {
    tableName: 'languages',
  });

  Language.associate = models => {
    Language.belongsToMany(models.Freelancer, {
      as: 'freelancers',
      through: 'freelancerLanguage'
    });
  };

  return Language;
};
