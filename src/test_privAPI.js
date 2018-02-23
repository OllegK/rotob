'use strict';

require('dotenv').config();

const privateAPI = require('./services/privateAPI');

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

var run = async function () {
  //await getBalance('BTC');
  //await privateAPI.placeMarketBuyOrder('ETHBTC', 0.001, true, false, 0);
  let response = await privateAPI.placeStopLossOrder('WAVESBTC', 0.14, false, 0.0031000);
  //let response = await privateAPI.cancelOrder('ETHBTC', orderId);
  console.log(response);
};

run();
