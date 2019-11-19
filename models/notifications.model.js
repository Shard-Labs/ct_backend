'use strict';
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payload: {
      type: DataTypes.TEXT,
      allowNull: false,
      set: function(v) {
        this.setDataValue('payload', JSON.stringify(v));
      },
      get: function() {
        const value = this.getDataValue('payload');
        return value ? JSON.parse(value) : null;
      }
    },
    referenceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'notifications',
  });

  Notification.associate = models => {
    Notification.belongsTo(models.User, {
      foreignKey: 'receiverId',
      as: 'receiver'
    });
  };

  return Notification;
};
