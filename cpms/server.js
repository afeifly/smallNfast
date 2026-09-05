require('dotenv').config();
const express = require('express');
const db = require('./server/models');
var logger = require('./server/log');
const app = express();
var path = require('path');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'client/build')));
// app.get('*', (req,res) =>{
//   res.sendFile(path.join(__dirname+'/client/build/index.html'));
// });

require("./server/routes")(app);
const httpServer = require('http').createServer(app);

let PORT;
process.env.STATUS === 'production'
  ? (PORT = process.env.PROD_PORT)
  : (PORT = process.env.DEV_PORT);
httpServer.listen(PORT, () => {
  logger.info(`Server in ${process.env.STATUS} mode, listening on *:${PORT}`);
});
db.sequelize.sync();