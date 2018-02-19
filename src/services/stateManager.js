'use strict';

const fs = require('fs');
const path = require('path');

class StateManager {

  constructor() {
    this.filePath = path.join(__dirname, '/../../state.json');
  }

  initState(stateValidity) {
    var isValid = false;
    if (fs.existsSync(this.filePath)) {
      this.state = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      var timestamp = new Date().getTime();
      isValid = (timestamp - this.state.timestamp) < stateValidity;
    }
    if (!isValid) {
      this.state = {};
    }
    return isValid;
  }

  writeState() {

    if (this.state) {
      this.state.timestamp = new Date().getTime();
    } else {
      console.log('this.state is null');
    }

    fs.writeFileSync(this.filePath, JSON.stringify(this.state), 'utf8');
  }

  checkSymbol(symbol) {
    if (!this.state.hasOwnProperty(symbol)) {
      this.state[symbol] = {};
    }
  }

  storeSignals(symbol, isSellSignal, isBuySignal, avgPrice, initState) {
    let timestamp = initState ? 0 : new Date().getTime();
    this.checkSymbol(symbol);
    let storedSignal = this.state[symbol].signal || '';
    if (!isSellSignal && !isBuySignal) {
      delete this.state[symbol].signal;
      delete this.state[symbol].timestamp;
      delete this.state[symbol].green;
      this.writeState();
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
      this.writeState();
    } else if (isSellSignal) {
      this.state[symbol].signal = 'SELL';
      this.state[symbol].timestamp = timestamp;
      this.state[symbol].green = avgPrice;
      this.writeState();
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

  getBuyTime(symbol) {
    if (this.state[symbol]) {
      return this.state[symbol].ORDER_BUY || 0;
    }
    return 0;
  }

  storeOrder(symbol, side, timestamp, quantity) {
    this.checkSymbol(symbol);
    this.state[symbol]['ORDER_' + side] = timestamp;
    this.state[symbol]['ORDER_' + side + '_QTY'] = quantity;
    this.writeState();
  }

}

module.exports = new StateManager();
