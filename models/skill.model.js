'use strict';
module.exports = (sequelize, DataTypes) => {
  const Skill = sequelize.define('Skill', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'skills',
  });

  Skill.associate = models => {
    Skill.belongsTo(models.Category, {
      foreignKey: 'categoryId',
    });

    Skill.belongsToMany(models.Freelancer, {
      as: 'freelancers',
      through: 'freelancerSkill'
    });

    Skill.belongsToMany(models.Task, {
      as: 'tasks',
      through: 'taskSkill'
    });
  };

  return Skill;
};
