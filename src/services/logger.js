'use strict';

const { createLogger, format, transports } = require('winston');
const { combine } = format;
const fs = require('fs');

var init = function () {

  let logDirectory;
  if (process.env.NODE_ENV === 'production') {
    logDirectory = '/tmp';
    console.log('logDirectory is /tmp');

    fs.writeFileSync("/tmp/test.txt", "Hey there!");

  } else {
    logDirectory = './logs';
    fs.mkdir(logDirectory, () => { });
  }

  const logger = createLogger({
    format: combine(
      format.timestamp(),
      format.align(),
      format.printf((info) => {
        const {
          timestamp, level, message, ...args
        } = info;

        const ts = timestamp.slice(0, 19).replace('T', ' ');

        const censor = (censor) => {
          var i = 0;

          return function (key, value) {
            if (i !== 0 && typeof censor === 'object' && typeof value === 'object' && censor === value) {
              return '[Circular]';
            }

            if (i >= 299) { // seems to be a hardcoded maximum
              return '[Unknown]';
            }

            ++i; // so we know we aren't using the original object anymore

            return value;
          };
        };

        return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, censor(args), 2) : ''}`;

      }),
    ),
    transports: [
      new transports.File({
        filename: `${logDirectory}/output.log`,
        maxsize: 1024 * 1024 * 50,
        maxFiles: 999,
        tailable: true,
      }),
      new transports.File({
        filename: `${logDirectory}/error.log`,
        level: 'error',
      }),
    ],
  });

  if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
    }));
  };

  return logger;

};

module.exports.init = init;
