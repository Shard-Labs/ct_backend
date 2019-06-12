const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const jwt = require('./middleware/jwt');

const authRouter = require('./routes/auth');
const tasksRouter = require('./routes/tasks');
const usersRouter = require('./routes/users');
const applicationsRouter = require('./routes/applications');
const messagesRouter = require('./routes/messages');

const app = express();

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/tasks', jwt.checkToken, tasksRouter);
app.use('/users', jwt.checkToken, usersRouter);
app.use('/applications', jwt.checkToken, applicationsRouter);
app.use('/messages', jwt.checkToken, messagesRouter);

module.exports = app;
