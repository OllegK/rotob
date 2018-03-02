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

const version = '0.2.1.5';

// --------------------------------------------------------------------------------------
let interval = 10000; // value in ms between iterations, sleep time
let candleInterval1 = '1h'; // candle size for first buy check
let candleInterval2 = '30m'; // candle size for second buy check
let candleInterval3 = '15m'; // candle size for second buy check
let calcValues = 2; // how many indications should be calculated
let isTestSellOrder = false; // submit an order using test endpoint
let isTestBuyOrder = false; // submit an order using test endpoint
let buyCoefficient = 1.0002; // green should be higher by 0.02%
let sellCoefficient = 1.0002; // red should be higher by 0.02%
let hodlBought = 600000; // how many ms hodl since buying the bought coin and ignore the sell signal
// too short could cause the buy signal ignoring? VVV
let buySignalIsValid = 10000; // how many ms the buy signal is valid; could be set to 0 to prevent any buy
let stateValidity = 300000; // how many ms the stored state is valid, if not valid the state will be reset ({})
let placeStopLoss = true; // please stop-loss order when bought
let acceptedLoss = 2; // percentage of allowable less when placing the stop-loss order
let limitAcceptedLoss = 0.5; // calculated from acceptedLoss
let hodlCoef = 1.004; // the last close price should be at least 1 percent higher than bought price
// ----MOVE -----------------------------------------------------------------------------
let moveCandleInterval = '15m';
// --------------------------------------------------------------------------------------

let mySymbols = null;
let exchangeInfo;
let timeDifference = 0;
let symbols = require('./symbols').returnSymbols();

const timeout = ms => new Promise(res => setTimeout(res, ms));

const calcIndicators = new CalcIndicators(
  buyCoefficient, sellCoefficient,
  candleInterval1, candleInterval2, candleInterval3,
  calcValues, logger, stateManager
);
const privateAPI = new PrivateAPI(logger, stateManager, timeDifference);
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
      var isSold = await doSell(
        symbol, myBaseBalance, myBaseBalanceLocked, symbolInfo, timestamp, lastClosePrice, symbols[i].isHodl);
      if (!isSold && (myBaseBalanceLocked > 0)) {
        let [isMove, moveClosedPrice] = await calcIndicators.checkMove(symbol, moveCandleInterval);
        if (isMove) {
          doMove(symbol, symbolInfo, moveClosedPrice);
        }
      }
    } else if (myBaseBalance === 0 && myBaseBalanceLocked === 0 && myQuoteBalance > 0 && isBuy) { // if not bought yet
      logger.info('Buying ................', { symbol: symbol });
      await doBuy(symbol, myQuoteBalance, limitToSpent, symbolInfo, timestamp, lastClosePrice, nGreen);
    }
  };
};

var doMove = async function (symbol, symbolInfo, moveClosedPrice) {

  let openOrdersResponse = await privateAPI.openOrders(symbol);
  logger.info(`(doMove)response from checking the open orders for ${symbol}`, { response: openOrdersResponse });
  let orderId = (openOrdersResponse[0] || {}).orderId;
  let oldStopPrice = Number((openOrdersResponse[0] || {}).stopPrice);
  let origQty = (openOrdersResponse[0] || {}).origQty;
  let executedQty = Number((openOrdersResponse[0] || {}).executedQty);
  let qty;
  if (executedQty > 0) {
    qty = calcIndicators.getSellAmount(Number(origQty) - executedQty, symbolInfo);
  } else {
    qty = origQty;
  }
  let stopPrice = calcIndicators.formatPrice(moveClosedPrice * (100 - acceptedLoss) / 100, symbolInfo);

  logger.info('(doMove) all variables are calculated', {
    symbol: symbol, oldStopPrice: oldStopPrice, origQty: origQty,
    executedQty: executedQty, qty: qty, stopPrice: stopPrice,
  });

  if (stopPrice <= oldStopPrice) {
    logger.info('(doMove) stopPrice is lower than oldStopPrice, NO MOVE',
      { symbol: symbol, stopPrice: stopPrice, oldStopPrice: oldStopPrice });
    // await telegramBot.sendMessage(
    //  `${symbol}:NO MOVE of stop loss order, new stop price ${stopPrice} is lower than old ${oldStopPrice}`);
    return;
  }

  if (orderId && !isTestSellOrder) {
    let cancelResponse = await privateAPI.cancelOrder(symbol, orderId);
    logger.info('(doMove)The response from cancelling order', { response: cancelResponse.data });

    let limitStopPrice = calcIndicators.formatPrice(stopPrice * (100 - limitAcceptedLoss) / 100, symbolInfo);
    if (calcIndicators.checkMinNotion(limitStopPrice, qty, symbolInfo)) {
      logger.info('(doMove) The stop prices are calculated', { stopPrice: stopPrice, limitStopPrice: limitStopPrice });
      let stopResponse =
        await privateAPI.placeStopLossOrder(symbol, qty, isTestBuyOrder, stopPrice, limitStopPrice);
      logger.info('(doMove) The response from placing stop loss order', { response: stopResponse.data });
      await telegramBot.sendMessage(
        `MOVED STOP LOSS order for ${symbol}${qty}, prices ${stopPrice}/${limitStopPrice}, old price ${oldStopPrice}`);
    } else {
      logger.info('(doMove) MIN_NOTION is not passed',
        { symbol: symbol, limitStopPrice: limitStopPrice, qty: qty });
      await telegramBot.sendMessage(
        `(doMove) MIN_NOTION failure for ${symbol}, limitStopPrice: ${limitStopPrice}, amount: ${qty}`);
    }
  }
};

