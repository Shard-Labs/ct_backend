'use strict';
module.exports = (sequelize, DataTypes) => {
  const Link = sequelize.define('Link', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    freelancerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    link: {
      allowNull: true,
      type: DataTypes.STRING
    },
  }, {
    tableName: 'freelancerLinks'
  });

  Link.associate = models => {
    Link.belongsTo(models.Freelancer, {
      foreignKey: 'freelancerId'
    });
  };

  return Link;
};
