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
const BinanceWss = require('./services/BinanceWss');
const BinanceRest = require('./services/BinanceRest');
const config = require('./config');
const botutil = require('./botutil');

const events = require('events');
const eventEmitter = new events.EventEmitter();

let mySymbols = null;
let exchangeInfo;
let timeDifference = 0;
let symbols = require('./symbols').symbols;
const privateAPI = new PrivateAPI(logger, stateManager, timeDifference);
const publicAPI = new PublicAPI(logger);

const binanceRest = new BinanceRest(logger, eventEmitter);
const binanceWss = new BinanceWss(eventEmitter);

const validateConfigParameter = name => {
  throw new Error(`Parameter ${name} is undefined`);
};
let interval = config.interval || validateConfigParameter('interval');
let candleInterval1 = config.candleInterval1 || validateConfigParameter('candleInterval1');
let candleInterval2 = config.candleInterval2 || validateConfigParameter('candleInterval2');
let candleInterval3 = config.candleInterval3 || validateConfigParameter('candleInterval3');
let candleInterval4 = config.candleInterval4 || validateConfigParameter('candleInterval4');
let calcValues = config.calcValues || validateConfigParameter('calcValues');
let buyCoefficient = config.buyCoefficient || validateConfigParameter('buyCoefficient');
let sellCoefficient = config.sellCoefficient || validateConfigParameter('sellCoefficient');
// let hodlBought = config.hodlBought || validateConfigParameter('hodlBought');
let buySignalIsValid = config.buySignalIsValid || validateConfigParameter('buySignalIsValid');
let stateValidity = config.stateValidity || validateConfigParameter('stateValidity');
let acceptedLoss = config.acceptedLoss || validateConfigParameter('acceptedLoss');
let limitAcceptedLoss = config.limitAcceptedLoss || validateConfigParameter('limitAcceptedLoss');
let hodlCoef = config.hodlCoef || validateConfigParameter('hodlCoef');
let moveCandleInterval = config.moveCandleInterval || validateConfigParameter('moveCandleInterval');
let moveAcceptedLoss = config.moveAcceptedLoss || validateConfigParameter('moveAcceptedLoss');
let moveLimitAcceptedLoss = config.moveLimitAcceptedLoss || validateConfigParameter('moveLimitAcceptedLoss');
let isTestSellOrder = config.isTestSellOrder;
let isTestBuyOrder = config.isTestBuyOrder;
let red = config.red || validateConfigParameter('red');
let green = config.green || validateConfigParameter('green');

const calcIndicators = new CalcIndicators(
  {
    buyCoefficient, sellCoefficient,
    candleInterval1, candleInterval2, candleInterval3, candleInterval4,
    calcValues, logger, stateManager, red, green,
  }
);

const timeout = ms => new Promise(res => setTimeout(res, ms));

const processWssUpdate = async (msg) => {
  if ('outboundAccountInfo' === msg.e) {
    mySymbols = msg.B;
    let arr = msg.B
      .filter(el => (el.f > 0 || el.l > 0))
      .map(el => `${el.a}:${el.f}${el.l > 0 ? '/' + el.l : ''}`)
      .join('|');
    await telegramBot.sendMessage(`Update account info is received - ${arr}`);
    console.log(`RECEIVED ACCOUNT UPDATE: ${arr}`);
  } else if ('executionReport' === msg.e) {
    console.log(JSON.stringify(msg));
    if ('STOP_LOSS_LIMIT' === msg.o /* && 'NEW' !== msg.X && 'CANCELED' !== msg.X */) {
      delete msg.e;
      delete msg.o;
      delete msg.f;
      delete msg.F;
      delete msg.g;
      delete msg.I;
      delete msg.M;
      if ('FILLED' === msg.X) {
        if (msg.q === msg.l) { // quantity is the same as last executed, i.e. order was fully executed in one trade
          await telegramBot.sendMessage(
            `${msg.s}:Stop loss limit order was fully executed in 1 trade:${msg.q}/${msg.L}/${JSON.stringify(msg)}`);
        } else {
          await telegramBot.sendMessage(`${msg.s}:Stop loss limit order update: ${JSON.stringify(msg)}`);
        }
      } else {
        await telegramBot.sendMessage(`${JSON.stringify(msg)}`);
      }
    }
  }
};

const reconnectHandler = async () => {
  console.log('I need to do a needReconnect!');
  await privateAPI.getAccount();
  let listenKey = await binanceRest.createListenKey();
  await binanceWss.start(listenKey, processWssUpdate);
};
const pongMissing = async () => {
  console.log('pongMissing is needed');
  await telegramBot.sendMessage('Pong missing is received');
};
eventEmitter.on('needReconnect', reconnectHandler);
eventEmitter.on('pongMissing', pongMissing);

