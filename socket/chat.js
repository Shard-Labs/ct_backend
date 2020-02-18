const models = require('../models');
const Op = models.Sequelize.Op;
const NotificationSender = require('../lib/NotificationsSender.js');
const config = require('config');
const _ = require('lodash');

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
    const user = await models.User.findByPk(this.userId);
    user.online = true;
    user.socketId = this.socket.id;
    await user.save();
    this.io.emit('userOnline', user);
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
    this.io.emit('userOffline', user);
  }

  /**
   * Subscribe user to socket room created from application ID
   * @param {Number} applicationId
   * @return {Promise<void>}
   */
  async subscribe(applicationId) {
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
    const application = await models.Application.findByPk(applicationId, {
      include: [
        { model: models.Client, as: 'client' },
        { model: models.Freelancer, as: 'freelancer' },
        { model: models.Task, as: 'task' },
      ]
    });

    // set receiver user ID
    const receiverId = this.userId === application.client.userId
      ? application.freelancer.userId
      : application.client.userId;

    // check if user can send messages to this application
    if (application && this.userId === application.client.userId || this.userId === application.freelancer.userId) {
      let transaction;

      try {
        transaction = await models.sequelize.transaction();

        const message = await models.Message.create({
          senderId: this.userId,
          receiverId,
          applicationId,
          text,
          role
        }, { transaction });

        // update last message ID on application
        application.lastMessageId = message.id;
        application.save({ transaction });

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
          ],
          transaction
        }));

        if (attachmentIds && attachmentIds.length) {
          await message.setAttachments(attachmentIds, { transaction });
        }

        message.setDataValue('attachments', await message.getAttachments({ transaction }));

        this.io.in(applicationId).emit('messageSent', message);

        // check if receiver online
        const receiver = await models.User.findByPk(receiverId);

        if (receiver.online && receiver.socketId) {
          // update unread messages for receiver
          this.io.to(`${receiver.socketId}`).emit('messageReceived', message);
        }

        // check if user is already in chat (in sockets room)
        const io = (
          receiver.socketId
          && _.get(this, ['io', 'sockets', 'adapter', 'rooms', applicationId, 'sockets', receiver.socketId], null)
        ) ? null : this.io;

        // send new notification to receiver
        (new NotificationSender('newMessage', receiver, {
          message,
          application,
        }, applicationId, io)).send();

        await transaction.commit();
      } catch (err) {
        if (transaction) await transaction.rollback();

        console.error('Unable to send message! ' + err.message);
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

  /**
   * Freelancer applied to task, notify client
   * @param {Object} application
   * @return {Promise<void>}
   */
  async freelancerApplied(application) {
    if (_.get(application, 'client.user.id')) {
      // check if receiver online
      const receiver = await models.User.findByPk(application.client.user.id);

      if (receiver.online && receiver.socketId) {
        // update unread messages for receiver
        this.io.to(`${receiver.socketId}`).emit('newApplication', application);
      }
    }
  }
}

module.exports = Chat;
