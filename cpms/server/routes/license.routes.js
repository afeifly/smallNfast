module.exports = app => {
    const licenseController = require("../controllers/license.controller");
    const checkAuth  = require('../middleware/auth.middleware')

    var router = require("express").Router();
    router.post("/", checkAuth, licenseController.create);
    // Delete a User with id
    router.delete("/:id", licenseController.delete);
    app.use("/api/license", router);
  };
  