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
    this.candlesAmount = this.calcValues * this.red; // actually should be red + calc
  }

  async calculateSignals(symbol, initRun) {

    // get the candles
    var candles = await publicAPI.getCandles(symbol, this.candleInterval1, this.candlesAmount);
    logger.info('call to get candles completed', { length: candles.length, symbol: symbol });

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
        return mySymbols[i].free; // for now mySymbols[i].locked is not taken into account
      }
    }
    throw new Error('Not found info about asset....' + asset);
  };

  // (myQuoteBalance, limitToBuy, symbolInfo, nGreen)
  getBuyAmount(balance, limitToSpent, symbolInfo, avgPrice) {
    var lotsize = symbolInfo.filters.filter(elem => 'LOT_SIZE' === elem.filterType);
    var minAllowedAmount = lotsize[0].minQty;
    if (minAllowedAmount > 0) {
      var spent = Math.min(balance, limitToSpent);
      // spent = Math.max(spent, minAllowedAmount);
      var buy = (spent / avgPrice);

      buy = (Math.floor(buy / minAllowedAmount) * minAllowedAmount).toFixed(8);

      return [spent, buy]; // calculate max amount to be paid
    } else {
      throw new Error('Not found minimal allowed amount....' + symbolInfo);
    }

  };

  getSellAmount(balance, symbolInfo) {
    var lotsize = symbolInfo.filters.filter(elem => 'LOT_SIZE' === elem.filterType);
    var minAllowedAmount = lotsize[0].minQty;
    // var stepSize = lotsize[0].stepSize;
    if (Number(minAllowedAmount) === 1) {
      return Math.floor(balance);
    }
    var arr = minAllowedAmount.split('.');
    arr = arr[1].split('1');
    var i = arr[0].length;

    var f = Math.pow(10, i + 1);
    return Math.floor(balance * f) / f;

    // return Number(balance).toFixed(i + 1);
  }

}

module.exports = CalcIndicators;
