


module.exports = (sequelize, Sequelize) => {
  // const Customer = require('./customer.model')(sequelize, Sequelize);
  const License = sequelize.define(
    'license',
    {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      sensorlist: {
        type: Sequelize.STRING,
      },
      excludesensorlist: {
        type: Sequelize.STRING,
      },
      app: {
        type: Sequelize.STRING,
      },
      imei: {
        type: Sequelize.STRING,
      },
      auth: {
        type: Sequelize.STRING,
      },
      active: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      customerId: {
        type: Sequelize.INTEGER,
        reference: {
          model: 'customer',
          key: 'id',
        }
      }
    },
    
    {
      
  }
  );
  // Customer.hasMany(License);
  // License.belongsTo(Customer,{foreignKey: 'customerId'})
  // Sensor.belongsTo(Customer, {foreignKey: 'lastUploadByID'});
  // License.belongsTo(Customer, {
    // as : 'customerId'
  // })

  // Customer.hasMany(License, {
  //   foreignKey: 'customerId',
  //   sourceKey: 'id'
  // });
  return License;
};


