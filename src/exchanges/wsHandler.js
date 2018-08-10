const logger = require('debug')('collector:wsHandler');

const BinanceWS = require('./binanceWS');

class WsHandler {
  constructor({ beautify = false, sendMessage, pairs, letterMan }) {
    this.beautify = beautify;
    this.sendMessage = sendMessage;
    this.pairs = pairs;
    this.letterMan = letterMan;

    this.missingSet = new Set();
    this.prevMissingSet = new Set();
    this.startTime = Date.now();
  }

  // TODO 4 fetch missing data from REST and send it, so it wont have holes for too long
  pairsTimeout() {
    const text = `Timeout. All websockets did not connect on time (2 min)(${this.binanceWS.instance})`;
    logger(text);
    this.sendMessage(`⚠️ ${text}`);

    // If is first ws connection
    if (!this.newBinanceWS) return this.processReplace();

    this.dropNewBinanceWS();
  }

  dropNewBinanceWS() {
    this.newBinanceWS.drop();
    this.newBinanceWS = null; // GC
  }

  processReplace() {
    this.newBinanceWS = new BinanceWS({
      beautify: false,
      pairs: this.pairs,
      letterMan: this.letterMan,
      pairsTimeout: this.pairsTimeout.bind(this),
      allConnected: this.allConnected.bind(this),
    });
  }

  replace() {
    if (!this.newBinanceWS) return;
    this.binanceWS.drop();
    this.binanceWS = this.newBinanceWS;
    this.newBinanceWS = null; // GC
    this.sendMessage('🔗 New WS connected');
  }

  start() {
    if (!this.pairs.length) return; // Only for development (testing)
    logger('Start WS Handler');
    this.binanceWS = new BinanceWS({
      beautify: false,
      pairs: this.pairs,
      letterMan: this.letterMan,
      pairsTimeout: this.pairsTimeout.bind(this),
      allConnected: this.allConnected.bind(this),
    });
  }

  allConnected(startConn) {
    logger(`All websockets connected (${startConn ? ((Date.now() - startConn) / 1000).toFixed(2) : '- '}sec)`);
    if (this.newBinanceWS) this.replace();
    this.binanceWS.upgradeMessageHandler();
    this.checkConnection();
  }

  checkConnection() {
    const runningFor = `(${((Date.now() - this.startTime) / 60000).toFixed(0)} minutes)`;

    // Logs
    if (this.binanceWS.missingPairs.size) {
      const msg = `(${this.binanceWS.instance}) Running for ${runningFor}. Not all assets are running (${this.binanceWS.missingPairs.size}): ${this.binanceWS.missingPairs.toString()}. Replacing: ${!!this.newBinanceWS}.`;
      logger(msg);
    } else {
      logger(`(${this.binanceWS.instance}) All assets are running ${runningFor}`);
    }

    const startReplace = this.binanceWS.missingPairs.checkThreshold();

    if (startReplace && !this.newBinanceWS) {
      this.processReplace();
    } else if (this.newBinanceWS && !startReplace) {
      this.dropNewBinanceWS();
      this.sendMessage('🔗 Reconnected with same WS');
    } else if (!this.newBinanceWS && this.binanceWS.missingPairs.size) {
      console.log(`Start singles (${this.binanceWS.instance})`);
      this.binanceWS.createSingleWS();
    }

    clearTimeout(this.checkConnectionTimeout);
    this.checkConnectionTimeout = setTimeout(this.checkConnection.bind(this), 120000); // 2 minutes
  }
}

module.exports = WsHandler;
