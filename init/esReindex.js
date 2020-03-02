const models = require('../models');
const esClient = require('../lib/es.js');
const argv = require('yargs').argv;
const _ = require('lodash');

const reindex = async () => {
  if (argv.index || (argv.index && (argv.index === 'freelancers' || argv.index.indexOf('freelancers') > -1))) {
    await reindexFreelancers();
  }

  if (argv.index || (argv.index && (argv.index === 'tasks' || argv.index.indexOf('tasks') > -1))) {
    await reindexTasks();
  }
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

  try {
    const response = await esClient.bulk({ refresh: true, body });
    console.log('reIndexed freelancers', response);
  } catch (err) {
    console.error(err);
  }
};

const reindexTasks = async () => {
  const tasks = await models.Task.findAll({
    include: [
      {
        model: models.Skill,
        as: 'skills',
        include: [
          {
            model: models.Category,
            as: 'category'
          }
        ]
      },
      {
        model: models.Client,
        as: 'owner',
      }
    ]
  });

  const body = [];

  tasks.forEach(task => {
    body.push({
      update: { _index: 'tasks', _id: task.id },
    });
    body.push({
      doc: {
        title: task.title,
        description: task.description,
        price: task.price,
        negotiablePrice: task.negotiablePrice,
        duration: task.duration,
        negotiableDuration: task.negotiableDuration,
        timePosted: task.createdAt,
        location: task.location,
        status: task.status,
        postedBy: task.owner.name,
        postedById: task.owner.id,
        skills: task.skills ? task.skills.map(s => s.name) : [],
        categories: task.skills ? _.uniq(task.skills.map(s => s.category.name)) : [],
      },
      doc_as_upsert: true,
    });
  });

  try {
    const response = await esClient.bulk({ refresh: true, body });
    console.log('reIndexed tasks', response);
  } catch (err) {
    console.error(err);
  }
};

reindex();
