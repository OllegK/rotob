'use strict';

const fs = require('fs');
const path = require('path');

class StateManager {

  constructor() {
    this.filePath = path.join(__dirname, '/../../state.json');
    this.mongoURL = process.env.MONGODB_URI;
    this.isMongo = (typeof this.mongoURL !== 'undefined');
    if (this.isMongo) {
      console.log('THERE IS MONGO');
      this.MongoClient = require('mongodb').MongoClient;
    } else {
      console.log('THERE IS NO MONGO');
    }
  }

  async initState(stateValidity) {
    var isValid = false;
    this.state = {timestamp: 0};
    if (this.isMongo) {
      let client = await this.MongoClient.connect(this.mongoURL);
      let db = client.db(client.s.options.dbName);
      db.createCollection('state');
      this.collection = db.collection('state');
      var arr = await this.collection.find({state: 'robotState'}).toArray();
      if (arr.length === 1) {
        this.state = arr[0];
        console.log(JSON.stringify(this.state));
      }
    } else {
      if (fs.existsSync(this.filePath)) {
        this.state = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    }
    isValid = (new Date().getTime() - this.state.timestamp) < stateValidity;
    if (!isValid) {
      await this.invalidateState();
    }
    return isValid;
  }

  async writeState() {
    if (!this.state) {
      return;
    }
    this.state.timestamp = new Date().getTime();
    this.state.state = 'robotState';

    if (this.isMongo) {
      await this.collection.update({state: 'robotState'}, this.state, { upsert: true });
    } else {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state), 'utf8');
    }
  }

  async invalidateState() {
    for (var key in this.state) {
      delete this.state[key].signal;
      delete this.state[key].timestamp;
      delete this.state[key].green;
    }
    await this.writeState();
  }

  checkSymbol(symbol) {
    if (!this.state.hasOwnProperty(symbol)) {
      this.state[symbol] = {};
    }
  }

  async storeSignals(symbol, isSellSignal, isBuySignal, avgPrice, initState) {
    let timestamp = initState ? 0 : new Date().getTime();
    this.checkSymbol(symbol);
    let storedSignal = this.state[symbol].signal || '';
    if (!isSellSignal && !isBuySignal) {
      delete this.state[symbol].signal;
      delete this.state[symbol].timestamp;
      delete this.state[symbol].green;
      await this.writeState();
    } else if (isSellSignal && isBuySignal) {
      throw new Error('both signal are true');
    } else if (('BUY' === storedSignal) && isBuySignal) {
      // do nothing
    } else if (('SELL' === storedSignal) && isSellSignal) {
      // do nothing
    } else if (isBuySignal) {
      this.state[symbol].signal = 'BUY';
      this.state[symbol].timestamp = timestamp;
      this.state[symbol].green = avgPrice;
      await this.writeState();
    } else if (isSellSignal) {
      this.state[symbol].signal = 'SELL';
      this.state[symbol].timestamp = timestamp;
      this.state[symbol].green = avgPrice;
      await this.writeState();
    } else {
      throw new Error('should not be here');
    }
  }

  getBuySignalTime(symbol) {
    if (this.state[symbol]) {
      if (this.state[symbol].signal === 'BUY') {
        return this.state[symbol].timestamp;
      }
    }
    throw new Error('Get buy signal time is not found. It should never happen!');
  }

  /*
    getOrderId(symbol) {
      if (this.state[symbol]) {
        return this.state[symbol].ORDER_BUY_ID;
      }
      throw new Error('get order id exception!');
    }
  */

  /*
  getBuyTime(symbol) {
    if (this.state[symbol]) {
      return this.state[symbol].ORDER_BUY || 0;
    }
    return 0;
  }
  */

  getBuyPrice(symbol) {
    if (this.state[symbol]) {
      return this.state[symbol].ORDER_BUY_AVG || 0;
    }
    return 0;
  }

  async storeOrder(symbol, side, timestamp, quantity, orderId, avg) {
    if (!this.state) {
      return; // for testing api
    }
    this.checkSymbol(symbol);
    this.state[symbol]['ORDER_' + side] = timestamp;
    this.state[symbol]['ORDER_' + side + '_QTY'] = quantity;
    this.state[symbol]['ORDER_' + side + '_ID'] = orderId;
    if (avg) { // only for buy
      this.state[symbol]['ORDER_' + side + '_AVG'] = avg;
    }
    await this.writeState();
  }

  getState() {
    return this.state;
  }

}

module.exports = new StateManager();
