const Telegraf = require('telegraf');
const debug = require('debug')('collector:core');

function init() {
  debug('Initializing Telegram bot');

  const whiteList = JSON.parse(process.env.TELEGRAM_WHITE_LIST);

  const isWhiteListed = id => whiteList.includes(id);

  const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

  bot.use((ctx, next) => {
    if (isWhiteListed(ctx.from.id)) next(ctx);
    return null;
  });

  bot.start((ctx) => {
    if (isWhiteListed(ctx.from.id)) return ctx.reply('Welcome Mr.');
    ctx.reply('You are not welcome here, get out.');
  });

  bot.catch(debug);

  bot.startPolling();

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
