'use strict';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const logger = require('./services/logger').init();
const telegramBot = require('./services/telegramBot');
const CalcIndicators = require('./services/calcIndicators');
const stateManager = require('./services/stateManager');
const PublicAPI = require('./services/publicAPI');
const PrivateAPI = require('./services/privateAPI');

const version = '0.2.1';

// --------------------------------------------------------------------------------------
let interval = 10000; // value in ms between iterations, sleep time
let candleInterval1 = '5m'; // candle size for first buy check
let candleInterval2 = '15m'; // candle size for second buy check
let candleInterval3 = '1h'; // candle size for second buy check
let calcValues = 2; // how many indications should be calculated
let isTestSellOrder = true; // submit an order using test endpoint
let isTestBuyOrder = true; // submit an order using test endpoint
let buyCoefficient = 1.0002; // green should be higher by 0.02%
let sellCoefficient = 1.0002; // red should be higher by 0.02%
let hodlBought = 600000; // how many ms hodl since buying the bought coin and ignore the sell signal
// too short could cause the buy signal ignoring? VVV
let buySignalIsValid = 10000; // how many ms the buy signal is valid; could be set to 0 to prevent any buy
let stateValidity = 300000; // how many ms the stored state is valid, if not valid the state will be reset ({})
let placeStopLoss = true; // please stop-loss order when bought
let acceptedLoss = 1; // percentage of allowable less when placing the stop-loss order
let limitAcceptedLoss = 2; // calculated from acceptedLoss

let hodlCoef = 1.01; // the last close price should be at least 1 percent higher than bought price
// --------------------------------------------------------------------------------------

let mySymbols = null;
let exchangeInfo;
let symbols = require('./symbols').returnSymbols();

const timeout = ms => new Promise(res => setTimeout(res, ms));

const calcIndicators = new CalcIndicators(
  buyCoefficient, sellCoefficient,
  candleInterval1, candleInterval2, candleInterval3,
  calcValues, logger, stateManager
);
const privateAPI = new PrivateAPI(logger, stateManager);
const publicAPI = new PublicAPI(logger);

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

    // todo: return the price of closing
    var [isSell, isBuy, nGreen, lastClosePrice] = await calcIndicators.calculateSignals(symbol, false);

    // check the base asset balance to find if robot needs to sell
    let [myQuoteBalance] = calcIndicators.getBalance(mySymbols, symbolInfo.quoteAsset);
    let [myBaseBalance, myBaseBalanceLocked] = calcIndicators.getBalance(mySymbols, symbolInfo.baseAsset);
    logger.info('................',
      {
        symbol: symbol, myBaseBalance: myBaseBalance, myBaseBalanceLocked: myBaseBalanceLocked,
        myQuoteBalance: myQuoteBalance, isSell: isSell, isBuy: isBuy,
        lastClosePrice: lastClosePrice, green: nGreen,
      });
    var timestamp = new Date().getTime();
    if (((myBaseBalance > 0) || (myBaseBalanceLocked > 0)) && isSell) { // has something to sell
      logger.info('Selling ................', { symbol: symbol });
      await doSell(symbol, myBaseBalance, myBaseBalanceLocked, timestamp, lastClosePrice, symbols[i].isHodl);
    } else if (myBaseBalance === 0 && myQuoteBalance > 0 && isBuy) { // if not bought yet
      logger.info('Buying ................', { symbol: symbol });
      await doBuy(symbol, myQuoteBalance, limitToSpent, symbolInfo, timestamp, lastClosePrice);
    }
  };
};

