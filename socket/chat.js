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
      include: [
        { model: models.Client, as: 'client' },
        { model: models.Freelancer, as: 'freelancer' },
      ]
    });

    // check if user can be subscribed
    if (application && this.userId === application.client.userId || this.userId === application.freelancer.userId) {
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
   * @param {String} role - current user active role
   * @return {Promise<void>}
   */
  async sendMessage({ text, applicationId, attachmentIds, role }) {
    console.log('send message', applicationId, text, role, this.userId);

    const application = await models.Application.findByPk(applicationId, {
      include: [
        { model: models.Client, as: 'client' },
        { model: models.Freelancer, as: 'freelancer' },
        { model: models.Task, as: 'task' },
      ]
    });

    // check if user can send messages to this application
    if (application && this.userId === application.client.userId || this.userId === application.freelancer.userId) {
      const message = await models.Message.create({
        senderId: this.userId,
        applicationId,
        text,
        role
      });

      message.setDataValue('sender', await message.getSender({
        include: [
          {
            model: models.Freelancer, as: 'freelancer', include: [
              { model: models.File, as: 'avatar' },
            ]
          },
          {
            model: models.Client, as: 'client', include: [
              { model: models.File, as: 'avatar' },
            ]
          },
          { model: models.Role, as: 'roles' },
        ]
      }));

      if (attachmentIds && attachmentIds.length) {
        await message.setAttachments(attachmentIds);
      }

      message.setDataValue('attachments', await message.getAttachments());

      this.io.in(applicationId).emit('messageSent', message);

      // set receiver user ID
      const receiverId = this.userId === application.client.userId
        ? application.freelancer.userId
        : application.client.userId;

      // check if receiver online
      const receiver = await models.User.findByPk(receiverId);

      if (receiver.online && receiver.socketId) {
        // update unread messages for receiver
        this.io.to(`${receiver.socketId}`).emit('messageReceived', {
          id: application.id,
          title: application.Task.title,
          text: message.text,
          role: message.role,
          createdAt: message.createdAt,
        });
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
            text: `You have new message for task ${application.task.title}`, // plain text body
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
    const application = await models.Application.findByPk(applicationId, {
      include: [
        { model: models.Client, as: 'client' },
        { model: models.Freelancer, as: 'freelancer' },
      ]
    });

    if (this.userId === application.client.userId || this.userId === application.freelancer.userId) {
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

  /**
   * Emit that user is typing
   * @param {Object} data
   * @param {String} data.userName
   * @param {Number} data.applicationId
   * @return {Promise<void>}
   */
  async startedTyping(data) {
    this.io.in(data.applicationId).emit('userTyping', {
      id: this.userId,
      name: data.userName
    });
  }

  /**
   * Emit when user stopped typing
   * @param {Object} data
   * @param {String} data.userName
   * @param {Number} data.applicationId
   * @return {Promise<void>}
   */
  async stoppedTyping(data) {
    this.io.in(data.applicationId).emit('userStoppedTyping', {
      id: this.userId,
      name: data.userName
    });
  }
}

module.exports = Chat;
