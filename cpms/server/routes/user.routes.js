module.exports = app => {
    const userController = require("../controllers/user.controller");
    const checkAuth  = require('../middleware/auth.middleware')

    var router = require("express").Router();

    // Create a new User
    router.post("/", checkAuth, userController.create);
  
  
    // Retrieve a single User with id
    router.get("/:username", userController.findOne);
    router.get("/", checkAuth,userController.findAll);
  

    // Update a User with id
    router.put("/:username", userController.update);
  
    // Delete a User with id
    router.delete("/:username", userController.delete);
  
    app.use("/api/users", router);
  };
  