var doBuy = async function(symbol, myQuoteBalance, limitToSpent, symbolInfo, timestamp, lastClosePrice) {
  if ((timestamp - stateManager.getBuySignalTime(symbol)) >= buySignalIsValid) {
    logger.info('BUY SIGNAL IS NOT FRESH ENOUGH', { symbol: symbol });
    // await telegramBot.sendMessage(`I am NOT going to buy ${symbol}, as this buy signal is not fresh anymore`);
    return;
  }
  var [spentAmount, buyAmount] = calcIndicators.getBuyAmount(myQuoteBalance, limitToSpent, symbolInfo, lastClosePrice);
  if (buyAmount > 0) {
    logger.info('calculated buyAmount',
      {
        symbol: symbol, myBalance: myQuoteBalance, limitToSpent: limitToSpent,
        buyAmount: buyAmount, spentAmount: spentAmount, green: lastClosePrice,
      });
    await telegramBot.sendMessage(`${symbol}: buy amount ${buyAmount}, spent ${spentAmount}, green ${lastClosePrice}`);
    let avg = await privateAPI.placeMarketBuyOrder(symbol, buyAmount, isTestBuyOrder);
    if (placeStopLoss) {
      let stopPrice = calcIndicators.formatPrice(avg * (100 - acceptedLoss) / 100, symbolInfo);
      let limitStopPrice = calcIndicators.formatPrice(stopPrice * (100 - limitAcceptedLoss) / 100, symbolInfo);
      if (calcIndicators.checkMinNotion(limitStopPrice, buyAmount, symbolInfo)) {
        logger.info('The stop prices are calculated', { stopPrice: stopPrice, limitStopPrice: limitStopPrice });
        let stopResponse =
          await privateAPI.placeStopLossOrder(symbol, buyAmount, isTestBuyOrder, stopPrice, limitStopPrice);
        logger.info('The response from placing stop loss order', { response: stopResponse.data });
        await telegramBot.sendMessage(
          `I sucessfully placed STOP LOSS order for ${symbol}, avg ${avg}, prices ${stopPrice}/${limitStopPrice}`);
      } else {
        logger.info('MIN_NOTION is not passed',
          { symbol: symbol, limitStopPrice: limitStopPrice, buyAmount: buyAmount });
        await telegramBot.sendMessage(
          `MIN_NOTION failure for ${symbol}, limitStopPrice: ${limitStopPrice}, amount: ${buyAmount}`);
      }
    }
    mySymbols = null;
  } else {
    logger.info('no buy, buy amount is 0',
      { quoteAsset: symbolInfo.quoteAsset, myQuoteBalance: myQuoteBalance });
    await telegramBot.sendMessage(
      `No buy ${symbol}, buy amount is ${buyAmount}; your ${symbolInfo.quoteAsset} balance is ${myQuoteBalance}`);
  }
};

var doSell = async function(symbol, myBaseBalance, myBaseBalanceLocked, symbolInfo, timestamp, lastClosePrice, isHodl) {
  if ((timestamp - stateManager.getBuyTime(symbol)) < hodlBought) {
    logger.info('SHOULD BE HODLED', { symbol: symbol });
    await telegramBot.sendMessage(`I am going to HODL ${symbol} even if I got the sell indicator`);
    return;
  }
  if (isHodl) {
    let buyPrice = stateManager.getBuyPrice(symbol);
    logger.info('Buy price is gotten', { symbol: symbol, buyPrice: buyPrice, lastClosePrice: lastClosePrice });
    if (0 === buyPrice) {
      // logger.info('No sell, this is hodl coin, and buy price is not found',
      //  { symbol: symbol, lastClosePrice: lastClosePrice });
      // await telegramBot.sendMessage(
      //  `No sell, this is hodl coin - ${symbol}, and buy price is not found, ${lastClosePrice}`);
      return;
    }
    if ((buyPrice * hodlCoef) > lastClosePrice) {
      logger.info('No sell, this is hodl coin, and buy price was higher',
        { symbol: symbol, buyPrice: buyPrice, lastClosePrice: lastClosePrice, holdCoef: hodlCoef });
      await telegramBot.sendMessage(
        `No sell, this is hodl coin - ${symbol}, buy price ${buyPrice}x${hodlCoef} is higher ${lastClosePrice}`);
      return;
    }
  }
  // if we are here, we decided to sell
  if (myBaseBalanceLocked > 0) {
    // var orderId = stateManager.getOrderId(symbol);
    let openOrdersResponse = await privateAPI.openOrders(symbol);
    logger.info(`response from checking the open orders for ${symbol}`, { response: openOrdersResponse });
    let orderId = (openOrdersResponse[0] || {}).orderId;
    if (orderId && !isTestSellOrder) {
      let cancelResponse = await privateAPI.cancelOrder(symbol, orderId);
      logger.info('The response from cancelling order', { response: cancelResponse.data });
      await telegramBot.sendMessage(
        `I sucessfully cancelled STOP LOSS order for ${symbol}, orderId ${orderId}, locked ${myBaseBalanceLocked}`);
      myBaseBalance += myBaseBalanceLocked;
    }
  }
  var sellAmount = calcIndicators.getSellAmount(myBaseBalance, symbolInfo);
  logger.info('I am going to place sell order', { symbol: symbol, sellAmount: sellAmount });
  if (sellAmount > 0) {
    await telegramBot.sendMessage(`I am going to place sell order for ${symbol}, sell amount - ${sellAmount}`);
    await privateAPI.placeMarketSellOrder(symbol, sellAmount, isTestSellOrder);
    mySymbols = null;
  }
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
  await telegramBot.sendMessage(`I am starting with ${calcValues} values, interval ${interval}ms, version ${version}`);
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
