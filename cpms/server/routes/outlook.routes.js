module.exports = app => {
    const outlookController = require("../controllers/outlook.controller");

    var router = require("express").Router();
    router.post("/getAuthorization", outlookController.getAuthorization);
    router.post("/setConfiguration", outlookController.setConfiguration);
    router.post("/getConfiguration", outlookController.getConfiguration);
    app.use("/api", router);
  };
  