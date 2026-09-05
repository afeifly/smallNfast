

module.exports = (sequelize, Sequelize) => {
  const Customer = require('./customer.model')(sequelize, Sequelize);
  const Config = sequelize.define(
    'config',
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      deviceid: {
        type: Sequelize.STRING,
      },
      devicetype: {
        type: Sequelize.STRING,
      },
      data: {
        type: Sequelize.TEXT,
      },
      active: {
        type: Sequelize.INTEGER,
      },
      lastUploadDate: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastUploadByID: {
        type: Sequelize.INTEGER,
        reference: {
          model: 'customer',
          key: 'id',
        }
      },
    },

    {

    }
  );

  Config.belongsTo(Customer, { foreignKey: 'lastUploadByID' });
  return Config;
};


