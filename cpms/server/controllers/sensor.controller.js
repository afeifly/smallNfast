const db = require("../models");
const Sensor = db.sensor;
const Customer = db.customer;
const Config = db.config;
const Company = db.company;
const Op = db.Sequelize.Op;
const logger = require("../log");
const excelJS = require("exceljs");

const isSqlite = db.sequelize.getDialect() === 'sqlite';

function yearFn(col) {
  return isSqlite
    ? db.Sequelize.cast(db.Sequelize.fn("strftime", "%Y", db.Sequelize.col(col)), "INTEGER")
    : db.Sequelize.fn("year", db.Sequelize.col(col));
}

exports.create = (req, res) => {
  const sn = req.body.sn;
  const companyId = req.body.companyId;
  const numberofsn = req.body.numberofsn;
  const manufacturingDate = req.body.manufacturingDate;
  logger.debug(`Create [sensor] ${sn} cid=${companyId} n=${numberofsn} manufacuringData=${manufacturingDate}`);
  if (!sn) {
    res.status(400).send({
      message: "sn can not be empty!"
    });
    return;
  }
  var index = 0;
  var snArray = [];
  var modelArray = [];
  while (index < numberofsn) {
    const newSN = parseInt(sn) + index;
    snArray.push(newSN);
    modelArray.push({
      sn: newSN,
      companyId: companyId,
      manufacturingDate: manufacturingDate,
      active: 1,
    })
    index++;
  }
  Sensor.findAll({
    where: {
      sn: snArray
    }
  }).then(data => {
    if (data.length > 0) {
      const errMsg = 'SN exist in DB, can not create again.';
      logger.debug(errMsg);
      res.status(500).send({
        message: errMsg
      });
    } else {

      logger.debug(modelArray);
      Sensor.bulkCreate(
        modelArray
      ).then(data => {
        res.send(data);
      })
        .catch(err => {
          logger.error(err.message);
          res.status(500).send({
            message:
              err.message || "Some error occurred while creating Sensor."
          });
        });
    }

  }).catch(err => {
    logger.error(err.message);
    res.status(500).send({
      message:
        err.message || "Some error occurred while creating Sensor."
    });
  });

};

checkIDAlreadybeUsed = (sn) => {
  Sensor.findByPk(sn).then(data => {
    if (data) {
      return true;
    } else {
      return false;
    }
  }).catch(err => {
    logger.error(err.message);
    return true;
  });
}

exports.deactive = (req, res) => {
  const sn = req.params.sn;
  // let body = {
  //   active: 0
  // }
  Sensor.destroy({
  // Sensor.update(body, {
    where: { sn: sn },
  }).then(num => {
    logger.debug(`Destory num=${num} sn=${sn}`);
    if (num === 1) {
      res.send({
        message: "Sensor was deactive successfully!"
      });
    } else {
      res.send({
        message: `Cannot Deactive Sensor error !`
      });
    }
  })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message: "Could not deactive Sensor"
      });
    });
};



exports.findAllCount = (req, res) => {
  const companyId = req.body.companyId;
  const year = req.body.year;
  const offset = req.body.offset;
  const direction = req.body.direction;
  const orderBy = req.body.orderby;
  const export2XLS = req.body.needexport;
  const limit = export2XLS ? null : req.body.limit;
  logger.debug(`Find all sensor count by c=${companyId} y=${year} o=${offset} l=${limit} d=${direction} o=${orderBy}`);

  let whereOpt;
  if (year) {
    whereOpt = {
      companyId: companyId,
      manufacturingDate:
        db.Sequelize.where(
          yearFn('manufacturingDate'), year
        )
    }
  } else {
    whereOpt = {
      companyId: companyId,
      active: 1
    }
  }
  logger.debug(whereOpt);
  Sensor.findAndCountAll({
    where: whereOpt,
    // include: [{Company}, {Config}],
    include: [{ model: Company },
    {
      model: Config,
      include: [Customer]
    }
    ],
    offset: offset,
    limit: limit,
    order: [[orderBy, direction]]
  })
    .then(data => {
      if (data.count > 0) {
        const tmpName = data.rows[0].company.companyname;
        let tmp = {
          companyId: companyId,
          companyName: tmpName,
          count: data.count,
          rows: data.rows
        }
        if (export2XLS) {
          export2Excel(tmp, res, new Date().toISOString());
        } else {
          res.send(tmp);
        }

      } else {
        res.send({
          companyId: companyId,
          companyName: '',
          count: 0,
          rows: []
        })
      }
      // res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving Sensor."
      });
    });
};
exports.findAllYear = (req, res) => {

  logger.debug(`Find all year for company id=${req.params.companyId}`);
  const companyId = req.params.companyId;
  Sensor.findAll(
    {
      attributes: [[yearFn('manufacturingDate'), 'year']],
      group: ['year'],
      where: {
        companyId: companyId,
        active: 1
      }
    })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving Sensor."
      });
    });
}

export2Excel = async (item, res, filename) => {

  logger.debug(`XLS info n: ${item.companyName} c:${item.count}`)
  const workbook = new excelJS.Workbook();  // Create a new workbook
  const worksheet = workbook.addWorksheet("Sensors"); // New Worksheet
  const path = 'tmpfolder';  // Path to download excel
  const rowValues = [];
  rowValues[1] = 'Company: ';
  rowValues[2] = item.companyName;
  rowValues[3] = 'Total: ';
  rowValues[4] = item.count;
  worksheet.addRow(rowValues);
  worksheet.getCell('C1').alignment = { horizontal: 'right' };
  worksheet.getCell('D1').alignment = { horizontal: 'left' };
  worksheet.columns = [
    { key: "sn", width: 10 },
    { key: "manufacturingDate", width: 20 },
    { key: "lastCalibrationDate", width: 25 },
    { key: "lastUploadDate", width: 20 },
    { key: "username", width: 35 },
  ];
  worksheet.getRow(3).values = ['SN', 'Manufacturing date',
    'Last calibration date', 'Last upload date', 'Upload by'];
  item.rows.forEach((row) => {
    let tmp = {
      sn: row.sn,
      manufacturingDate: row.manufacturingDate,
      lastCalibrationDate: row.lastCalibrationDate,
      lastUploadDate: row.config ? row.config.lastUploadDate : '',
      username: row.config ? `${row.config.customer.username} ` : ''
    };
    worksheet.addRow(tmp);
  });
  worksheet.getRow(3).eachCell((cell) => {
    cell.font = { bold: true };
  });
  try {
    const data = await workbook.xlsx.writeFile(`${path}/${filename}.xlsx`)
      .then(() => {
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=" + `${filename}.xlsx`
        );
        return workbook.xlsx.write(res).then(function () {
          res.status(200).end();
        });
      });
  } catch (err) {
    logger.error(err.message);
    res.status(500).send({
      message:
        err.message || "Some error occurred while retrieving Sensor."
    });
  };

}
exports.findOne = (req, res) => {

  logger.debug(`Find one sensor by sensorId=${req.params.sensorId}`);
  const sensorId = req.params.sensorId;
  Sensor.findByPk(
    sensorId,
    {
      include: [Company, Customer]
    }
  )
    .then(data => {
      // res.send(data);
      let tmpRow = [];
      tmpRow.push(data);
      let tmp = {
        companyId: data.companyId,
        companyName: data.company.companyname,
        rows: tmpRow
      }
      res.send(tmp);
    }).catch(err => {
      logger.error(err.message);
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving Sensor."
      });
    });
};
