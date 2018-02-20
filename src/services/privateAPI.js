'use strict';

const API_KEY = process.env.API_KEY;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

const logger = require('./logger').init();
const telegramBot = require('./telegramBot');
const stateManager = require('./stateManager');

const axios = require('axios');
axios.defaults.baseURL = 'https://api.binance.com/api/v3';

const crypto = require('crypto');

const timeout = ms => new Promise(res => setTimeout(res, ms));
const intervals = [100, 500, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 120000, 180000];

class PrivateAPI {

  // https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md

  constructor() {
    this.recvWindow = 10000;
  }

  async getAccount() {
    let accountUrl = '/account';
    for (let i = 0; i < intervals.length; i++) {
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
        console.log(err);
        logger.error('Error calling getAccount', err.response ? err.response.data : err);
        if (i === intervals.length - 1) {
          await telegramBot.sendMessage(
            `I am off because I got an error checking the account info - ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }
  };

  async placeMarketOrder(timeout, symbol, side, quantity, isTest) {

    let orderUrl = '/order';
    if (isTest) {
      orderUrl += '/test';
    }

    for (let i = 0; i < intervals.length; i++) {

      try {
        let timestamp = new Date().getTime();
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
        let signature = crypto.createHmac('sha256', API_SECRET_KEY).update(query).digest('hex');
        params.signature = signature;
        let response = await axios.post(orderUrl, '', {
          params: params,
          headers: {
            'X-MBX-APIKEY': API_KEY,
          },
        });
        stateManager.storeOrder(symbol, side, timestamp, quantity);
        await telegramBot.sendMessage(
          `I sucessfully placed the market order for ${symbol}, need to rest a little bit`);
        await timeout(10000);
        return response;
      } catch (err) {
        console.log(err);
        console.log(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
        logger.error('Error placing the order', err.response ? err.response.data : err);
        if (i === intervals.length - 1) {
          await telegramBot.sendMessage(
            `I am off because I got an error placing the order - ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }
  };

}

module.exports = new PrivateAPI();
