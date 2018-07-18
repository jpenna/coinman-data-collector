const binanceApi = require('binance');
const MissingPairs = require('../tools/missingPairs');
const coreLog = require('debug')('collector:core');
const bnbLog = require('debug')('collector:binance');

bnbLog.log = console.error.bind(console); // eslint-disable-line no-console

let instancesCount = 0;

// TODO usar um formato proprio, pq fica extensivel para outras exchanges mais facil

class BinanceWS {
  constructor({ beautify = false, pairs, letterMan, pairsTimeout, allConnected }) {
    this.beautify = beautify;
    this.pairs = pairs;
    this.letterMan = letterMan;
    this.pairsTimeout = pairsTimeout;
    this.missingPairs = new MissingPairs({ pairs });
    this.klineInterval = '30m';
    this.singleWSMap = new Map();
    this.connectingSingleWSMap = new Map();

    this.reportAllConnected = allConnected;


    // For logging
    this.instance = instancesCount;
    instancesCount++;

    this.bnbWS = new binanceApi.BinanceWS(this.beautify);

    this.connectCombined();
  }

  connectCombined() {
    coreLog(`Initializing Binance WS (${this.instance})`);
    const { streams } = this.bnbWS;

    const candleStreams = this.pairs.map(pair => streams.kline(pair, this.klineInterval));

    this._combinedWS = this.bnbWS.onCombinedStream(
      candleStreams,
      this.getMessageHandler(),
    );
  }

  createSingleWS() {
    this.missingPairs.forEach((pair) => {
      this.connectSingle({ pair });
    });
  }

  connectSingle({ pair }) {
    bnbLog(`Creating single connection for ${pair} (${this.instance})`);
    const singleWS = this.bnbWS.onKline(
      pair,
      this.klineInterval,
      (function (data) {
        bnbLog(`Single WS connected for ${pair} (${this.instance})`);
        const thisWS = this.connectingSingleWSMap.get(pair);
        // might have been dropped before
        if (!thisWS)
          return console.log(`THIS CALLBACK SHOULDN\'T HAPPEN ${pair} (${this.instance})`);
        // Clear connecting
        this.connectingSingleWSMap.delete(pair);
        // If this is reconnection, drop the previous connection
        if (this.singleWSMap.has(pair)) {
          console.log(`Dropping previous single connection ${pair} (${this.instance})`);
          this.dropSingle(pair);
        }
        // Replace this callback for default message handler
        const callback = this.getMessageHandler({ single: true });
        thisWS.then(socket => socket.bnbEventHandler = callback);
        // Add ws to map
        this.singleWSMap.set(pair, singleWS);
        // Process received data
        callback(data);
      }).bind(this),
    );
    this.connectingSingleWSMap.set(pair, singleWS);
  }

  drop() {
    coreLog(`Dropping Binance WS (${this.instance})`);
    this.isDropped = true;
    clearTimeout(this.wsTimeout);
    this.missingPairs.clear();
    // Disconnect socket
    const combinedWS = this._combinedWS;
    combinedWS.then(socket => {
      socket.disconnect()
      // If no internet connection, disconnect on new message
      socket.bnbEventHandler = () => {
        combinedWS.then(socket => socket.disconnect && socket.disconnect());
      };
    });
    this.singleWSMap.forEach((v, k) => this.dropSingle(k));
  }

  dropSingle(pair, connecting) {
    const map = connecting ? this.connectingSingleWSMap : this.singleWSMap;
    const cnx = map.get(pair);
    if (!cnx) return console.log(`no connection single ${pair} (${this.instance})`);
    bnbLog(`Dropping single ${connecting ? 're' : ''}connection for ${pair} (${this.instance})`);
    cnx.then((socket) => {
      socket.disconnect();
      socket.bnbEventHandler = (function () {
        console.log(`handler of dropSingle ${pair} (${this.instance})`);
        cnx.then(socket => socket.disconnect && socket.disconnect());
      }).bind(this);
    });
    map.delete(pair);
  }

  upgradeMessageHandler() {
    this._combinedWS.then(socket => socket.bnbEventHandler = this.getMessageHandler({ upgrade: true }));
  }

  // Replace handler when all data is connected, so it won't check pair connection all the time
  getMessageHandler({ upgrade, single } = {}) {
    const defaultHandler = (function (msg) {
      const data = msg.data || msg;
      const { k: { s: pair } } = data;
      if (this.connectingSingleWSMap.has(pair)) {
        console.log('dropping single that is connecting pair');
        this.dropSingle(pair, true);
      }
      if (!single && this.singleWSMap.has(pair)) {
        console.log('this is not single, dropping single that is connected');
        return this.dropSingle(pair);
      }
      this.missingPairs.refresh(pair, this.instance);
      this.letterMan.receivedBinanceCandle(pair, data);
    }).bind(this);

    if (single || upgrade) return defaultHandler;

    const startConn = Date.now();
    const pairsLength = this.pairs.length;

    this.wsTimeout = setTimeout(this.pairsTimeout, 150000); // 2:30 min

    return (function ({ data }) {
      const { k: { s: pair } } = data;
      const firstConnection = this.missingPairs.has(pair);
      defaultHandler({ data });
      if (firstConnection) {
        const connectedCount = pairsLength - this.missingPairs.size;
        bnbLog(`Connected ${pair} websocket (${connectedCount}/${pairsLength})(${this.instance})`);

        if (!this.missingPairs.hasMissing()) {
          clearTimeout(this.wsTimeout);
          this.reportAllConnected(startConn);
        }
      }
    }).bind(this);
  }
}

module.exports = BinanceWS;
