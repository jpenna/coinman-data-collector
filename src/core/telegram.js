const Telegraf = require('telegraf');
const debug = require('debug')('collector:core');

function init() {
  debug('Initializing Telegram bot');

  const whiteList = JSON.parse(process.env.TELEGRAM_WHITE_LIST);

  const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

  return {
    bot,
    sendMessage: (msg) => {
      console.log('sending telegram msg to Collector. should receive');

      bot.telegram
        .sendMessage(whiteList[0], msg, { parse_mode: 'Markdown' })
        .catch(e => debug('Telegram message error', e));
    },
  };
}

module.exports = { init };
