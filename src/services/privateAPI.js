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
            `I am off because I got an error checking the account info -
              ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }
  };

  async cancelOrder(symbol, orderId) {

    let orderUrl = '/order';

    for (let i = 0; i < intervals.length; i++) {

      try {
        let timestamp = new Date().getTime();
        var params = {
          symbol: symbol,
          orderId: orderId,
          recvWindow: this.recvWindow,
          timestamp: timestamp
        };
        let query = Object.keys(params).reduce(function (a, k) {
          a.push(k + '=' + encodeURIComponent(params[k]));
          return a;
        }, []).join('&');
        let signature = crypto.createHmac('sha256', API_SECRET_KEY).update(query).digest('hex');
        params.signature = signature;
        return await axios.delete(orderUrl, '', {
          params: params,
          headers: {
            'X-MBX-APIKEY': API_KEY,
          },
        });
      } catch (err) {
        console.log(err);
        console.log(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
        logger.error('Error placing the cancel order', {err: err.response ? err.response.data : err});
        if (i === intervals.length - 1) {
          await telegramBot.sendMessage(
            `I am off because I got an error placing the cancel order -
              ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }
  }

  async placeOrder(side, type, symbol, quantity, isTest, stopPrice) {

    logger.info('place order arguments', arguments);

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
          type: type,
          quantity: quantity,
          timestamp: timestamp,
          recvWindow: this.recvWindow,
          newOrderRespType: 'FULL',
        };
        if ('STOP_LOSS_LIMIT' === type) {
          params.stopPrice = stopPrice;
          params.price = (0.95 * stopPrice).toFixed(7);
          params.timeInForce = 'GTC';
        }
        let query = Object.keys(params).reduce(function (a, k) {
          a.push(k + '=' + encodeURIComponent(params[k]));
          return a;
        }, []).join('&');
        let signature = crypto.createHmac('sha256', API_SECRET_KEY).update(query).digest('hex');
        params.signature = signature;
        return await axios.post(orderUrl, '', {
          params: params,
          headers: {
            'X-MBX-APIKEY': API_KEY,
          },
        });
      } catch (err) {
        console.log(err);
        console.log(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
        logger.error('Error placing the order', {err: err.response ? err.response.data : err});
        if (i === intervals.length - 1) {
          await telegramBot.sendMessage(
            `I am off because I got an error placing the order -
              ${err.response ? JSON.stringify(err.response.data) : 'no response'}`);
          process.exit();
        } else {
          logger.error(`Waiting ${intervals[i]}ms before retry, attempt ${i + 1}`);
          await timeout(intervals[i]);
        }
      }
    }

  }

  calcPrice(fills) {
    let obj = fills.reduce((a, b) => {
      a.sum += b.qty * b.price;
      a.qty += +b.qty;
      return a;
    }, {sum: 0, qty: 0});
    return obj.sum / obj.qty;
  }

  async placeMarketSellOrder(symbol, quantity, isTest) {
    let response = await this.placeOrder('SELL', 'MARKET', ...arguments);
    logger.info('The response from placing sell order', {response: response.data});
    stateManager.storeOrder(symbol, 'SELL', new Date().getTime(), quantity, response.data.orderId, 0);
    await telegramBot.sendMessage(
      `I sucessfully placed market SELL order for ${symbol}`); // todo : add more information here
  }

  async placeStopLossOrder(symbol, quantity, isTest, stopPrice) {
    let response = await this.placeOrder('SELL', 'STOP_LOSS_LIMIT', ...arguments);
    logger.info('The response from placing STOP LOSS order', {response: response.data});
    return response;
  }

  async placeMarketBuyOrder(symbol, quantity, isTest, placeStopLoss, acceptedLoss) {
    let response = await this.placeOrder('BUY', 'MARKET', ...arguments);
    logger.info('The response from placing buy order', {response: response.data});

    if (isTest) { // secure the process flow
      response.data.status = 'TEST';
      response.data.orderId = '3972316';
      response.data.fills = [{
        price: '0.00012801',
        qty: '1.00000000',
      }];
    }
    if (!response.data.fills) { // this is a temporary solution, hopefully
      await telegramBot.sendMessage('THE ORDER RESPONSE DOESNT CONTAIN FILLS SECTION, EXITTING....');
      logger.info('THE ORDER RESPONSE DOESNT CONTAIN FILLS SECTION, EXITTING....');
      process.exit();
    }
    const avg = this.calcPrice(response.data.fills);
    const status = response.data.status;
    // const transactTime - use THAT
    stateManager.storeOrder(symbol, 'BUY', new Date().getTime(), quantity, response.data.orderId, avg);
    await telegramBot.sendMessage(
      `I sucessfully placed market BUY order for ${symbol}, avg ${avg}, status ${status}`);
    if (placeStopLoss) {
      let stopPrice = avg * (100 - acceptedLoss) / 100;
      logger.info('The stop loss pricess is calculated', {stopPrice: stopPrice});
      let stopResponse = await this.placeStopLossOrder(symbol, quantity, isTest, stopPrice);
      logger.info('The response from placing stop loss order', {response: stopResponse.data});
      await telegramBot.sendMessage(
        `I sucessfully placed STOP LOSS order for ${symbol}, avg ${avg}, stop price ${stopPrice}`);
    }
  }
}

module.exports = new PrivateAPI();
