module.exports = app => {
    const sensorController = require("../controllers/sensor.controller");
    const checkAuth  = require('../middleware/auth.middleware')

    var router = require("express").Router();

    router.post("/", checkAuth, sensorController.create);
  
    router.post("/bycompany", checkAuth, sensorController.findAllCount);
    router.post("/bycompanycount", checkAuth, sensorController.findAllCount);
    router.get("/companyyear/:companyId", checkAuth, sensorController.findAllYear);
    router.get("/:sensorId", checkAuth, sensorController.findOne);
    router.delete("/:sn", checkAuth, sensorController.deactive);
  
    app.use("/api/sensor", router);
  };
  