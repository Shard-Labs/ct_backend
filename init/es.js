const esClient = require('../lib/es.js');
const config = require('config');
const tasksMapping = require('../assets/mappings/tasks.json');

const initEs = async () => {
  await esClient.indices.delete({
    index: config.get('es.indexName')
  });

  await esClient.indices.create({
    index: config.get('es.indexName')
  });

  return await esClient.indices.putMapping({
    index: config.get('es.indexName'),
    type: config.get('es.tasksTypeName'),
    body: {
      properties: tasksMapping
    }
  });
};

console.log('::::::::: initiating elastic search indices :::::::::');

initEs()
  .then((res) => console.log(res))
  .catch((err) => console.log(err));
