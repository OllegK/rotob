'use strict';

const logger = require('./logger').init();
const publicAPI = require('./publicAPI');
const stateManager = require('./stateManager');

class CalcIndicators {

  constructor(buyCoefficient, sellCoefficient, candleInterval1, candleInterval2, calcValues) {
    this.red = 8;
    this.green = 4;
    this.buyCoefficient = buyCoefficient;
    this.sellCoefficient = sellCoefficient;
    this.candleInterval1 = candleInterval1;
    this.candleInterval2 = candleInterval2;
    this.calcValues = calcValues;
    this.candlesAmount = this.calcValues + this.red - 1; // this.calcValues * this.red;
  }

  async calculateSignals(symbol, initRun) {

    // get the candles
    var candles = await publicAPI.getCandles(symbol, this.candleInterval1, this.candlesAmount);
    logger.info('call to get candles completed', { length: candles.length, symbol: symbol });
    logger.info(`Candles for ${symbol}`, { candles: candles });

    // calculate the indicators
    var arrRed = [];
    var arrGreen = [];
    for (var i = 1; i <= this.calcValues; i++) {
      arrRed.push(this.calculateIndicator(candles, i, this.red));
      arrGreen.push(this.calculateIndicator(candles, i, this.green));
    }
    logger.info('Indicators are calculated', { symbol: symbol, red: arrRed, green: arrGreen });

    var isSellSignal = this.isSellCheck(arrRed, arrGreen);
    var isBuySignal = false;
    if (!isSellSignal) {
      isBuySignal = await this.isBuySignal(symbol, arrRed, arrGreen);
    }
    logger.info('Signals are calculated', { symbol: symbol, isSellSignal: isSellSignal, isBuySignal: isBuySignal });

    stateManager.storeSignals(symbol, isSellSignal, isBuySignal, arrGreen[0], initRun);

    return [isSellSignal, isBuySignal, arrGreen[0]];
  }

  async isBuySignal(symbol, arrRed, arrGreen) {
    if (this.isFirstBuyCheck(arrRed, arrGreen)) {
      logger.info('first buy indicator IS GOT', { symbol: symbol, red: arrRed, green: arrGreen });
      // await telegramBot.sendMessage(`I got first buy indicator for ${symbol}`);
      if (this.candleInterval1 === this.candleInterval2) { // skipping the second check
        logger.info('Checking the second buy indicator is skipped as candle intervals are the same',
          { symbol: symbol, candleInterval: this.candleInterval1 });
        return true;
      }
      var candles = await publicAPI.getCandles(symbol, this.candleInterval2, this.red);
      var nRed = this.calculateIndicator(candles, 1, this.red);
      var nGreen = this.calculateIndicator(candles, 1, this.green);
      logger.info('Indicators for second check are calculated', { symbol: symbol, red: nRed, green: nGreen });
      if (nGreen > nRed) {
        logger.info('second buy indicator IS GOT', { symbol: symbol, red: nRed, green: nGreen });
        // await telegramBot.sendMessage(`I got second buy indicator for ${symbol}`);
        return true;
      }
    }
    return false;
  }

  // num - what ordinal value should be calculated, started from 1
  // and 1 - it is the last candle
  calculateIndicator(arr, num, smaLength) {

    var ret = 0;
    for (var i = arr.length - num; i > arr.length - num - smaLength; i--) {
      ret += Number(arr[i][4]);
    }
    ret = ret / smaLength;
    return ret.toFixed(8);
  };

  isFirstBuyCheck(red, green) {
    // var temp = green[0] / red[0];
    // logger.info('is first buy check', {buyCoefficient: this.buyCoefficient, div: temp, green: green, red: red})

    // crossing happened in arrays
    // red[last]>green[last]
    // red[0]   <green[0]

    // console.log('calculating isBuy', green[0] / red[0]);
    return (

      (red[red.length - 1] > green[green.length - 1])
      && (red[0] < green[0])
      && (green[0] / red[0] > this.buyCoefficient)
    );
  };

  isSellCheck(red, green) {
    return (
      (red[0] > green[0])
      && (red[0] / green[0] > this.sellCoefficient)
    );
  };

  getSymbolInfo(exchangeInfo, symbol) {
    for (var i = 0; i < exchangeInfo.length; i++) {
      if (symbol === exchangeInfo[i].symbol) {
        return exchangeInfo[i];
      }
    }
    throw new Error('Not found info about pair....' + symbol);
  };

  getBalance(mySymbols, asset) {
    for (var i = 0; i < mySymbols.length; i++) {
      if (asset === mySymbols[i].asset) {
        return [Number(mySymbols[i].free), Number(mySymbols[i].locked)];
      }
    }
    throw new Error('Not found info about asset....' + asset);
  };

  // (myQuoteBalance, limitToBuy, symbolInfo, nGreen)
  getBuyAmount(balance, limitToSpent, symbolInfo, avgPrice) {
    var lotsize = symbolInfo.filters.filter(elem => 'LOT_SIZE' === elem.filterType);
    var minAllowedAmount = lotsize[0].minQty;
    if (minAllowedAmount > 0) {
      var spent = Math.min(balance * 0.95, limitToSpent); // 0.95 is multiplied trying to avoid -2010
      var buy = (spent / avgPrice);

      buy = (Math.floor(buy / minAllowedAmount) * minAllowedAmount).toFixed(8);

      return [spent, buy]; // calculate max amount to be paid
    } else {
      throw new Error('Not found minimal allowed amount....' + symbolInfo);
    }

  };

  getLen(s) { // return the length after that
    var arr = s.split('.');
    arr = arr[1].split('1');
    return arr[0].length;
  }

  formatPrice(price, symbolInfo) {
    var priceFilter = symbolInfo.filters.filter(elem => 'PRICE_FILTER' === elem.filterType);
    var tickSize = priceFilter[0].tickSize;
    let i = this.getLen(tickSize);

    var f = Math.pow(10, i + 1);
    return Math.floor(price * f) / f;
  }

  checkMinNotion(limitStopPrice, buyAmount, symbolInfo) {
    var minNotional = symbolInfo.filters.filter(elem => 'MIN_NOTIONAL' === elem.filterType);
    var min = minNotional[0].minNotional;
    return (min < limitStopPrice * buyAmount);
  }

  getSellAmount(balance, symbolInfo) {
    var lotsize = symbolInfo.filters.filter(elem => 'LOT_SIZE' === elem.filterType);
    var minAllowedAmount = lotsize[0].minQty;
    if (Number(minAllowedAmount) === 1) {
      return Math.floor(balance);
    }
    let i = this.getLen(minAllowedAmount);

    var f = Math.pow(10, i + 1);
    return Math.floor(balance * f) / f;

    // return Number(balance).toFixed(i + 1);
  }
}

module.exports = CalcIndicators;
