'use strict';

const axios = require('axios');
const logger = require('./logger').init();
const telegramBot = require('./telegramBot');

class PublicAPI {


  async getCandles(symbol, interval, limit) {
    try {
      let candlesUrl = 'https://api.binance.com/api/v1/klines';
      let response = await axios.get(candlesUrl, {
        params: {
          symbol: symbol,
          interval: interval,
          limit: limit,
        },
      });
      return response.data;
    } catch (err) {
      logger.error('Error calling getCandles');
      logger.error(err.response.data);
      console.log(err);
      await telegramBot.sendMessage(
        `I am off because I got an error calling the get candles - ${JSON.stringify(err.response.data)}`);
      process.exit();
    }
  };

  async getExchangeInfo() {
    let infoUrl = 'https://api.binance.com/api/v1/exchangeInfo';
    try {
      let response = await axios.get(infoUrl);
      return response.data.symbols;
    } catch (err) {
      logger.error('Error calling getExchangeInfo');
      logger.error(err.response.data);
      console.log(err);
      await telegramBot.sendMessage(
        `I am off because I got an error calling the exchange info - ${JSON.stringify(err.response.data)}`);
      process.exit();
    }
  };

}

module.exports = new PublicAPI();
