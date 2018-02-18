'use strict';

const winston = require('winston');
// winston.level = 'debug';
const MESSAGE = Symbol.for('message');

var init = function() {
  const jsonFormatter = (logEntry) => {
    const base = { timestamp: new Date() };
    const json = Object.assign(base, logEntry);
    logEntry[MESSAGE] = JSON.stringify(json);
    return logEntry;
  };

  const logger = winston.createLogger({
    level: 'info',
    format: winston.format(jsonFormatter)(),
    transports: [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'output.log' }),
    ],
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
    }));
  };

  return logger;

};

module.exports = {
  init: init,
};
