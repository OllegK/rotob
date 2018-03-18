'use strict';

const API_KEY = process.env.API_KEY;

const axios = require('axios');

class BinanceRest {

  constructor(logger, eventEmitter) {

    this.logger = logger;
    this.eventEmitter = eventEmitter;

    this.url = 'https://api.binance.com/api/v1/userDataStream';
    this.keepAliveInterval = 300000; // keep alive each 10 minutes

    process.on('SIGINT', async () => {
      await this.deleteUserStream();
      if (this.keepAliveIntervalId) {
        clearInterval(this.keepAliveIntervalId);
      }
      process.exit();
    });
    process.on('SIGTERM', async () => {
      await this.deleteUserStream();
      if (this.keepAliveIntervalId) {
        clearInterval(this.keepAliveIntervalId);
      }
      process.exit();
    });
  }

  async createListenKey() {

    try {
      let response = await axios.post(this.url, '', {
        headers: {
          'X-MBX-APIKEY': API_KEY,
        },
      });
      this.listenKey = response.data.listenKey;
      if (!this.keepAliveIntervalId) {
        this.keepAliveIntervalId =
          setInterval(() => this.keepAliveUserStream(), this.keepAliveInterval);
      }
      return this.listenKey;
    } catch (err) {
      console.log('Error create listen key');
      console.log(err.response ? err.response.data : err);
      this.logger.error('Error creating the listen key', {err: err.response ? err.response.data : err});
      throw new Error(err);
    }
  }

  async keepAliveUserStream() {
    if (!this.listenKey) {
      return;
    }
    try {
      return await axios.put(this.url, '', {
        params: {
          listenKey: this.listenKey,
        },
        headers: {
          'X-MBX-APIKEY': API_KEY,
        },
      });
    } catch (err) {
      console.log('Error keepAliveUserStream');
      console.log(err.response ? err.response.data : err);
      this.logger.error('Error refreshing the listen key', {err: err.response ? err.response.data : err});
      if (err.response) {
        if (err.response.data) {
          if (err.response.data.code === -1125) {
            // clearInterval(this.keepAliveIntervalId);
            this.eventEmitter.emit('needReconnect');
            return;
          }
        }
      }
      throw new Error(err);
    }
  }

  async deleteUserStream() {
    console.log('delete user stream');
    if (!this.listenKey) {
      return;
    }
    try {
      return await axios.delete(this.url, {
        params: {
          listenKey: this.listenKey,
        },
        headers: {
          'X-MBX-APIKEY': API_KEY,
        },
      });
    } catch (err) {
      console.log('Error deleteUserStream');
      console.log(err.response ? err.response.data : err);
      this.logger.error('Error deleting the listen key', {err: err.response ? err.response.data : err});
      throw new Error(err);
    }
  }

}

module.exports = BinanceRest;
