const config = require('config');
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: config.get('aws.clientKey'),
  secretAccessKey: config.get('aws.secretKey'),
});

const storage = new AWS.S3({ region: config.get('storage.region') });

module.exports = storage;
