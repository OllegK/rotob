'use strict';

const fs = require('fs');

var _package = false;
var startTime = new Date().getTime();

var util = {
  getVersion: () => util.getPackage().version,
  getPackage: () => {
    if (_package) {
      return _package;
    }
    _package = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8'));
    return _package;
  },
  startUI: () => process.argv.includes('--ui'),
  getStartTime: () => startTime,
};

module.exports = util;
