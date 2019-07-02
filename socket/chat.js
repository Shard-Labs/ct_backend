const models = require('../models');
const Op = models.Sequelize.Op;
const mailer = require('../lib/mailer.js');
const config = require('config');

class Chat {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.decoded_token.id;
  }

  /**
   * Set user status to online
   * @return {Promise<void>}
   */
  async setUserOnline() {
    console.log('setting user as online', this.userId);
    const user = await models.User.findByPk(this.userId);
    user.online = true;
    user.socketId = this.socket.id;
    await user.save();
  }

  /**
   * Set user status to offline
   * @return {Promise<void>}
   */
  async setUserOffline() {
    const user = await models.User.findByPk(this.userId);
    user.online = false;
    user.socketId = null;
    await user.save();
  }

  /**
   * Subscribe user to socket room created from application ID
   * @param {Number} applicationId
   * @return {Promise<void>}
   */
  async subscribe(applicationId) {
    console.log('subscribing to application', applicationId, this.socket.decoded_token);

    const application = await models.Application.findByPk(applicationId, {
      include: [models.Task]
    });

    // check if user can be subscribed
    if (application && this.userId === application.freelancerId || this.userId === application.Task.postedBy) {
      this.socket.join(applicationId);
      this.socket.emit('subscribed');
      this.io.to(applicationId).emit('userSubscribed', this.userId);
    }
  }

  /**
   * Unsubscribe user from socket room
   * @param {Number} applicationId
   * @return {Promise<void>}
   */
  async unsubscribe(applicationId) {
    console.log('unsubscribing from application', applicationId);

    this.socket.leave(applicationId);
    this.socket.emit('unsubscribed');
    this.io.to(applicationId).emit('userUnsubscribed', this.userId);
  }

  /**
   * Send message
   * @param {String} text
   * @param {Number} applicationId
   * @param {Array} [attachmentIds] - if there are attachments in message send their ids (optional)
   * @return {Promise<void>}
   */
  async sendMessage({ text, applicationId, attachmentIds }) {
    console.log('send message', applicationId, text, this.userId);

    const application = await models.Application.findByPk(applicationId, {
      include: [models.Task]
    });

    // check if user can send messages to this application
    if (application && this.userId === application.freelancerId || this.userId === application.Task.postedBy) {
      const message = await models.Message.create({
        senderId: this.userId,
        applicationId: applicationId,
        text: text
      });

      message.setDataValue('Sender', await message.getSender());

      if (attachmentIds && attachmentIds.length) {
        await message.setAttachments(attachmentIds);
      }

      message.setDataValue('Attachments', await message.getAttachments());

      this.io.in(applicationId).emit('messageSent', message);

      // set receiver user ID
      const receiverId = this.userId === application.clientId ? application.freelancerId : application.clientId;

      // check if receiver online
      const receiver = await models.User.findByPk(receiverId);

      if (receiver.online && receiver.socketId) {
        // update unread messages for receiver
        this.io.to(`${receiver.socketId}`).emit('messageReceived', application);
      } else {
        // send email notification to receiver but first check if this new message is the only one
        // if there are more unread messages then don't send notification, only on first one
        const countUnread = await models.Message.count({
          where: {
            applicationId: applicationId,
            id: {
              [Op.ne]: message.id
            },
            read: false,
          }
        });

        if (countUnread === 0) {
          await mailer.sendMail({
            from: config.get('email.defaultFrom'), // sender address
            to: receiver.email, // list of receivers
            subject: 'You have new unread message - Cryptotask', // Subject line
            text: `You have new message for task ${application.Task.title}`, // plain text body
          });
        }
      }
    }
  }

  /**
   * Set messages as read for application
   * @param {Number} applicationId
   * @return {Promise<void>}
   */
  async messageRead(applicationId) {
    // check if user can update application
    const application = await models.Application.findByPk(applicationId);

    if (this.userId === application.clientId || this.userId === application.freelancerId) {
      await models.Message.update(
        { read: true },
        {
          where: {
            applicationId: applicationId,
            senderId: {
              [Op.ne]: this.userId
            }
          }
        }
      );
    }
  }
}

module.exports = Chat;
