const db = require("../models");
const License = db.license;
const Config = db.config;
const Sensor = db.sensor;
const Op = db.Sequelize.Op;
const Sequelize = db.sequelize;
const logger = require("../log");
var md5 = require('md5');


exports.getAuthorization = (req, res) => {
  // Validate request
  const token = req.body.token;
  const ts = req.body.ts;
  const app = req.body.app;
  const appVersion = req.body.appVersion;
  const licenseID = req.body.licenseID;
  const imei = req.body.IMEI;
  logger.debug(`Authorization t: ${token} a: ${app} v: ${appVersion} l: ${licenseID} i: ${imei}`);
  if (!token) {

    res.status(400).send({
      "error": "INVALID_ARGUMENT",
      "code": 3,
      "message": "Invalid argument"
    });
    return;
  }
  const toTestStr = `/SUTO_secret/${ts}/${licenseID}/${app}/${appVersion}/${imei}`;
  logger.debug(`MD5 check source = ${toTestStr}`);
  const md5Str = md5(toTestStr);
  logger.debug(`MD5 check result = ${md5Str}`);
  if (md5Str === token) {
    //can be continue
    License.findOne({
      where: {
        id: licenseID
      }
    })
      .then(data => {
        if (data) {
          if (data.app === app) {
            if (data.imei) {
              if (data.imei === imei) {
                logger.debug("imei auth success");
                sendAuthBack(res, data);
                return;
              } else {
                logger.debug("imei auth err, already be used");
                res.status(403).send({
                  "error": "ALREADY_BIND",
                  "code": 17,
                  "message": "License already be bound by IMEI"
                });
              }
            } else {
              logger.debug("imei init, update");
              let body = {
                imei: imei
              }
              License.update(body, {
                where: { id: licenseID }
              })
                .then(() => {

                  sendAuthBack(res, data);
                  return;
                })
                .catch(err => {
                  logger.error(err.message);
                  res.status(500).send({
                    "error": "INTERNAL",
                    "code": 13,
                    "message": "Update license IMEI Error: " + err.message
                  });
                });
            }
          } else {
            res.status(400).send({
              "error": "PERMISSION_DENIED",
              "code": 7,
              "message": "App type error",
            });
          }

        } else {
          res.status(403).send({
            "error": "NOT_FOUND",
            "code": 5,
            "message": "License not found"
          });
        }
      }).catch(err => {
        logger.error(err.message);
        res.status(500).send({
          "error": "INTERNAL",
          "code": 13,
          "message": "Find license Error: " + err.message
        });
      });
  } else {
    res.status(401).send({
      "error": "Unauthenticated",
      "code": 16,
      "message": "Unauthenticated"
    });
  }
};

sendAuthBack = async (res, data) => {
  logger.debug('sendAuthBack '+ data.sensorlist);
  let array = [];
  if (data.sensorlist === '["S431"]') {
    let querySql = `select s.sn from customers u, sensors s, companies c where u.companyId = c.id and s.companyID = c.id and u.id=${data.customerId}`;
    logger.debug(`Try query SQL : ${querySql}`);
    Sequelize.query(querySql, { type: Sequelize.QueryTypes.SELECT })
      .then(item => {
        item.map(obj => {
          array.push(obj.sn);
        });
        sendCallback(res, array, data);
      }).catch(err => {
        logger.error(err.message);
        res.status(500).send({
          "error": "INTERNAL",
          "code": 13,
          "message": "Find sql Error: " + err.message
        });
      });
  } else {
    array.push('*');
    sendCallback(res, array, data);
  }
  return;
}
sendCallback = async (res, array,data) => {
  res.status(200).json({
    "sensorTypeList": JSON.parse(data.sensorlist),
    "excludeSensorTypeList": JSON.parse(data.excludesensorlist),
    "authorization": data.auth,
    "userID": data.customerId,
    "sensorList": array
  });
}

