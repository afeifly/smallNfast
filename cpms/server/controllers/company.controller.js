const db = require("../models");
const Company = db.company;
const Op = db.Sequelize.Op;
const logger = require("../log");


// Create and Save a new user
exports.create = (req, res) => {
  // Validate request
  var companyname = req.body.companyname;
  var address = req.body.address;
  var contact = req.body.contact;
  var email = req.body.email;
  var phone = req.body.phone;
  logger.info(`Create [company] ${companyname} Addr. ${address} contact ${contact} mail: ${email} p:${phone}`);
  if (!companyname) {
    res.status(400).send({
      message: "company name can not be empty!"
    });
    return;
  }

  const company = {
    companyname: companyname,
    address: address,
    contact: contact,
    email: email,
    phone: phone,
    active: 1,
  };

  // Save user in the database
  Company.create(company)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Company."
      });
    });
};

checkIDAlreadybeUsed = (id) => {
  Company.findByPk(id).then(data => {
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

exports.update = (req, res) => {

  const id = req.body.id;
  let body = {
    companyname: req.body.companyname,
    address: req.body.address,
    contact: req.body.contact,
    email: req.body.email,
    phone: req.body.phone
  }
  Company.update(body, {
    where: { id, id }
  }).then(data => {
    res.send(data);
  })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while update Company."
      });
    });
};
exports.delete = (req, res) => {
  const id = req.param('id');
  logger.debug(`Delete company by id ${id}`);
  let body = {
    active: 0
  }
  Company.update(body, {
    where: { id, id }
  }).then(data => {
    res.send(data);
  })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while disactive Company."
      });
    });
};

exports.findAll = (req, res) => {

  const offset = req.body.offset;
  const limit = req.body.limit;
  logger.debug(`find all compay by o:${offset} l:${limit}`);
  Company.findAndCountAll({
    where: { active: 1 },
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
          err.message || "Some error occurred while retrieving Company."
      });
    });
};

exports.findAllNames = (req, res) => {
  Company.findAll({ attributes: ['id', 'companyname'] })
    .then(data => {
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