'use strict';

require('dotenv').config();
const telegramBot = require('./services/telegramBot');
const timeout = ms => new Promise(res => setTimeout(res, ms));


var run = async function () {

  await telegramBot.sendPoliteMessage('111', '222', 'Message 1.');
  await telegramBot.sendPoliteMessage('111', '222', 'Message 2 should be skipped.');
  await timeout(121000);
  await telegramBot.sendPoliteMessage('111', '222', 'Message 3 should NOT be skipped.');


};

run();
