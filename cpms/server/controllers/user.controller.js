const db = require("../models");
const User = db.user;
const Op = db.Sequelize.Op;
const logger = require("../log");
const jwt = require("jsonwebtoken");

// Create and Save a new user
exports.create = (req, res) => {
  // Validate request
  var username = req.body.username;
  if (!username) {
    res.status(400).send({
      message: "username can not be empty!"
    });
    return;
  }
  // Create a User
  const user = {
    username: req.body.username,
    // password: User.methods.generateHash(req.body.password),
    password: req.body.password,
    role: req.body.role,
  };

  // Save user in the database
  User.create(user)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the User."
      });
    });
};
exports.begin = (req, res) => {
  // Validate request
  var username = req.body.username;
  if (!username) {
    res.status(400).send({
      message: "username can not be empty!"
    });
    return;
  }
  // Validate null

  // Create a User
  const user = {
    username: req.body.username,
    password: req.body.password,
    role: 1
  };

  // Save user in the database
  User.create(user)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the User."
      });
    });
};

// Find a single user with username
exports.findOne = (req, res) => {
  const username = req.params.username;

  User.findByPk(username)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message: "Error retrieving User with username=" + username
      });
    });
};
exports.login = (req, res) => {

  const username = req.param('username');
  const password = req.param('password');
  logger.info(`/login with ${username}`);
  User.findOne({
    where: {
      username: username
    }
  })
    .then(data => {
      logger.debug('start valid password');
      var isValid = data.validPassword(password);
      if (isValid == true) {
        logger.debug('Login success');
        const token = jwt.sign(
          {
            name: username,
            time: Date.now(),
          },
          process.env.JWTSecret,
          {
            expiresIn: "1h",
          }
        );
        res.status(200).json({
          message: "Auth successful",
          role: data.role,
          token: token,
        });
        return;
      } else {
        logger.debug('Login fail');
        res.status(500).send({
          message:
            "Login fail."
        });
      }
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving user."
      });
    });
};
exports.logout = (req, res) => {

  const username = req.param('username');
  const token = req.param('token');
  logger.info(`/logout with ${username}`);
  //Note server side no destory available
  // jwt.destroy(token);
  res.status(200).json({ message: "Logout success.", });
};
// Update a User by the username in the request
exports.update = (req, res) => {
  const username = req.params.username;
  logger.debug('Update password for ' + username);
  const oldpsw = req.body.oldpsw;
  const newpsw = req.body.newpsw;

  User.findOne({
    where: {
      username: username
    }
  })
    .then(data => {
      logger.debug('start valid password');
      var isValid = data.validPassword(oldpsw);
      if (isValid == true) {
        let body = {
          password: newpsw
        }
        User.update(body, {
          where: { username: username },
          individualHooks: true,
        })
          .then(() => {
            res.status(200).json({ message: "Update user success.", });
          })
          .catch(err => {
            logger.error(err.message);
            res.status(500).send({
              message: "Error updating User with username =" + username
            });
          });
      } else {
        logger.debug('Old psw invalid');
        res.status(500).send({
          message:
            "Old psw invalid"
        });
      }
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving user."
      });
    });





};

// Delete a User with the specified username in the request
exports.delete = (req, res) => {
  const username = req.params.username;

  User.destroy({
    where: { username: username }
  })
    .then(num => {
      if (num == 1) {
        res.send({
          message: "User was deleted successfully!"
        });
      } else {
        res.send({
          message: `Cannot delete User with username=${username}. Maybe User was not found!`
        });
      }
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message: "Could not delete User with username=" + username
      });
    });
};


// find all published Users
exports.findAll = (req, res) => {
  User.findAll()
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving Users."
      });
    });
};
