const Telegraf = require('telegraf');
const debug = require('debug')('collector:core');

class Spokesman {
  constructor() {
    debug('Initializing Telegram bot');
    this.whiteList = JSON.parse(process.env.TELEGRAM_WHITE_LIST);
    this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);
    this.startTime = new Date();

    this.setupTelegram();
  }

  register({ wsHandler }) {
    this.wsHandler = wsHandler;
  }

  isWhiteListed(id) {
    return this.whiteList.includes(id);
  }

  sendMessage(msg) {
    this.bot.telegram
      .sendMessage(this.whiteList[0], msg, { parse_mode: 'Markdown' })
      .catch(e => debug('Telegram message error', e));
  }

  setupTelegram() {
    this.bot
      .use((ctx, next) => {
        if (this.isWhiteListed(ctx.from.id)) next(ctx);
        return null;
      })
      .start((ctx) => {
        if (this.isWhiteListed(ctx.from.id)) return ctx.reply('Welcome Mr.');
        ctx.reply('You are not welcome here, get out.');
      })
      // .hears('status', (ctx) => {
      //   let text = `Running for ${((Date.now() - this.wsHandler.startTime) / 60000).toFixed(0)} minutes.`;
      //   text +=
      //   ctx.reply(text);
      // })
      .hears('time', (ctx) => {
        ctx.reply('Envio do balanço');
      })
      .catch(debug)
      .startPolling();
  }
}

module.exports = Spokesman;
