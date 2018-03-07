'use strict';

const WebSocket = require('ws');

class BinanceWss {

  constructor(listenKey) {
    this.listenKey = listenKey;
  }

  start(func) {

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${this.listenKey}`);

    ws.on('open', () => console.log('ws open'));

    ws.on('message', message => {
      let msg;
      try {
        msg = JSON.parse(message);
        func(msg);
      } catch (e) {
        throw new Error(e);
      }
    });
  }
}

module.exports = BinanceWss;
