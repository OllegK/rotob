'use strict';

require('dotenv').config();

const logger = require('./services/logger').init();
const CalcIndicators = require('./services/calcIndicators');
const stateManager = require('./services/stateManager');

let candleInterval1 = '1h'; // candle size for first buy check
let candleInterval2 = '30m'; // candle size for second buy check
let candleInterval3 = '15m'; // candle size for second buy check
let calcValues = 2; // how many indications should be calculated
let buyCoefficient = 1.0002; // green should be higher by 0.02%
let sellCoefficient = 1.0002; // red should be higher by 0.02%

const calcIndicators = new CalcIndicators(
  buyCoefficient, sellCoefficient,
  candleInterval1, candleInterval2, candleInterval3,
  calcValues, logger, stateManager
);

var run = function () {

  var myBaseBalance = 0;
  var myBaseBalanceLocked = 0.01953;
  var symbolInfo = {
    symbol: 'BCCUSDT',
    status: 'TRADING',
    baseAsset: 'BCC',
    baseAssetPrecision: 8,
    quoteAsset: 'USDT',
    quotePrecision: 8,
    orderTypes: [
      'LIMIT',
      'LIMIT_MAKER',
      'MARKET',
      'STOP_LOSS_LIMIT',
      'TAKE_PROFIT_LIMIT',
    ],
    icebergAllowed: true,
    filters: [
      {
        filterType: 'PRICE_FILTER',
        minPrice: '0.01000000',
        maxPrice: '10000000.00000000',
        tickSize: '0.01000000',
      },
      {
        filterType: 'LOT_SIZE',
        minQty: '0.00001000',
        maxQty: '10000000.00000000',
        stepSize: '0.00001000',
      },
      {
        filterType: 'MIN_NOTIONAL',
        minNotional: '20.00000000',
      },
    ],
  };

  if (myBaseBalanceLocked > 0) {
    myBaseBalance += myBaseBalanceLocked;
  }
  console.log(myBaseBalance);
  var sellAmount = calcIndicators.getSellAmount(myBaseBalance, symbolInfo);
  console.log(sellAmount);

};

run();
