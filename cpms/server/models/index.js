const config = require('../config/db.config.js');
const Sequelize = require('sequelize');
const { DB } = require('../config/db.config.js');
const isSqlite = config.dialect === 'sqlite';
const sequelize = new Sequelize(
  isSqlite ? config.storage || './cpms.sqlite' : config.DB,
  config.USER,
  config.PASSWORD,
  {
    host: isSqlite ? undefined : config.HOST,
    port: isSqlite ? undefined : config.PORT,
    dialect: config.dialect,
    storage: isSqlite ? config.storage || './cpms.sqlite' : undefined,
    logging: false,
    pool: isSqlite ? undefined : {
      max: config.pool.max,
      min: config.pool.min,
      //acquire: config.pool.acquire,
      idle: config.pool.idle,
    },
  }
);
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;
db.user = require('./user.model')(sequelize, Sequelize);
db.company = require('./company.model')(sequelize, Sequelize);
db.customer = require('./customer.model')(sequelize, Sequelize);
db.sensor = require('./sensor.model')(sequelize, Sequelize);
db.license = require('./license.model')(sequelize, Sequelize);
db.config = require('./config.model')(sequelize, Sequelize);
module.exports = db;
