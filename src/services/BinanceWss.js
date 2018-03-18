'use strict';

// const WebSocket = require('ws');
const WebSocket = require('./WebSocketClient');

class BinanceWss {

  constructor(eventEmitter) {
    // this.eventEmitter = eventEmitter;
    this.wsc = new WebSocket(eventEmitter);
  }

  start(listenKey, func) {

    this.listenKey = listenKey;

    /* const ws = new WebSocketClient(`wss://stream.binance.com:9443/ws/${this.listenKey}`);

    ws.on('open', () => console.log('ws open'));

    ws.on('message', message => {
      let msg;
      try {
        msg = JSON.parse(message);
        func(msg);
      } catch (e) {
        throw new Error(e);
      }
    }); */

    // this.wsc.close();
    this.wsc.prototype.removeAllListeners();

    this.wsc.open(`wss://stream.binance.com:9443/ws/${this.listenKey}`);

    this.wsc.onopen = function () {
      console.log('WebSocketClient connected');
    };

    this.wsc.onmessage = function (data, flags, number) {
      // console.log(`WebSocketClient message #${number}: `, data);
      let msg;
      try {
        msg = JSON.parse(data);
        func(msg);
      } catch (e) {
        throw new Error(e);
      }
    };
  }
}

module.exports = BinanceWss;
