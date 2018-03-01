'use strict';

const axios = require('axios');
const telegramBot = require('./telegramBot');

const timeout = ms => new Promise(res => setTimeout(res, ms));
const intervals = [100, 500, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 120000, 180000];

class PublicAPI {

  constructor(logger) {
    this.logger = logger;
  }

  async getCandles(symbol, interval, limit) {
    let candlesUrl = 'https://api.binance.com/api/v1/klines';
    for (let i = 0; i < intervals.length; i++) {
      try {
        let response = await axios.get(candlesUrl, {
          params: {
            symbol: symbol,
            interval: interval,
            limit: limit,
          },
        });
        return response.data;
      } catch (err) {
        console.log(err);
        this.logger.error('Error calling getCandles', err.response ? err.response.data : err);
        if (i === intervals.length - 1) {
          await telegramBot.sendMessage(
            `I am off because I got an error getting the candles -
              ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          this.logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }
  };

  async getExchangeInfo() {
    let infoUrl = 'https://api.binance.com/api/v1/exchangeInfo';
    for (let i = 0; i < intervals.length; i++) {
      try {
        let response = await axios.get(infoUrl);
        return response.data.symbols;
      } catch (err) {
        console.log(err);
        this.logger.error('Error calling getExchangeInfo', err.response ? err.response.data : err);
        if (i === intervals.length - 1) {
          await telegramBot.sendMessage(
            `I am off because I got an error getting the exchange info -
              ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          this.logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }
  };

  async getServerTime() {
    let timeUrl = 'https://api.binance.com/api/v1/time';
    for (let i = 0; i < intervals.length; i++) {
      try {
        let t1 = new Date().getTime();
        let response = await axios.get(timeUrl);
        let timeToCall = new Date().getTime() - t1;
        // if > 0, it means client's time > server's time
        // should be deducted from generated timestam
        let timeDifference = Math.round(0 + new Date().getTime() - response.data.serverTime - timeToCall / 2);
        return timeDifference;
      } catch (err) {
        console.log(err);
        this.logger.error('Error calling getTime', err.response ? err.response.data : err);
        if (i === intervals.length - 1) {
          await telegramBot.sendMessage(
            `I am off because I got an error getting the server time -
              ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          this.logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }
  };

}

module.exports = PublicAPI;
