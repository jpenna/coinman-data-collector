const Telegraf = require('telegraf');
const debug = require('debug')('collector:core');
const fileLogger = require('simple-node-logger').createSimpleLogger('logs/errors.log');

class Spokesman {
  constructor() {
    debug('Initializing Telegram bot');
    this.whiteList = JSON.parse(process.env.TELEGRAM_WHITE_LIST);
    this.bot = new Telegraf(process.env.TELEGRAM_TOKEN);

    this.setupTelegram();
  }

  register({ wsHandler, dbManager, sourceSet }) {
    this.wsHandler = wsHandler;
    this.dbManager = dbManager;
    this.sourceSet = sourceSet;
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

      .command('status', (ctx) => {
        let text = `Running for ${((Date.now() - this.wsHandler.startTime) / 60000).toFixed(0)} minutes.\n`;
        const { missingPairs } = this.wsHandler.binanceWS;
        if (missingPairs.size) {
          text += `👎 Not all assets are running (${missingPairs.size}): ${missingPairs.toString()}.`;
        } else {
          text += '👍 All assets are running.';
        }
        ctx.reply(text);
      })

      .command('pairs', (ctx) => {
        let text = '';
        this.sourceSet.forEach((info) => {
          text += `*${info.source} (${info.interval})*\n`;
          info.pairs.forEach((pair) => {
            text += `    • ${pair}\n`;
          });
          text += '\n';
        });
        ctx.replyWithMarkdown(text);
      })

      .command('files', (ctx) => {
        let text = '';
        const groups = new Map();
        this.dbManager.writeStreams.forEach((stream) => {
          const [,, file] = stream.path.split('/');
          const [source, pair, interval] = file.split('_');
          const groupName = `${source} (${interval})`;
          const line = `${pair} - ${(stream.bytesWritten / 1000000).toFixed(2)}MB\n`;
          const group = groups.get(groupName);
          if (!group) return groups.set(groupName, [line]);
          group.push(line);
        });
        groups.forEach((lines, group) => {
          text += `*${group}*\n`;
          lines.forEach(line => text += `   • ${line}\n`);
        });
        ctx.replyWithMarkdown(text);
      })

      .hears('apocalypse', (ctx) => {
        ctx.reply('☄️ The world is ending?');
        this.apocalypse = true;
        setTimeout(() => {
          this.apocalypse = false;
        }, 10000);
      })

      .hears('yes', (ctx) => {
        if (!this.apocalypse) return;
        ctx.reply('💥 Shit, ending bot');
        process.emit('quit');
      })

      .catch(fileLogger.error)

      .startPolling();
  }
}

module.exports = Spokesman;
