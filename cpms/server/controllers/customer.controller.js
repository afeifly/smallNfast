const db = require("../models");
const Customer = db.customer;
const License = db.license;
const Op = db.Sequelize.Op;
const Sequelize = db.Sequelize;
const logger = require("../log");

const util = require("../util/util");

exports.create = (req, res) => {
  // Validate request
  var username = req.body.username;
  var companyId = req.body.companyId;
  logger.debug(`Create [customer] ${username}`);
  if (!username) {
    res.status(400).send({
      message: "username can not be empty!"
    });
    return;
  }

  const customer = {
    username: username,
    companyId: companyId,
    active: 1,
  };

  Customer.create(customer)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating customer."
      });
    });
};

checkIDAlreadybeUsed = (id) => {
  Customer.findByPk(id).then(data => {
    if (data) {
      return true;
    } else {
      return false;
    }
  }).catch(err => {
    logger.error(err.message);
    return true;
  });
}

exports.deactive = (req, res) => {
  const id = req.params.id;
  let body = {
    active: 0
  }
  Customer.update(body, {
    where: { id: id },
  }).then(num => {
    logger.info(`Deactive with num=${num} id=${id}`);
    if (num == 1) {
      res.send({
        message: "Customer was deactive successfully!"
      });
    } else {
      res.send({
        message: `Cannot Deactive Customer with username=${username}. Maybe Cusotmer was not found!`
      });
    }
  })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message: "Could not deactive Customer with username=" + username
      });
    });
};


exports.findAll = (req, res) => {
  const companyId = req.body.id;
  const offset = req.body.offset;
  const limit = req.body.limit;
  logger.debug(`find all customer for c:${companyId} by o:${offset} l:${limit}`);

  Customer.findAndCountAll({
    where: {
      companyId: companyId,
      active: 1
    },
    include: [{
      model: License, 
      required: false,
      separate:true,
      order : [
        ['createdAt', 'asc']
      ],
      where: {
        customerId: Sequelize.col('customerId'),
      }
    }],
    order: [['id', 'desc']],
    offset: offset,
    limit: limit
  })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving Customer."
      });
    });
};
exports.update = (req, res) => {

  const id = req.body.id;
  let body = {
    username: req.body.username,
  }
  Customer.update(body, {
    where: { id, id }
  }).then(data => {
    res.send(data);
  })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving Company."
      });
    });
};