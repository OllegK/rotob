'use strict';

const WebSocket = require('ws');

function WebSocketClient() {
  this.number = 0;	// Message number
  this.autoReconnectInterval = 1000;	// ms
}

WebSocketClient.prototype.open = function (url) {
  this.url = url;
  this.instance = new WebSocket(this.url);
  this.instance.on('open', () => {
    this.onopen();
  });
  this.instance.on('message', (data, flags) => {
    this.number++;
    this.onmessage(data, flags, this.number);
  });
  this.instance.on('close', (e) => {
    console.log('this instance on closed', e);
    switch (e) {
      case 1000:	// CLOSE_NORMAL
        console.log('WebSocket: closed');
        break;
      default:	// Abnormal closure
        console.log('WebSocket: instance on closed before reconnect');
        this.reconnect(e);
        break;
    }
    // this.onclose(e);
  });
  this.instance.on('error', (e) => {
    console.log('this instance on error', e.code);
    switch (e.code) {
      case 'ECONNREFUSED':
        this.reconnect(e);
        break;
      default:
        console.log('before this on error - ' + e.code);
        this.onerror(e);
        console.log('unrecognized error in WebSocketClient - ' + e.code);
        this.reconnect(e);
        break;
    }
  });
  this.instance.on ('ping', () => {
    console.log('ping ................');
    this.ping('pingdata');
  });
  if (!this.interval) {
    console.log('Setting interval... '); // when to clear interval
    this.interval = setInterval(() => {
    //  this.send('ping');
      this.instance.emit('ping');
    }, 5000);
  }
};

WebSocketClient.prototype.send = function (data, option) {
  try {
    this.instance.send(data, option);
  } catch (e) {
    console.log('catch exception in send');
    this.instance.emit('error', e);
  }
};

WebSocketClient.prototype.reconnect = function (e) {
  console.log(`WebSocketClient: retry in ${this.autoReconnectInterval}ms`, e);
  this.instance.removeAllListeners();
  // var that = this;
  setTimeout(() => {
    console.log('WebSocketClient: reconnecting...');
    this.open(this.url);
  }, this.autoReconnectInterval);
};

WebSocketClient.prototype.onopen = function (e) { console.log('WebSocketClient: open', arguments); };
WebSocketClient.prototype.onmessage = function (data, flags, number) {
  console.log('WebSocketClient: message', arguments);
};
WebSocketClient.prototype.onerror = function (e) { console.log('WebSocketClient: error', arguments); };
WebSocketClient.prototype.onclose = function (e) { console.log('WebSocketClient: closed', arguments); };

module.exports = WebSocketClient;
