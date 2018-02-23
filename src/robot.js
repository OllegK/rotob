'use strict';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const logger = require('./services/logger').init();
const telegramBot = require('./services/telegramBot');
const CalcIndicators = require('./services/calcIndicators');
const stateManager = require('./services/stateManager');
const publicAPI = require('./services/publicAPI');
const privateAPI = require('./services/privateAPI');

// --------------------------------------------------------------------------------------
let interval = 1000; // value in ms between iterations, sleep time
let candleInterval1 = '1h'; // candle size for first buy check
let candleInterval2 = '1h'; // candle size for second buy check
let calcValues = 2; // how many indications should be calculated
let isTestSellOrder = true; // submit an order using test endpoint
let isTestBuyOrder = true; // submit an order using test endpoint
let buyCoefficient = 1.0002; // green should be higher by 0.02%
let sellCoefficient = 1.0002; // red should be higher by 0.02%
let hodlBought = 600000; // how many ms hodl since buying the bought coin and ignore the sell signal
let buySignalIsValid = 10000; // how many ms the buy signal is valid; could be set to 0 to prevent any buy
let stateValidity = 300000; // how many ms the stored state is valid, if not valid the state will be reset ({})
let placeStopLoss = true; // please stop-loss order when bought
let acceptedLoss = 2; // percentage of allowable less when placing the stop-loss order
// --------------------------------------------------------------------------------------

let mySymbols = null;
let exchangeInfo;
let symbols = require('./symbols').returnSymbols();

const timeout = ms => new Promise(res => setTimeout(res, ms));

const calcIndicators = new CalcIndicators(
  buyCoefficient, sellCoefficient,
  candleInterval1, candleInterval2,
  calcValues
);

var main = async function () {

  for (var i = 0; i < symbols.length; i++) {

    if ('Y' !== symbols[i].active) {
      continue;
    }

    if (mySymbols === null) {
      logger.info('mySymbols is null, calling the getAccount', {});
      mySymbols = await privateAPI.getAccount();
    }

    var symbol = symbols[i].symbol;
    var limitToSpent = symbols[i].limitToSpent;

    // check exchange info to find info about current pair
    var symbolInfo = calcIndicators.getSymbolInfo(exchangeInfo, symbol);

    var [isSell, isBuy, nGreen] = await calcIndicators.calculateSignals(symbol, false);

    // check the base asset balance to find if robot needs to sell
    let [myQuoteBalance] = calcIndicators.getBalance(mySymbols, symbolInfo.quoteAsset);
    let [myBaseBalance, myBaseBalanceLocked] = calcIndicators.getBalance(mySymbols, symbolInfo.baseAsset);
    logger.info('................',
      {
        symbol: symbol, myBaseBalance: myBaseBalance, myBaseBalanceLocked: myBaseBalanceLocked,
        myQuoteBalance: myQuoteBalance, isSell: isSell, isBuy: isBuy
      });
    var timestamp = new Date().getTime();
    if (((myBaseBalance > 0) || (myBaseBalanceLocked > 0)) && isSell) { // has something to sell
      logger.info('Selling ................', { symbol: symbol });
      if ((timestamp - stateManager.getBuyTime(symbol)) < hodlBought) {
        logger.info('SHOULD BE HODLED', { symbol: symbol });
        await telegramBot.sendMessage(`I am going to HODL ${symbol} even if I got the sell indicator`);
        continue;
      }
      if (symbols[i].isHodl) {
        let buyPrice = stateManager.getBuyPrice(symbol);
        logger.info('Buy price is gotten', { symbol: symbol, buyPrice: buyPrice });
        if (0 === buyPrice) {
          logger.info('No sell, this is hodl coin, and buy price is not found',
            { symbol: symbol, green: nGreen });
          await telegramBot.sendMessage(
            `No sell, this is hodl coin - ${symbol}, and buy price is not found, ${nGreen}`);
          continue;
        }
        if (buyPrice > nGreen) {
          logger.info('No sell, this is hodl coin, and buy price was higher',
            { symbol: symbol, buyPrice: buyPrice, green: nGreen });
          await telegramBot.sendMessage(
            `No sell, this is hodl coin - ${symbol}, and buy price ${buyPrice} is higher ${nGreen}`);
          continue;
        }
      }
      // if we are here, we decided to sell
      if (myBaseBalanceLocked > 0) {
        // todo : we need to cancel sell order
        myBaseBalance += myBaseBalanceLocked;
      }
      var sellAmount = calcIndicators.getSellAmount(myBaseBalance, symbolInfo);
      logger.info('I am going to place sell order', { symbol: symbol, sellAmount: sellAmount });
      if (sellAmount > 0) {
        await telegramBot.sendMessage(`I am going to place sell order for ${symbol}, sell amount - ${sellAmount}`);
        await privateAPI.placeMarketSellOrder(symbol, sellAmount, isTestSellOrder);
        mySymbols = null;
      }
    } else if (myBaseBalance === 0 && myQuoteBalance > 0 && isBuy) { // if not bought yet
      logger.info('Buying ................', { symbol: symbol });
      if ((timestamp - stateManager.getBuySignalTime(symbol)) >= buySignalIsValid) {
        logger.info('BUY SIGNAL IS NOT FRESH ENOUGH', { symbol: symbol });
        // await telegramBot.sendMessage(`I am NOT going to buy ${symbol}, as this buy signal is not fresh anymore`);
        continue;
      }
      var [spentAmount, buyAmount] = calcIndicators.getBuyAmount(myQuoteBalance, limitToSpent, symbolInfo, nGreen);
      if (buyAmount > 0) {
        logger.info('calculated buyAmount',
          {
            symbol: symbol, myBalance: myQuoteBalance, limitToSpent: limitToSpent,
            buyAmount: buyAmount, spentAmount: spentAmount,
          });
        await telegramBot.sendMessage(`${symbol}: buy amount ${buyAmount}, spent ${spentAmount}, green ${nGreen}`);
        await privateAPI.placeMarketBuyOrder(symbol, buyAmount, isTestBuyOrder, placeStopLoss, acceptedLoss);
        mySymbols = null;
      } else {
        logger.info('no buy, buy amount is 0',
          { quoteAsset: symbolInfo.quoteAsset, myQuoteBalance: myQuoteBalance });
        await telegramBot.sendMessage(
          `No buy ${symbol}, buy amount is ${buyAmount}; your ${symbolInfo.quoteAsset} balance is ${myQuoteBalance}`);
      }
    }
  };
};

