const bcrypt = require("bcrypt");
module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define(
    'user',
    {
      username: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      password: {
        type: Sequelize.STRING,
      },
      role: {
        type: Sequelize.INTEGER,
      },
    },
    
    {
      freezeTableName: true,
      hooks : {
        beforeCreate : (user , options) => {
          {
              user.password = user.password && user.password != "" ? bcrypt.hashSync(user.password, 10) : "";
          }
        },
        beforeBulkUpdate : (user , options) => {
          {
              // user.password = user.password && user.password != "" ? bcrypt.hashSync(user.password, 10) : "";
            user.attributes.password = user.attributes.password 
                    && user.attributes.password != "" ? bcrypt.hashSync(user.attributes.password, 10) : "";
          }
        }
      },
      
  }
    /*
      {
        defaultScope: {
          attributes: { exclude: ['createdAt', 'updatedAt', 'password'] },
        },
      }*/
  );
  User.prototype.validPassword = function (password) {
    return bcrypt.compareSync(password, this.password);
  };

  return User;
};


