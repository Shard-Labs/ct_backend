const models = require('../models');
const mailer = require('./mailer.js');
const config = require('config');

module.exports = class NotificationsSender {
  /**
   * @param {String} type - notification type
   * @param {Object} to - user object
   * @param {Object} payload - data to be saved to notification
   * @param {Integer} referenceId - reference of related object
   * @param {Object} io - socket io instance
   */
  constructor(type, to, payload, referenceId, io) {
    this.type = type;
    this.to = to;
    this.payload = payload;
    this.referenceId = referenceId;
    this.io = io;
  }

  async send() {
    console.log('sending notification!!!');
    if (!(this.to instanceof models.User)) {
      this.to = await models.User.findByPk(this.to);
    }

    this.notification = await this._create();

    console.log('created notification', this.notification.id);

    Promise.all([
      this._emit(),
      // this._email(),
    ]);
  }

  /**
   * If user is online emit him notification
   * @return {boolean}
   * @private
   */
  _emit() {
    if (this.io && this.to.online && this.to.socketId) {
      console.log('emitting notification');
      this.io.to(this.to.socketId).emit('receivedNotification', this.notification);
    }

    return true;
  }

  /**
   * If user is not online send him an email message
   * @private
   */
  _email() {
    if (!this.io || !this.to.online || !this.to.socketId) {
      console.log('emailing notification');

      mailer.send({
        template: 'notification' + this.type,
        message: {
          to: this.to.email
        },
        locals: this.payload,
      });
    }
  }

  /**
   * Create notification record in database
   * @return {*}
   * @private
   */
  _create() {
    return models.Notification.create({
      receiverId: this.to.id,
      type: this.type,
      payload: this.payload,
      referenceId: this.referenceId,
    })
  }
};
