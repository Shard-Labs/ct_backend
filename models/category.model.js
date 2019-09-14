'use strict';
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
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
    tableName: 'categories',
  });

  Category.associate = models => {
    Category.belongsToMany(models.Freelancer, {
      as: 'freelancers',
      through: 'freelancerCategory'
    });
  };

  return Category;
};
