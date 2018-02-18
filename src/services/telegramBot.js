'use strict';

//require('dotenv').config();
const axios = require('axios');

module.exports = new class TelegramBot {

  constructor() {
    this.bot = process.env.BOT;
    this.chatId = process.env.CHAT_ID;
  }

  sendMessage(msg) {
    return axios.get(`https://api.telegram.org/bot${this.bot}/sendMessage`, {
      params: {
        chat_id: this.chatId,
        parse_mode: 'html',
        text: msg,
      },
    });
  }

  // https://api.telegram.org/bot437516306:AAEusnPwYEWnBWPmHyhiSN3tuOcuThG_4fQ/
  // sendMessage?chat_id=384438001&parse_mode=html&text=test1234

};
