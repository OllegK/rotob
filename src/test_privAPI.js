'use strict';

// require('dotenv').config();
// const API_KEY = process.env.API_KEY;
// const API_SECRET_KEY = process.env.API_SECRET_KEY;

const privateAPI = require('./services/privateAPI');

const timeout = ms => new Promise(res => setTimeout(res, ms));


var getBalance = async function (coin) {
  var ret = await privateAPI.getAccount();
  console.log(ret);

  for (var i = 0; i < ret.length; i++) {
    if (ret[i].asset === coin) {
      console.log('found - ' + ret[i].free);
      return ret[i].free;
    }
  }
};

var placeMarketOrder = async function (timeout, symbol, side, quantity, isTest) {
  console.log('inside place market order');
  var ret = await privateAPI.placeMarketOrder(timeout, symbol, side, quantity, isTest);
  return ret;
};

var run = async function () {
  await getBalance('BTC');
  var response = await placeMarketOrder(timeout, 'ETHBTC', 'BUY', 0.001, true);
  console.log(response);
};

run();
