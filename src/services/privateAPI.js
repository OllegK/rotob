'use strict';

require('dotenv').config();
const API_KEY = process.env.API_KEY;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

const logger = require('./logger').init();
const telegramBot = require('./telegramBot');
const stateManager = require('./stateManager');

const axios = require('axios');
axios.defaults.baseURL = 'https://api.binance.com/api/v3';

const crypto = require('crypto');

class PrivateAPI {

  // https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md

  constructor() {
    this.recvWindow = 10000;
  }

  async getAccount() {
    let accountUrl = '/account';
    try {
      let timestamp = new Date().getTime();
      let signature = crypto.createHmac('sha256',
        API_SECRET_KEY).update(`timestamp=${timestamp}&recvWindow=${this.recvWindow}`).digest('hex');
      let response = await axios.get(accountUrl, {
        params: {
          timestamp: timestamp,
          recvWindow: this.recvWindow,
          signature: signature,
        },
        headers: {
          'X-MBX-APIKEY': API_KEY,
        },
      });
      return response.data.balances;
    } catch (err) {
      logger.error('Error calling getAccount');
      logger.error(err.response.data);
      console.log(err);
      await telegramBot.sendMessage(
        `I am off because I got an error checking the account info - ${JSON.stringify(err.response.data)}`);
      process.exit();
    }
  };

  async placeMarketOrder(timeout, symbol, side, quantity, isTest) {

    let orderUrl = '/order';
    if (isTest) {
      orderUrl += '/test';
    }

    let timestamp = new Date().getTime();

    try {
      var params = {
        symbol: symbol,
        side: side,
        type: 'MARKET',
        quantity: quantity,
        timestamp: timestamp,
        recvWindow: this.recvWindow,
      };
      let query = Object.keys(params).reduce(function (a, k) {
        a.push(k + '=' + encodeURIComponent(params[k]));
        return a;
      }, []).join('&');
      logger.info('Placing market order', params);
      let signature = crypto.createHmac('sha256', API_SECRET_KEY).update(query).digest('hex');
      params.signature = signature;
      let response = await axios.post(orderUrl, '', {
        params: params,
        headers: {
          'X-MBX-APIKEY': API_KEY,
        },
      });
      stateManager.storeOrder(symbol, side, timestamp, quantity);
      logger.info('Placed market order, taking a rest', params);
      await telegramBot.sendMessage(
        `I sucessfully placed the market order for ${symbol}, need to rest a little bit`);
      await timeout(10000);
      return response;
    } catch (err) {
      console.log(err);
      logger.error('Error placing the order');
      logger.error(err.response.data);
      console.log(err);
      await telegramBot.sendMessage(
        `I am off because I got an error placing the order for ${symbol} - ${JSON.stringify(err.response.data)}`);
      process.exit();
    }
  };

}

module.exports = new PrivateAPI();
