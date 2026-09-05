module.exports = app => {
    const user = require("../controllers/user.controller.js");
  
    var router = require("express").Router();
  
    router.get("/login", user.login);
    router.get("/logout", user.logout);
    router.post("/begin", user.begin);
    app.use("/api", router);
  };
  