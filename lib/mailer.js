const nodemailer = require('nodemailer');
const config = require('config');
const EmailTemplate = require('email-templates');
const base64ToS3 = require('nodemailer-base64-to-s3');
const path = require('path');

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

const email = new EmailTemplate({
  message: {
    from: config.get('email.defaultFrom'),
  },
  send: true, // comment out if not sending email on dev
  transport: transporter,
  juiceResources: {
    preserveImportant: true,
    webResources: {
      relativeTo: path.resolve('build'),
      images: true // <--- set this as `true`
    }
  }
});

module.exports = email;
