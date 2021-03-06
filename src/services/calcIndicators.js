'use strict';

const PublicAPI = require('./publicAPI');

class CalcIndicators {

  constructor({buyCoefficient, sellCoefficient, candleInterval1,
    candleInterval2, candleInterval3, candleInterval4,
    calcValues, logger, stateManager, red, green}) {
    this.red = red;
    this.green = green;
    this.buyCoefficient = buyCoefficient;
    this.sellCoefficient = sellCoefficient;
    this.candleInterval1 = candleInterval1;
    this.candleInterval2 = candleInterval2;
    this.candleInterval3 = candleInterval3;
    this.candleInterval4 = candleInterval4;
    this.calcValues = calcValues;
    this.candlesAmount = this.calcValues + this.red - 1; // this.calcValues * this.red;
    this.logger = logger;
    this.stateManager = stateManager;
    this.publicAPI = new PublicAPI(logger);
  }

  /*
      1499040000000,      // Open time
      "0.01634790",       // Open
      "0.80000000",       // High
      "0.01575800",       // Low
      "0.01577100",       // Close
      "148976.11427815",  // Volume
      1499644799999,      // Close time
      "2434.19055334",    // Quote asset volume
      308,                // Number of trades
      "1756.87402397",    // Taker buy base asset volume
      "28.46694368",      // Taker buy quote asset volume
      "17928899.62484339" // Ignore
  */
  async checkMove(symbol, moveCandleInterval) {
    // call candles
    let candles = await this.publicAPI.getCandles(symbol, moveCandleInterval, this.green);
    this.logger.info('(checkMove)call to get candles completed',
      { length: candles.length, symbol: symbol, candleInterval: moveCandleInterval });
    this.logger.info(`(checkMove)Candles for ${symbol}`, { candles: candles });

    // calculate one green interval
    let nGreen = this.calculateIndicator(candles, 1, this.green);

    // check last close price
    let lastClosePrice = Number(candles[candles.length - 1][4]);
    let highPrice = Number(candles[candles.length - 1][2]);
    let lowPrice = Number(candles[candles.length - 1][3]);

    // check condition
    let openPrice = Number(candles[candles.length - 1][1]); // will be used for comparison

    let isMove = (openPrice > lastClosePrice) && (nGreen > lowPrice) && (nGreen < highPrice);

    this.logger.info('(checkMove) completed',
      {
        symbol: symbol, green: nGreen, isMove: isMove, lastClosePrice: lastClosePrice,
        openPrice: openPrice, highPrice: highPrice, lowPrice: lowPrice,
      });

    return [isMove, lastClosePrice];
  }

  async calculateSignals(symbol, initRun) {
    // get the candles
    var candles = await this.publicAPI.getCandles(symbol, this.candleInterval1, this.candlesAmount);
    this.logger.info('(calculateSignals)call to get candles completed',
      { length: candles.length, symbol: symbol, candleInterval: this.candleInterval1 });
    this.logger.info(`(calculateSignals)Candles for ${symbol}`, { candles: candles });

    let lastClosePrice = Number(candles[candles.length - 1][4]); // will be used for comparison

    // calculate the indicators
    var arrRed = [];
    var arrGreen = [];
    for (var i = 1; i <= this.calcValues; i++) {
      arrRed.push(this.calculateIndicator(candles, i, this.red));
      arrGreen.push(this.calculateIndicator(candles, i, this.green));
    }
    this.logger.info('Indicators are calculated', { symbol: symbol, red: arrRed, green: arrGreen });

    var isSellSignal = this.isSellCheck(arrRed, arrGreen);
    var isBuySignal = false;
    if (!isSellSignal) {
      isBuySignal = await this.isBuySignal(symbol, arrRed, arrGreen);
    }
    this.logger.info(`(${symbol})Signals are calculated`, {
      symbol: symbol, isSellSignal: isSellSignal, isBuySignal: isBuySignal,
    });

    await this.stateManager.storeSignals(symbol, isSellSignal, isBuySignal, arrGreen[0], initRun);

    return [isSellSignal, isBuySignal, arrGreen[0], lastClosePrice];
  }

  async isSecondaryBuyCheck(symbol, candleInterval, ordinal) {
    var candles = await this.publicAPI.getCandles(symbol, candleInterval, this.red);
    this.logger.info(`(${ordinal})call to get candles completed`,
      { length: candles.length, symbol: symbol, candleInterval: candleInterval });
    this.logger.info(`(${ordinal})Candles for ${symbol}`, { candles: candles });
    var nRed = this.calculateIndicator(candles, 1, this.red);
    var nGreen = this.calculateIndicator(candles, 1, this.green);
    this.logger.info(`${ordinal}Indicators are calculated`, { symbol: symbol, red: nRed, green: nGreen });
    return (nGreen > nRed);
  }

