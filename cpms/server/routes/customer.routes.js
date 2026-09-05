module.exports = app => {
    const customerController = require("../controllers/customer.controller");
    const checkAuth  = require('../middleware/auth.middleware')

    var router = require("express").Router();

    router.post("/", checkAuth, customerController.create);
  
    router.post("/page", checkAuth, customerController.findAll);
    router.put("/", checkAuth, customerController.update);
  
    // Delete a User with id
    router.delete("/:id", customerController.deactive);
  
    app.use("/api/customer", router);
  };
  