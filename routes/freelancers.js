const express = require('express');
const router = express.Router();
const models = require('../models');
const _ = require('lodash');
const Joi = require('@hapi/joi');

/**
 * Get all freelancers available
 */
router.get('/', async (req, res) => {
  const categories = await models.Category.findAll();

  return res.json({
    success: true,
    message: 'Success',
    data: categories,
  });
});

/**
 * Create new freelancer user
 */
router.post('/', async (req, res) => {
  const userId = req.decoded.id;

  // validation
  const linksSchema = Joi.object().keys({
    name: Joi.string().required(),
    link: Joi.string().required(),
  }).optional();

  const schema = Joi.object().keys({
    id: Joi.number().optional(),
    userId: Joi.number().optional(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    occupation: Joi.string().optional(),
    location: Joi.string().optional(),
    travel: Joi.boolean().optional(),
    pictureId: Joi.number().optional(),
    bio: Joi.string().optional(),
    links: Joi.array().items(linksSchema).optional(),
  });

  const validation = Joi.validate(req.body, schema, {
    abortEarly: false
  });

  if (validation.error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      data: validation.error
    });
  }

  // check if freelancer profile already exists for current user
  let freelancer = await models.Freelancer.findOne({
    where: {
      userId,
    },
  });

  let transaction;

  try {
    transaction = await models.sequelize.transaction();

    const freelancerData = _.omit(req.body, ['userId', 'id', 'links']);

    // create freelancer record
    if (!freelancer) {
      freelancer = await models.Freelancer.create({
        ...freelancerData,
        userId
      }, {
        transaction,
      });
    } else { // update existing record
      await freelancer.update(freelancerData, {
        transaction
      });
    }

    const links = await req.body.links.map(async l => {
      return await models.Link.create(l);
    });

    // set links for freelancer
    await freelancer.setLinks(links, { transaction });

    await transaction.commit();

    // fetch it all on the end
    const data = await models.Freelancer.findByPk(freelancer.id, {
      include: [{
        model: models.Link,
        as: 'links',
      }],
    });

    return res.json({
      success: true,
      message: 'Freelancer successfully created',
      data,
    });
  } catch (err) {
    console.error(err);

    if (transaction) await transaction.rollback();

    return res.status(400).json({
      success: false,
      message: 'Something went wrong',
      data: err.message
    });
  }
});

router.put('/', async (req, res) => {

});

module.exports = router;
