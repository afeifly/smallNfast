const db = require("../models");
const License = db.license;
const Op = db.Sequelize.Op;
const logger = require("../log");

const util = require("../util/util");

exports.create = (req, res) => {
  // Validate request
  //check newID exists or not. No need now
  const newID = util.generateMixedWithoutCheckExist(16);
  while (checkIDAlreadybeUsed(newID)) {
    logger.info(`ID ${newID} already be used`);
    newID = util.generateMixedWithoutCheckExist(16);
  }
  // logger.info(`generate ID ${newID}`);
  const include = req.body.include;
  const exclude = req.body.exclude;
  const app = req.body.app;
  const auth = req.body.auth;
  const customerId = req.body.customerId;
  logger.debug(`Create [license] ${newID}`);

  const item = {
    id: newID,
    sensorlist: include,
    excludesensorlist: exclude,
    app: app,
    auth: auth,
    customerId: customerId,
    active: 1,
  };

  License.create(item)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating license."
      });
    });
};
exports.delete = (req, res) => {
  const id = req.params.id;

  License.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "license was deleted successfully!"
        });
      } else {
        res.send({
          message: `Cannot delete license =${id}. `
        });
      }
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message: `Cannot delete license =${id}. `
      });
    });
};
checkIDAlreadybeUsed = (id) => {
  License.findByPk(id).then(data => {
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




exports.findAll = (req, res) => {
  const companyId = req.body.id;
  const offset = req.body.offset;
  const limit = req.body.limit;
  logger.debug(`find all license for c:${companyId} by o:${offset} l:${limit}`);

  Customer.findAndCountAll({
    where: { companyId: companyId },
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