module.exports = app => {
    const companyController = require("../controllers/company.controller");
    const checkAuth  = require('../middleware/auth.middleware')

    var router = require("express").Router();

    router.post("/", checkAuth, companyController.create);
    router.post("/page", checkAuth, companyController.findAll);
    router.put("/", checkAuth, companyController.update);
    router.get("/allnames", checkAuth, companyController.findAllNames);
    router.delete("/:id", checkAuth, companyController.delete);
    app.use("/api/company", router);
  };
  