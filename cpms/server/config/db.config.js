require('dotenv').config({ path: '.env' });

module.exports = {
  HOST: process.env.HOST,
  PORT: process.env.PORT,
  USER: process.env.DBUSER,
  PASSWORD: process.env.PASSWORD,
  DB: process.env.DB,
  dialect: process.env.DIALECT || 'mysql',
  storage: process.env.STORAGE,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
};
