const logger = require('debug')('collector:wsHandler');
const fileLogger = require('simple-node-logger').createSimpleFileLogger('logs/binance.log');

const BinanceWS = require('./binanceWS');

/*
Handles the reconnection of the Websocket and
connection of single pairs if the pair is missing from the bundle

Currently only works with Binance because of the `pairs` param (which are pairs from Binance)
*/
class WsHandler {
  constructor({ beautify = false, sendMessage, pairs, postman }) {
    this.beautify = beautify;
    this.sendMessage = sendMessage;
    this.pairs = pairs;
    this.postman = postman;

    this.missingSet = new Set();
    this.prevMissingSet = new Set();
    this.startTime = Date.now();
    this.report24h = Date.now() + 86400000; // 1 day
  }

  // TODO 4 fetch missing data from REST and send it, so it wont have holes for too long
  /* Triggers if all pairs didn't connect after timeout. Will retry a new connection */
  pairsTimeout() {
    const text = `Timeout. All websockets did not connect on time (2 min)(${this.binanceWS.instance})`;
    logger(text);
    this.sendMessage(`⚠️ ${text}`);

    // If is first ws connection
    if (!this.newBinanceWS) return this.processReplace();

    this.dropNewBinanceWS();
  }

  /* Call it to cancel the reconnection */
  dropNewBinanceWS() {
    this.newBinanceWS.drop();
    this.newBinanceWS = null; // GC
  }

  /* Start reconnection */
  processReplace() {
    this.newBinanceWS = new BinanceWS({
      beautify: false,
      pairs: this.pairs,
      postman: this.postman,
      pairsTimeout: this.pairsTimeout.bind(this),
      allConnected: this.allConnected.bind(this),
    });
  }

  /* Replace previous WS with the new one */
  replace() {
    if (!this.newBinanceWS) return;
    this.binanceWS.drop();
    this.binanceWS = this.newBinanceWS;
    this.newBinanceWS = null; // GC
    this.sendMessage('🔗 New WS connected');
  }

  /* Start Binance WS */
  start() {
    if (!this.pairs.length) return; // Only for development (testing)
    logger('Start WS Handler');
    this.binanceWS = new BinanceWS({
      beautify: false,
      pairs: this.pairs,
      postman: this.postman,
      pairsTimeout: this.pairsTimeout.bind(this),
      allConnected: this.allConnected.bind(this),
    });
  }

  /* Handle the changes when ALL PAIRS for the WS are connected */
  allConnected(startConn) {
    logger(`All websockets connected (${startConn ? ((Date.now() - startConn) / 1000).toFixed(2) : '- '}sec)`);
    if (this.newBinanceWS) this.replace();
    this.binanceWS.upgradeMessageHandler();
    this.checkConnection();
  }

  /*
  Check WS connection to see if all pairs were received on a timely basis.
  Log the information and, if needed, (1) start replacing the connection
  or (2) start new single connection for the pair
  */
  checkConnection() {
    const runningFor = `(${((Date.now() - this.startTime) / 60000).toFixed(0)} minutes)`;

    // Logs
    if (this.binanceWS.missingPairs.size) {
      const msg = `(${this.binanceWS.instance}) Running for ${runningFor}. Not all assets are running (${this.binanceWS.missingPairs.size}): ${this.binanceWS.missingPairs.toString()}. Replacing: ${!!this.newBinanceWS}.`;
      logger(msg);
      fileLogger.info(msg);
    } else {
      logger(`(${this.binanceWS.instance}) All assets are running ${runningFor}`);
      if (this.report24h < Date.now()) {
        this.sendMessage(`🕛 Running for ${runningFor} minutes`);
        this.report24h += 86400000;
      }
    }

    const startReplace = this.binanceWS.missingPairs.checkThreshold();

    if (startReplace && !this.newBinanceWS) {
      this.processReplace();
    } else if (this.newBinanceWS && !startReplace) {
      this.dropNewBinanceWS();
      this.sendMessage('🔗 Reconnected with same WS');
    } else if (!this.newBinanceWS && this.binanceWS.missingPairs.size) {
      this.binanceWS.createSingleWS();
    }

    clearTimeout(this.checkConnectionTimeout);
    this.checkConnectionTimeout = setTimeout(this.checkConnection.bind(this), 120000); // 2 minutes
  }
}

module.exports = WsHandler;
