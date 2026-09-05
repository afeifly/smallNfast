var path = require("path");
const log4js = require('log4js');
log4js.configure({
  appenders: {
    console:
    {
        type: 'console',
    },   
   cheese: {
    type: 'file',
     filename: 'logs/cheese.log',
     maxLogSize:10,
	} 
},
  categories: { 
      default: { appenders: ['console'], level: 'debug' },
      cheese: { appenders: ['cheese','console'], level: 'debug' },
    }
});

const logger = log4js.getLogger('cheese');

module.exports=logger