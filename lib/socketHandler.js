const config = require('config');
const socketioJwt = require('socketio-jwt');
const models = require('../models');

module.exports = (io) => {
  io
    .on('connection', socketioJwt.authorize({
      secret: config.get('jwt.secret'),
      timeout: 15000 // 15 seconds to send the authentication message
    }))
    .on('authenticated', socket => {
      const userId = socket.decoded_token.id;
      console.log('user authenticated to socket.io', userId);

      //this socket is authenticated, we are good to handle more events from it.
      socket
        .on('subscribe', async (applicationId) => {
          console.log('subscribing to task', applicationId);

          const application = await models.Application.findByPk(applicationId, {
            include: [models.Task]
          });

          if (application && userId === application.freelancerId || userId === application.Task.postedBy) {
            socket.join(applicationId);
            socket.emit('subscribed');
            io.to(applicationId).emit('userSubscribed', userId);
          }
        })
        .on('sendMessage', async ({ text, applicationId }) => {
          console.log('send message', applicationId, text);

          const application = await models.Application.findByPk(applicationId, {
            include: [models.Task]
          });

          if (application && userId === application.freelancerId || userId === application.Task.postedBy) {
            const message = await models.Message.create({
              senderId: userId,
              applicationId: applicationId,
              text: text
            });

            message.setDataValue('Sender', await message.getSender());

            io.to(applicationId).emit('messageSent', message);
          }
        });
    })
    .on('unauthorized', msg => {
      console.log('unauthorized: ' + JSON.stringify(msg.data));
      // throw new Error(msg.data.type);
    });
};
