module.exports = (sequelize, Sequelize) => {
  const Company = sequelize.define(
    'company',
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      companyname: {
        type: Sequelize.STRING,
      },
      address: {
        type: Sequelize.STRING,
      },
      contact: {
        type: Sequelize.STRING,
      },
      email: {
        type: Sequelize.STRING,
      },
      phone: {
        type: Sequelize.STRING,
      },
      active: {
        type: Sequelize.INTEGER,
      }
    }
  );
  return Company;
};


