module.exports = app =>{
    require("./company.routes")(app);
    require("./customer.routes")(app);
    require("./sensor.routes")(app);
    require("./login.routes")(app);
    require("./user.routes")(app);
    require("./license.routes")(app);
    require("./outlook.routes")(app);
}