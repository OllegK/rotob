'use strict';

const axios = require('axios');
const logger = require('./logger').init();


module.exports = new class TelegramBot {

  constructor() {
    this.bot = process.env.BOT;
    this.chatId = process.env.CHAT_ID;
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

  // https://api.telegram.org/bot437516306:AAEusnPwYEWnBWPmHyhiSN3tuOcuThG_4fQ/
  // sendMessage?chat_id=384438001&parse_mode=html&text=test1234

};
