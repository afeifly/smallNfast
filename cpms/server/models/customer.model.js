
module.exports = (sequelize, Sequelize) => {
  const Company = require('./company.model')(sequelize, Sequelize);
  const License = require('./license.model')(sequelize, Sequelize);
  const Customer = sequelize.define(
    'customer',
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      username: {
        type: Sequelize.STRING,
      },
      active: {
        type: Sequelize.INTEGER,
      },
      companyId: {
        type: Sequelize.INTEGER,
        reference: {
          model: 'company',
          key: 'id',
        }
      }
    },
    
    {
      
  }
  );
  Company.hasMany(Customer);
  // License.associate = (models) => {
  //   License.belongsTo(models.Customer, {foreignKey: 'customerId'});
  // }
  License.belongsTo(Customer,{foreignKey: 'customerId'})
  Customer.hasMany(License);
  return Customer;
};


