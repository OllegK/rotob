'use strict';

// const WebSocket = require('ws');
const WebSocket = require('./WebSocketClient');

class BinanceWss {

  constructor(listenKey, eventEmitter) {
    this.listenKey = listenKey;
    this.eventEmitter = eventEmitter;
  }

  start(func) {

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

    var wsc = new WebSocket(this.eventEmitter);
    wsc.open(`wss://stream.binance.com:9443/ws/${this.listenKey}`);

    wsc.onopen = function () {
      console.log('WebSocketClient connected');
    };

    wsc.onmessage = function (data, flags, number) {
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
