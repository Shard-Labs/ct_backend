const esClient = require('../lib/es.js');
const config = require('config');
const mappings = require('../assets/mappings.json');

const initEs = async (index) => {
  const indexExist = await esClient.indices.exists({
    index: config.get(`es.${index}IndexName`)
  });

  if (indexExist) {
    await esClient.indices.delete({
      index: config.get(`es.${index}IndexName`)
    });
  }

  await esClient.indices.create({
    index: config.get(`es.${index}IndexName`)
  });

  await esClient.indices.putMapping({
    index: config.get(`es.${index}IndexName`),
    type: config.get(`es.${index}TypeName`),
    body: {
      properties: mappings[index]
    }
  });

  return true;
};

console.log('::::::::: initiating elastic search indices :::::::::');

Promise.all([
  initEs('tasks'),
  initEs('users'),
]).then((res) => console.log(res))
  .catch((err) => console.log(err));
