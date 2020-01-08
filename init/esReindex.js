const models = require('../models');
const esClient = require('../lib/es.js');
const config = require('config');

const reindex = async (index) => {

};

const reindexFreelancers = async () => {
  const freelancers = await models.Freelancer.findAll({
    include: [
      {
        model: models.Skill,
        as: 'skills',
      },
      {
        model: models.Category,
        as: 'categories',
      },
      {
        model: models.File,
        as: 'avatar',
      },
    ]
  });

  const body = [];

  freelancers.forEach(f => {
    body.push({
      update: { _index: 'freelancers', _id: f.id },
    });
    body.push({
      doc: {
        firstName: f.firstName,
        lastName: f.lastName,
        location: f.location,
        occupation: f.occupation,
        bio: f.bio,
        published: !!f.published,
        avatar: f.avatar,
        skills: f.skills.map(s => s.name),
        categories: f.categories.map(c => c.name),
      },
      doc_as_upsert: true,
    });
  });

  console.log(body);

  try {
    const response = await esClient.bulk({ refresh: true, body });
    console.log(response);
  } catch (err) {
    console.error(err);
  }

};

reindexFreelancers();
