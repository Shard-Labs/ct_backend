'use strict';
module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define('Role', {
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
    tableName: 'roles',
  });

  Role.associate = models => {
    Role.belongsToMany(models.User, {
      as: 'users',
      through: 'userRole',
      foreignKey: 'roleId',
      otherKey: 'userId',
    });
  };

  return Role;
};