var runMain = async function (nr) {

  logger.info('running main', { iteration: ++nr });
  if (nr % 100 === 0) {
    await telegramBot.sendMessage(`Master, I am still running - ${nr} iterations`);
  }

  await main();
  stateManager.writeState();

  logger.info('scheduling the next run', { interval: interval, nr: nr });
  await timeout(interval);
  runMain(nr);
};

var runToInitState = async function () {

  for (var i = 0; i < symbols.length; i++) {

    if ('Y' !== symbols[i].active) {
      continue;
    }

    await calcIndicators.calculateSignals(symbols[i].symbol, true);

  }
};

var start = async function () {
  await telegramBot.sendMessage(`I am starting with ${calcValues} values and interval ${interval}ms`);
  // await telegramBot.sendMessage(`Pairs in attention ${JSON.stringify({ symbols: symbols })}`);
  logger.info('Starting .........................');

  exchangeInfo = await publicAPI.getExchangeInfo();
  logger.info('getExchangeInfo is completed');

  if (!stateManager.initState(stateValidity)) {
    logger.info('I need to init state, as stored state is not valid');
    await runToInitState();
    stateManager.writeState();
  }
  logger.info('initState is completed', { state: stateManager.getState() });

  let iterations = 0;
  runMain(iterations);
};

start();

// on ctrl+c
process.on('SIGINT', async function () {
  await telegramBot.sendMessage('Oh no, my master is killing me...');
  logger.info('Exitting ........................');
  stateManager.writeState();
  process.exit();
});

// on kill pid
process.on('SIGTERM', async function () {
  await telegramBot.sendMessage('SIGTERM .......................');
  logger.info('Exitting SIGTERM ........................');
  stateManager.writeState();
  process.exit();
});
