const binanceApi = require('binance');
const MissingPairs = require('../tools/missingPairs');
const coreLog = require('debug')('collector:core');
const bnbLog = require('debug')('collector:binance');

bnbLog.log = console.error.bind(console); // eslint-disable-line no-console

let instancesCount = 0;
class BinanceWS {
  constructor({ beautify = false, pairs, letterMan, pairsTimeout, allConnected }) {
    this.beautify = beautify;
    this.pairs = pairs;
    this.letterMan = letterMan;
    this.pairsTimeout = pairsTimeout;
    this.missingPairs = new MissingPairs({ pairs });

    this.reportAllConnected = allConnected;

    this.messageHandler = this.getMessageHandler();

    // For logging
    this.instance = instancesCount;
    instancesCount++;

    this.connect();
  }

  connect() {
    coreLog(`Initializing Binance WS (${this.instance})`);
    const bnbWS = new binanceApi.BinanceWS(this.beautify);
    const { streams } = bnbWS;

    const candleStreams = this.pairs.map(pair => streams.kline(pair, '30m'));

    this.wsPromise = bnbWS.onCombinedStream(
      candleStreams,
      this.wsCallback.bind(this),
    );
  }

  wsCallback(...args) {
    this.messageHandler(...args);
  }

  drop() {
    coreLog('Dropping Binance WS');
    this.isDropped = true;
    clearTimeout(this.wsTimeout);
    // Disconnect socket
    this.wsPromise.then(socket => socket.disconnect());
    // If no internet connection, disconnect on new message
    this.messageHandler = () => {
      this.wsPromise.then(socket => socket.disconnect && socket.disconnect());
    };
  }

  upgradeMessageHandler() {
    this.messageHandler = this.getMessageHandler(true);
  }

  // Replace handler when all data is connected, so it won't check pair connection all the time
  getMessageHandler(upgrade) {
    const defaultHandler = ({ data }) => {
      const { k: { s: pair } } = data;
      this.missingPairs.refresh(pair, this.instance);
      this.letterMan.receivedBinanceCandle(pair, data);
    };

    if (upgrade) return defaultHandler;

    const startConn = Date.now();
    const pairsLength = this.pairs.length;
    const firstConnection = new Set(this.pairs);

    this.wsTimeout = setTimeout(this.pairsTimeout, 120000); // 2 min

    return ({ data }) => {
      const { k: { s: pair } } = data;
      defaultHandler({ data });
      if (firstConnection.has(pair)) {
        firstConnection.delete(pair);
        const connectedCount = pairsLength - this.missingPairs.size();
        bnbLog(`Connected ${pair} websocket (${connectedCount}/${pairsLength})`);

        if (!this.missingPairs.hasMissing()) {
          bnbLog(`All websockets connected (${((Date.now() - startConn) / 1000).toFixed(2)}sec)`);
          clearTimeout(this.wsTimeout);
          this.reportAllConnected();
        }
      }
    };
  }
}

module.exports = BinanceWS;
