const nodemailer = require('nodemailer');
const config = require('config');

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: config.get('email.host'),
  port: config.get('email.port'),
  secure: (config.get('email.port') === 465), // true for 465, false for other ports
  auth: {
    user: config.get('email.username'), // generated ethereal user
    pass: config.get('email.password') // generated ethereal password
  }
});

module.exports = transporter;
