const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const jwt = require('./middleware/jwt');
const smartContract = require('./lib/smartContract.js');
const socket_io = require('socket.io');

const app = express();

// Socket.io
const io = socket_io();
const socketHandler = require('./lib/socketHandler.js');
app.io = io;

const authRouter = require('./routes/auth');
const tasksRouter = require('./routes/tasks');
const usersRouter = require('./routes/users');
const applicationsRouter = require('./routes/applications');
const messagesRouter = require('./routes/messages');
const filesRouter = require('./routes/files');
const utilRouter = require('./routes/util');
const freelancersRouter = require('./routes/freelancers');
const clientsRouter = require('./routes/clients');
const invitationsRouter = require('./routes/invitations');
const notificationsRouter = require('./routes/notifications');
const feedbacksRouter = require('./routes/feedbacks');

app.use(cors());
app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/utils', utilRouter);
app.use('/tasks', tasksRouter);
app.use('/users', jwt.checkToken, usersRouter);
app.use('/applications', jwt.checkToken, applicationsRouter);
app.use('/messages', jwt.checkToken, messagesRouter);
app.use('/files', jwt.checkToken, filesRouter);
app.use('/freelancers', freelancersRouter);
app.use('/clients', jwt.checkToken, clientsRouter);
app.use('/invitations', jwt.checkToken, invitationsRouter);
app.use('/notifications', jwt.checkToken, notificationsRouter);
app.use('/feedbacks', jwt.checkToken, feedbacksRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// no stacktraces leaked to user unless in development environment
app.use((err, req, res) => {
  if (app.get('env') === 'development') {
    console.error(err);
  }

  res.status(err.status || 500);
  return res.json({
    success: false,
    message: err.message,
    data: (app.get('env') === 'development') ? err : {},
  });
});

socketHandler(io);
smartContract.initContract();

module.exports = app;
