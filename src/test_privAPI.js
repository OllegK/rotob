'use strict';

require('dotenv').config();

const logger = require('./services/logger').init();
const stateManager = require('./services/stateManager');

const PrivateAPI = require('./services/privateAPI');
const privateAPI = new PrivateAPI(logger, stateManager, 0);

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
  // console.log(response);

  // let response = await privateAPI.openOrders('BTCUSDT');
  // console.log(response);
  // console.log(response[0].stopPrice);
  // console.log(response[0].price);
  // let orderId = (response[0] || {}).orderId;
  // console.log(orderId);
  // console.log(response[0].origQty);
  // console.log(response[0].executedQty);

  let response = await privateAPI.cancelOrder('BTCUSDT', 58827875);
  console.log(response);
};

run();
