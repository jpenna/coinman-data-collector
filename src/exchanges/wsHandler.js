const logger = require('debug')('collector:wsHandler');

const BinanceWS = require('./binanceWS');

// TODO Instead of doing the replace logic inside binanceWS, use 2 instances and replace here

class WsHandler {
  constructor({ beautify = false, sendMessage, pairs, letterMan }) {
    this.beautify = beautify;
    this.sendMessage = sendMessage;
    this.pairs = pairs;
    this.letterMan = letterMan;

    this.missingSet = new Set();
    this.prevMissingSet = new Set();
    this.startTime = Date.now();

    this.isReplacing = false;
  }

  wsTimeout() {
    const text = 'Timeout. All websockets did not connect on time (2 min)';
    logger(text);
    this.sendMessage(`📝⚠️ ${text}`);

    console.log('cancel bot. replace:', !!this.newBinanceWS, 'this.isReplacing:', this.isReplacing);

    if (!this.newBinanceWS) return process.emit('quit');

    this.isReplacing = false;
    this.newBinanceWS.drop();
  }

  processReplace() {
    console.log('process replace start');

    this.isReplacing = true;
    this.newBinanceWS = new BinanceWS({
      beautify: false,
      pairs: this.pairs,
      letterMan: this.letterMan,
      wsTimeout: this.wsTimeout.bind(this),
      allConnected: this.allConnected.bind(this),
    });
  }

  replace() {
    console.log('replace ws');

    if (this.newBinanceWS.isDropped) return;
    console.log('is not dropped, so replace');

    this.binanceWS.drop();
    this.binanceWS = this.newBinanceWS;
    this.isReplacing = false;
  }

  start() {
    logger('Start WS Handler');

    this.binanceWS = new BinanceWS({
      beautify: false,
      pairs: this.pairs,
      letterMan: this.letterMan,
      wsTimeout: this.wsTimeout.bind(this),
      allConnected: this.allConnected.bind(this),
    });
  }

  allConnected() {
    if (this.isReplacing) this.replace();
    this.binanceWS.upgradeMessageHandler();
    this.checkConnection();
  }

  checkConnection() {
    console.log('checking connection');

    const runningFor = `(${((Date.now() - this.startTime) / 60000).toFixed(0)} minutes)`;

    // Logs
    if (this.binanceWS.missingPairs.size()) {
      const msg = `Running for ${runningFor}. Not all assets are running (${this.binanceWS.missingPairs.size()}): ${this.binanceWS.missingPairs.toString()}. Replacing: ${this.isReplacing}.`;
      logger(msg);
    } else {
      logger(`All assets are running ${runningFor}`);
    }

    console.log(`has missing (${this.binanceWS.instance})`, this.binanceWS.missingPairs.hasMissing());
    console.log('is replacing', this.isReplacing);

    const startReplace = this.binanceWS.missingPairs.hasMissing();

    if (startReplace && !this.isReplacing) this.processReplace();
    else if (this.isReplacing && !startReplace) {
      this.isReplacing = false;
      this.newBinanceWS.abort();
    }

    // this.checkConnectionTimeout = setTimeout(this.checkConnection.bind(this), 180000); // 3 minutes
    clearTimeout(this.checkConnectionTimeout);
    this.checkConnectionTimeout = setTimeout(this.checkConnection.bind(this), 10000); // 3 minutes
  }
}

module.exports = WsHandler;
