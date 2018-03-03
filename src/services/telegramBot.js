'use strict';

const axios = require('axios');
const logger = require('./logger').init();


module.exports = new class TelegramBot {

  constructor() {
    this.bot = process.env.BOT;
    this.chatId = process.env.CHAT_ID;
    this.politeInterval = 600000;
    this.state = {};
  }

  getState() {
    return this.state();
  }

  canSend(symbol, type) {
    if (!this.state.hasOwnProperty(symbol)) {
      this.state[symbol] = {};
    }
    if (!this.state[symbol].hasOwnProperty(type)) {
      return true;
    }
    return ((new Date()).getTime() - this.state[symbol][type]) > this.politeInterval;
  }

  async sendMessage(msg) {
    try {
      await axios.get(`https://api.telegram.org/bot${this.bot}/sendMessage`, {
        params: {
          chat_id: this.chatId,
          parse_mode: 'html',
          text: msg,
        },
      });
    } catch (err) {
      console.log(err);
      logger.error('Error sending telegram message', err);
      if (err.response) {
        logger.error(err.response.data);
      }
    }
  }

  async sendPoliteMessage(symbol, type, msg) {
    if (this.canSend(symbol, type)) {
      this.state[symbol][type] = new Date().getTime();
      msg += `\\This is a polite message, i.e. it will not be repeated for this symbol during ${this.politeInterval}ms`;
      await this.sendMessage(msg);
    }
  }

  // https://api.telegram.org/bot437516306:AAEusnPwYEWnBWPmHyhiSN3tuOcuThG_4fQ/
  // sendMessage?chat_id=384438001&parse_mode=html&text=test1234

};
