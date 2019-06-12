const config = require('config');
const AWS = require('aws-sdk');
const elasticsearch = require('elasticsearch');
const awsHttpClient = require('http-aws-es');

AWS.config.update({
  accessKeyId: config.get('aws.clientKey'),
  secretAccessKey: config.get('aws.secretKey'),
  region: config.get('aws.region')
});

const client = elasticsearch.Client({
  host: config.get('aws.esHost'),
  connectionClass: awsHttpClient,
});

module.exports = client;