var main = async function () {

  for (var i = 0; i < symbols.length; i++) {

    await timeout(0);

    if (mySymbols === null) {
    // todo : make reconnect here??
      await telegramBot.sendMessage('I am explicitly calling get account info');
      logger.info('calling the getAccount inside the cycle');
      mySymbols = await privateAPI.getAccount();
    }

    var symbol = symbols[i].symbol;
    var limitToSpent = symbols[i].limitToSpent;
    let placeStopLoss = symbols[i].placeStopLoss;

    // check exchange info to find info about current pair
    var symbolInfo = calcIndicators.getSymbolInfo(exchangeInfo, symbol);

    // todo: return the price of closing
    var [isSell, isBuy, nGreen, lastClosePrice] = await calcIndicators.calculateSignals(symbol, false);

    // check the base asset balance to find if robot needs to sell
    let [myQuoteBalance] = calcIndicators.getBalance(mySymbols, symbolInfo.quoteAsset);
    let [myBaseBalance, myBaseBalanceLocked] = calcIndicators.getBalance(mySymbols, symbolInfo.baseAsset);
    logger.info('before adjusting balances', { symbol: symbol, myBaseBalance: myBaseBalance });
    myBaseBalance = calcIndicators.adjustBalanceToMinQty(myBaseBalance, symbolInfo);
    logger.info('................',
      {
        symbol: symbol, myBaseBalance: myBaseBalance, myBaseBalanceLocked: myBaseBalanceLocked,
        myQuoteBalance: myQuoteBalance, isSell: isSell, isBuy: isBuy,
        lastClosePrice: lastClosePrice, green: nGreen,
      });
    var timestamp = new Date().getTime();
    if ((myBaseBalance > 0) || (myBaseBalanceLocked > 0)) {
      var isSold = false;
      if (isSell) {
        logger.info('Selling ................', { symbol: symbol });
        isSold = await doSell(
          symbol, myBaseBalance, myBaseBalanceLocked, symbolInfo, timestamp, lastClosePrice, symbols[i].isHodl);
      }
      if (!isSold && (myBaseBalanceLocked > 0) && placeStopLoss) {
        let [isMove, moveClosedPrice] = await calcIndicators.checkMove(symbol, moveCandleInterval);
        if (isMove) {
          doMove(symbol, symbolInfo, moveClosedPrice);
        }
      }
    } else if (myBaseBalance === 0 && myBaseBalanceLocked === 0 && myQuoteBalance > 0 && isBuy) { // if not bought yet
      logger.info('Buying ................', { symbol: symbol });
      await doBuy(symbol, myQuoteBalance, limitToSpent, symbolInfo, timestamp, lastClosePrice, nGreen, placeStopLoss);
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
  let stopPrice = calcIndicators.formatPrice(moveClosedPrice * (100 - moveAcceptedLoss) / 100, symbolInfo);

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

    let limitStopPrice = calcIndicators.formatPrice(stopPrice * (100 - moveLimitAcceptedLoss) / 100, symbolInfo);
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

var doBuy = async function (symbol, myQuoteBalance,
  limitToSpent, symbolInfo, timestamp, lastClosePrice, nGreen, placeStopLoss) {
  // logger.info ('do buy arguments', arguments);

  if ((timestamp - stateManager.getBuySignalTime(symbol)) >= buySignalIsValid) {
    logger.info('BUY SIGNAL IS NOT FRESH ENOUGH', { symbol: symbol });
    // await telegramBot.sendMessage(`I am NOT going to buy ${symbol}, as this buy signal is not fresh anymore`);
    return;
  }
  var [spentAmount, buyAmount] = calcIndicators.getBuyAmount(myQuoteBalance, limitToSpent, symbolInfo, lastClosePrice);
  // check min notional
  if ((buyAmount > 0) && placeStopLoss) {
    let stopPrice = (spentAmount / buyAmount) * (100 - acceptedLoss) / 100;
    let limitStopPrice = stopPrice * (100 - limitAcceptedLoss) / 100;
    if (!calcIndicators.checkMinNotion(limitStopPrice, buyAmount, symbolInfo)) {
      logger.info('check min notion is applied before buying and it is false', {
        spentAmount: spentAmount, buyAmount: buyAmount, stopPrice: stopPrice,
        limitStopPrice: limitStopPrice, acceptedLoss: acceptedLoss, limitAcceptedLoss: limitAcceptedLoss,
      });
      buyAmount = 0;
    }
  }
  if (buyAmount > 0) {
    logger.info('calculated buyAmount',
      {
        symbol: symbol, myBalance: myQuoteBalance, limitToSpent: limitToSpent,
        buyAmount: buyAmount, spentAmount: spentAmount, lastClosePrice: lastClosePrice,
        green: nGreen,
      });
    mySymbols = null; // shame, wss doesn't work good enough
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
  // let buyTime = stateManager.getBuyTime(symbol);
  // if ((timestamp - buyTime) < hodlBought) {
  //  logger.info('SHOULD BE HODLED', { symbol: symbol, hodlBought: hodlBought, current: timestamp, buyTime: buyTime });
  //  await telegramBot.sendMessage(`I am going to HODL ${symbol} even if I got the sell indicator`);
  //  return false;
  // }
  if (isHodl) {
    let buyPrice = stateManager.getBuyPrice(symbol);
    logger.info('Buy price is gotten', { symbol: symbol, buyPrice: buyPrice, lastClosePrice: lastClosePrice });
    if (0 === buyPrice) {
      logger.info('No sell, this is hodl coin, and buy price is not found',
        { symbol: symbol, lastClosePrice: lastClosePrice });
      await telegramBot.sendPoliteMessage(symbol, 'BUYPRICENOTFOUND',
        `No sell, this is hodl coin - ${symbol}, and buy price is not found, ${lastClosePrice}`);
      return false;
    }
    if ((buyPrice * hodlCoef) > lastClosePrice) {
      logger.info('No sell, this is hodl coin, and buy price was higher',
        { symbol: symbol, buyPrice: buyPrice, lastClosePrice: lastClosePrice, holdCoef: hodlCoef });
      await telegramBot.sendPoliteMessage(symbol, 'NOSELL-PRICE',
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
    mySymbols = null; // shame, wss doesn't work good enough
    await privateAPI.placeMarketSellOrder(symbol, sellAmount, isTestSellOrder);
    return true;
  }
};

var runMain = async function (nr) {

  logger.info('running main', { iteration: ++nr, memory: JSON.stringify(process.memoryUsage()) });
  if (nr % 500 === 0) {
    timeDifference = await publicAPI.getServerTime();
    logger.info('calculated time difference in ms - ' + timeDifference);
    privateAPI.setTimeDifference(timeDifference);
    await telegramBot.sendMessage(
      `I am still running - ${nr}. Time drift is ${timeDifference}ms.${JSON.stringify(process.memoryUsage())}`);
  }

  await main();
  await stateManager.writeState();

  logger.info('scheduling the next run', { interval: interval, nr: nr });
  await timeout(interval);

  setTimeout(() => runMain(nr), 0);

};

var runToInitState = async function () {

  for (var i = 0; i < symbols.length; i++) {
    await calcIndicators.calculateSignals(symbols[i].symbol, true);
  }
};

var start = async function () {

  if (botutil.startUI()) {
    console.log('starting web');
    require('./web/app');
    // return; // ??
  }

  await telegramBot.sendMessage(
    `I am starting with ${calcValues} values, interval ${interval}ms, version ${botutil.getVersion()}`);
  logger.info('Starting .........................');

  timeDifference = await publicAPI.getServerTime();
  logger.info('calculated time difference in ms - ' + timeDifference);
  privateAPI.setTimeDifference(timeDifference);
  await telegramBot.sendMessage(`Calculated time difference is ${timeDifference}ms`);

  exchangeInfo = await publicAPI.getExchangeInfo();
  logger.info('getExchangeInfo is completed');
  // logger.error(require('util').inspect(exchangeInfo, { showHidden: true, depth: null }));

  if (!await stateManager.initState(stateValidity)) {
    logger.info('I need to init state, as stored state is not valid');
    await runToInitState();
    await stateManager.writeState();
  }
  logger.info('initState is completed', { state: stateManager.getState() });

  // eventEmitter.emit('needReconnect'); // connect to WSS
  reconnectHandler();

  let iterations = 0;
  runMain(iterations);
};

start();

// on ctrl+c
process.on('SIGINT', async function () {
  console.log('SIGINT...............................');
  await stateManager.writeState();
  await telegramBot.sendMessage('Oh no, my master is killing me...');
  logger.info('Exitting ........................');
  process.exit();
});

// on kill pid
process.on('SIGTERM', async function () {
  console.log('SIGTERM...............................');
  await stateManager.writeState();
  await telegramBot.sendMessage('SIGTERM .......................');
  process.exit();
});
