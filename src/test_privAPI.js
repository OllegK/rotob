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
  console.log('BTC balance', await getBalance('BTC'));
  // await privateAPI.placeMarketBuyOrder('ETHBTC', 0.001, true, false, 0);
  // let response = await privateAPI.placeStopLossOrder('BTCUSDT', 0.002, false, 9000, 8900);
  // let response = await privateAPI.cancelOrder('BTCUSDT', 55187038);
  let response = await privateAPI.openOrders('ETHUSDT');
  console.log(response);
  let orderId = (response[0] || {}).orderId;
  console.log(orderId);
};

run();
