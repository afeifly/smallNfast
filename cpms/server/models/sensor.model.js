

module.exports = (sequelize, Sequelize) => {
  const Config = require('./config.model')(sequelize, Sequelize);
  const Company = require('./company.model')(sequelize, Sequelize);
  const Sensor = sequelize.define(
    'sensor',
    {
      sn: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      companyId: {
        type: Sequelize.INTEGER,
        reference: {
          model: 'company',
          key: 'id',
        }
      },
      active: {
        type: Sequelize.INTEGER,
      },
      manufacturingDate: {
        type: Sequelize.DATE,
      },
      lastCalibrationDate: {
        type: Sequelize.DATE,
      },
      currentconfigid: {
        type: Sequelize.INTEGER,
        reference: {
          model: 'config',
          key: 'id',
        }
      },
    },
  );
  Sensor.belongsTo(Config, {foreignKey: 'currentconfigid'});
  Sensor.belongsTo(Company, {foreignKey: 'companyId'});
  Company.hasMany(Sensor);
  return Sensor;
};


