'use strict';

const fs = require('fs');
const os = require('os');

var _package = false;
var startTime = new Date().getTime();

var botutil = {
  getVersion: () => botutil.getPackage().version,
  getPackage: () => {
    if (_package) {
      return _package;
    }
    _package = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8'));
    return _package;
  },
  startUI: () => process.argv.includes('--ui'),
  getStartTime: () => startTime,
  getUserName: () => os.userInfo().username,
  getIpAddress: () => {
    var ifaces = os.networkInterfaces();
    var address;
    Object.keys(ifaces).forEach(dev => {
      ifaces[dev].filter(details => {
        if (details.family === 'IPv4' && details.internal === false) {
          address = details.address;
        }
      });
    });
    return address;
  },
};

module.exports = botutil;
