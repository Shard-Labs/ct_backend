const config = require('config');
const socketioJwt = require('socketio-jwt');
const Chat = require('../socket/chat.js');

module.exports = (io) => {
  io
    .on('connection', socketioJwt.authorize({
      secret: config.get('jwt.secret'),
      timeout: 15000 // 15 seconds to send the authentication message
    }))
    .on('authenticated', async (socket) => {
      console.log('authenticated', socket.decoded_token);
      const chatHandler = new Chat(io, socket);

      // set user to online
      await chatHandler.setUserOnline();

      //this socket is authenticated, we are good to handle more events from it.
      socket
        .on('subscribe', async (applicationId) => await chatHandler.subscribe(applicationId))
        .on('unsubscribe', async (applicationId) => await chatHandler.unsubscribe(applicationId))
        .on('sendMessage', async (data) => await chatHandler.sendMessage(data))
        .on('messageRead', async (applicationId) => await chatHandler.messageRead(applicationId))
        .on('startedTyping', async (userName) => await chatHandler.startedTyping(userName))
        .on('stoppedTyping', async (userName) => await chatHandler.stoppedTyping(userName))
        .on('disconnect', async () => await chatHandler.setUserOffline());
    })
    .on('unauthorized', msg => {
      console.log('unauthorized: ' + JSON.stringify(msg.data));
      // throw new Error(msg.data.type);
    });
};