exports.setConfiguration = async (req, res) => {

  const token = req.body.token;
  const ts = req.body.ts;
  const deviceID = req.body.deviceID;
  const deviceType = req.body.deviceType;
  const data = req.body.data;
  const userID = req.body.userID;
  const checkExisting = req.body.checkExisting;
  logger.debug(`setConfiguration  t: ${token} ts: ${ts} i: ${deviceID} y: ${deviceType} u: ${userID} c: ${checkExisting} d: ${data}`);
  if (!token) {
    res.status(400).send({
      "error": "INVALID_ARGUMENT",
      "code": 3,
      "message": "Invalid argument"
    });
    return;
  }
  const toTestStr = `/SUTO_secret/${ts}/${deviceType}/${deviceID}`;
  logger.debug(`MD5 check source = ${toTestStr}`);
  const md5Str = md5(toTestStr);
  logger.debug(`MD5 check result = ${md5Str}`);
  if (md5Str === token) {
    var doConfigRightNow = false;
    if (checkExisting) {
      await Config.findOne({
        where: {
          deviceid: deviceID
        }
      })
        .then(data => {
          if (data) {
            res.status(400).send({
              "error": "ALREADY EXISTS",
              "code": 6,
              "message": "Configuration already exists"
            });
            return;
          } else {
            doConfigRightNow = true;
          }
        }).catch(err => {
          logger.error(err.message);
          res.status(500).send({
            "error": "INTERNAL",
            "code": 13,
            "message": "Find license Error: " + err.message
          });
          return;
        });
    } else {
      doConfigRightNow = true;
    }
    logger.debug(`doConfig ? = ${doConfigRightNow}`);
    if (doConfigRightNow) {
      const execResult = saveNewConfig(res, deviceID, deviceType, data, userID);
      logger.debug(`doConfig execResult = ${execResult}`);
      if (execResult) {
        res.send({
          "status": "success"
        });
      } else {
        res.status(500).send({
          "error": "INTERNAL",
          "code": 13,
          "message": "Save config error: "
        });
      }
    }
  } else {
    res.status(401).send({
      "error": "Unauthenticated",
      "code": 16,
      "message": "Unauthenticated"
    });
  }
}

exports.getConfiguration = (req, res) => {
  const token = req.body.token;
  const ts = req.body.ts;
  const deviceID = req.body.deviceID;
  const newDeviceID = req.body.newDeviceID;
  const deviceType = req.body.deviceType;
  const userID = req.body.userID;
  logger.debug(`getConfiguration t: ${token} ts: ${ts} i: ${deviceID} n: ${newDeviceID} y: ${deviceType} u: ${userID}`);
  if (!token) {
    res.status(400).send({
      "error": "INVALID_ARGUMENT",
      "code": 3,
      "message": "Invalid argument"
    });
    return;
  }
  const toTestStr = `/SUTO_secret/${ts}/${deviceType}/${deviceID}`;
  logger.debug(`MD5 check source = ${toTestStr}`);
  const md5Str = md5(toTestStr);
  logger.debug(`MD5 check result = ${md5Str}`);
  if (md5Str === token) {
    let querySql = `SELECT count(s.companyId) as count from sensors s, customers c where s.companyId=c.companyId and s.sn in ('${deviceID}','${newDeviceID}') and c.id=${userID}`;
    logger.debug(`Try query SQL : ${querySql}`);
    Sequelize.query(querySql, { type: Sequelize.QueryTypes.SELECT })
      .then(item => {
        if (item && (
          item[0].count === 2 
          || (item[0].count === 1 && deviceID === newDeviceID  ))) {
          Config.findOne({
            where: {
              deviceid: deviceID
            }
          })
            .then(data => {
              if (data) {
                res.send({
                  "deviceID": newDeviceID,
                  "deviceType": deviceType,
                  "data": data.data,
                })
              }
            }).catch(err => {
              logger.error(err.message);
              res.status(500).send({
                "error": "INTERNAL",
                "code": 13,
                "message": "Find license Error: " + err.message
              });
            });

        } else {
          res.status(500).send({
            "error": "PERMISSION_DENIED",
            "code": 7,
            "message": "DeviceID not allowed"
          });
        }
      }).catch(err => {
        logger.error(err.message);
        res.status(500).send({
          "error": "INTERNAL",
          "code": 13,
          "message": "DB operation error : " + err.message
        });
      });



  } else {
    res.status(401).send({
      "error": "Unauthenticated",
      "code": 16,
      "message": "Unauthenticated"
    });
  }
}
saveNewConfig = async (res, deviceID, deviceType, data, userID) => {
  const config = {
    deviceid: deviceID,
    devicetype: deviceType,
    data: data,
    lastUploadByID: userID,
    lastUploadDate: Date.now()
  };
  logger.debug('save config');
  Config.create(config)
    .then(configItem => {
      logger.debug(`new config save to DB id=${configItem.id}`);
      let body = {
        currentconfigid: configItem.id,
      }
      Sensor.update(body, {
        where: { sn: deviceID }
      }).then(data => {
        logger.debug(data);
        return true;
      })
        .catch(err => {
          logger.error(err.message);
          res.status(500).send({
            "error": "INTERNAL",
            "code": 13,
            "message": "Set config DB handle Error: " + err.message
          });
          return false;
        });
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        "error": "INTERNAL",
        "code": 13,
        "message": "Set config DB handle Error: " + err.message
      });
      return false;
    });
}