  async isBuySignal(symbol, arrRed, arrGreen) {
    if (this.isFirstBuyCheck(arrRed, arrGreen)) {
      this.logger.info('first buy indicator IS GOT', { symbol: symbol, red: arrRed, green: arrGreen });
      if (this.candleInterval1 === this.candleInterval2) {
        this.logger.info('Checking the second buy indicator is skipped as candle intervals are the same',
          { symbol: symbol, candleInterval: this.candleInterval1 });
        return true;
      }
      if (await this.isSecondaryBuyCheck(symbol, this.candleInterval2, '2nd')) {
        if (this.candleInterval2 === this.candleInterval3) {
          this.logger.info('Checking the third buy indicator is skipped as candle intervals are the same',
            { symbol: symbol, candleInterval: this.candleInterval2 });
          return true;
        }
        if (await this.isSecondaryBuyCheck(symbol, this.candleInterval3, '3rd')) {
          if (this.candleInterval3 === this.candleInterval4) {
            this.logger.info('Checking the fourth buy indicator is skipped as candle intervals are the same',
              { symbol: symbol, candleInterval: this.candleInterval3 });
            return true;
          }
          return (await this.isSecondaryBuyCheck(symbol, this.candleInterval4, '4th'));
        }
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

  adjustBalanceToMinQty(myBaseBalance, symbolInfo) { // this is to ignore small not convertible amounts
    let minAllowedAmount = this.getFilter(symbolInfo, 'LOT_SIZE', 'minQty');
    return +myBaseBalance < +minAllowedAmount ? 0 : myBaseBalance;
  }

  getBalance(mySymbols, asset) {
    for (var i = 0; i < mySymbols.length; i++) {
      if (asset === mySymbols[i].asset) { // got from rest
        return [Number(mySymbols[i].free), Number(mySymbols[i].locked)];
      }
      if (asset === mySymbols[i].a) { // updated from WSS
        return [Number(mySymbols[i].f), Number(mySymbols[i].l)];
      }
    }
    // throw new Error('Not found info about asset....' + asset);
    return [0, 0];
  };

  getLen(s) { // return the length after that
    var arr = s.split('.');
    arr = arr[1].split('1');
    return arr[0].length;
  }

  getFilter(symbolInfo, filterType, value) {
    var filtered = symbolInfo.filters.filter(elem => filterType === elem.filterType);
    return filtered[0][value];
  }

  /*
  formatBuyAmount(qty, symbolInfo) {
    let minAllowedAmount = this.getFilter(symbolInfo, 'LOT_SIZE', 'minQty');
    // return (Math.floor(qty / minAllowedAmount) * minAllowedAmount).toFixed(8);

    if (Number(minAllowedAmount) === 1) {
      return Math.floor(qty);
    }
    let i = this.getLen(minAllowedAmount);
    var f = Math.pow(10, i + 1);
    return Math.floor(balance * f) / f;
  }
  */

  // (myQuoteBalance, limitToBuy, symbolInfo, nGreen)
  getBuyAmount(balance, limitToSpent, symbolInfo, avgPrice) {
    let minAllowedAmount = this.getFilter(symbolInfo, 'LOT_SIZE', 'minQty');
    // let minNotional = this.getFilter(symbolInfo, 'MIN_NOTIONAL', 'minNotional');
    if (minAllowedAmount > 0) {
      // 0.95 is multiplied trying to avoid -2010 when not insufficent funds
      let toBeSpent = Math.min(balance * 0.95, limitToSpent);

      // if (toBeSpent < minNotional) {
      // return [0, 0];
      // }

      let toBuy = (toBeSpent / avgPrice);
      toBuy = (Math.floor(toBuy / minAllowedAmount) * minAllowedAmount).toFixed(8);

      return [toBeSpent, toBuy]; // calculate max amount to be paid
    } else {
      throw new Error('Not found minimal allowed amount....' + symbolInfo);
    }
  };

  formatPrice(price, symbolInfo) {
    let tickSize = this.getFilter(symbolInfo, 'PRICE_FILTER', 'tickSize');
    let i = this.getLen(tickSize);

    var f = Math.pow(10, i + 1);
    return Math.floor(price * f) / f;
  }

  checkMinNotion(limitStopPrice, buyAmount, symbolInfo) {
    let minNotional = this.getFilter(symbolInfo, 'MIN_NOTIONAL', 'minNotional');
    return (minNotional < limitStopPrice * buyAmount);
  }

  getSellAmount(balance, symbolInfo) {
    let minAllowedAmount = this.getFilter(symbolInfo, 'LOT_SIZE', 'minQty');
    if (Number(minAllowedAmount) === 1) {
      return Math.floor(balance);
    }
    let i = this.getLen(minAllowedAmount);

    var f = Math.pow(10, i + 1);
    return Math.round(balance * f) / f;

    // return Number(balance).toFixed(i + 1);
  }
}

module.exports = CalcIndicators;