var doBuy = async function (symbol, myQuoteBalance, limitToSpent, symbolInfo, timestamp, lastClosePrice, nGreen) {
  // logger.info ('do buy arguments', arguments);
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
        buyAmount: buyAmount, spentAmount: spentAmount, lastClosePrice: lastClosePrice,
        green: nGreen,
      });
    let avg = await privateAPI.placeMarketBuyOrder(symbol, buyAmount, isTestBuyOrder);
    await telegramBot.sendMessage(
      `${symbol}: bought ${buyAmount}, green ${nGreen}, last close price ${lastClosePrice}, order avg price ${avg}`);
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

var doSell = async function (symbol, myBaseBalance, myBaseBalanceLocked, symbolInfo,
  timestamp, lastClosePrice, isHodl) {
  // logger.info ('do sell arguments', arguments);
  let buyTime = stateManager.getBuyTime(symbol);
  if ((timestamp - buyTime) < hodlBought) {
    logger.info('SHOULD BE HODLED', { symbol: symbol, hodlBought: hodlBought, current: timestamp, buyTime: buyTime });
    await telegramBot.sendMessage(`I am going to HODL ${symbol} even if I got the sell indicator`);
    return false;
  }
  if (isHodl) {
    let buyPrice = stateManager.getBuyPrice(symbol);
    logger.info('Buy price is gotten', { symbol: symbol, buyPrice: buyPrice, lastClosePrice: lastClosePrice });
    if (0 === buyPrice) {
      // logger.info('No sell, this is hodl coin, and buy price is not found',
      //  { symbol: symbol, lastClosePrice: lastClosePrice });
      // await telegramBot.sendMessage(
      //  `No sell, this is hodl coin - ${symbol}, and buy price is not found, ${lastClosePrice}`);
      return false;
    }
    if ((buyPrice * hodlCoef) > lastClosePrice) {
      logger.info('No sell, this is hodl coin, and buy price was higher',
        { symbol: symbol, buyPrice: buyPrice, lastClosePrice: lastClosePrice, holdCoef: hodlCoef });
      await telegramBot.sendMessage(
        `No sell, this is hodl coin - ${symbol}, buy price ${buyPrice}x${hodlCoef} is higher ${lastClosePrice}`);
      return false;
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
    await telegramBot.sendMessage(
      `I am going to place sell order for ${symbol}, sell amount:${sellAmount}, last close price:${lastClosePrice}`);
    await privateAPI.placeMarketSellOrder(symbol, sellAmount, isTestSellOrder);
    mySymbols = null;
    return true;
  }
};

var runMain = async function (nr) {

  logger.info('running main', { iteration: ++nr });
  if (nr % 500 === 0) {
    timeDifference = await publicAPI.getServerTime();
    logger.info('calculated time difference in ms - ' + timeDifference);
    privateAPI.setTimeDifference(timeDifference);
    await telegramBot.sendMessage(
      `Master, I am still running - ${nr} iterations. Calculated time difference is ${timeDifference}ms`);
  }

  await main();
  await stateManager.writeState();

  logger.info('scheduling the next run', { interval: interval, nr: nr });
  await timeout(interval);

  mySymbols = null; // 0.2.1
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

  timeDifference = await publicAPI.getServerTime();
  logger.info('calculated time difference in ms - ' + timeDifference);
  privateAPI.setTimeDifference(timeDifference);
  await telegramBot.sendMessage(`Calculated time difference is ${timeDifference}ms`);

  exchangeInfo = await publicAPI.getExchangeInfo();
  logger.info('getExchangeInfo is completed');

  if (!await stateManager.initState(stateValidity)) {
    logger.info('I need to init state, as stored state is not valid');
    await runToInitState();
    await stateManager.writeState();
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
  await stateManager.writeState();
  process.exit();
});

// on kill pid
process.on('SIGTERM', async function () {
  await telegramBot.sendMessage('SIGTERM .......................');
  logger.info('Exitting SIGTERM ........................');
  await stateManager.writeState();
  process.exit();
});
