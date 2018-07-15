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

    this.reportAllConnected = allConnected;


    // For logging
    this.instance = instancesCount;
    instancesCount++;

    this.bnbWS = new binanceApi.BinanceWS(this.beautify);

    // this.connectCombined();
    this.processSingleWS();
  }

  connectCombined() {
    coreLog(`Initializing Binance WS (${this.instance})`);
    const { streams } = this.bnbWS;

    this.messageHandler = this.getMessageHandler();

    const candleStreams = this.pairs.map(pair => streams.kline(pair, this.klineInterval));

    this._combinedWS = this.bnbWS.onCombinedStream(
      candleStreams,
      this.combinedCallback.bind(this),
    );
  }

  processSingleWS() {
    this.missingPairs.forEach((pair) => {
      if (this.singleWSMap.has(pair)) this.dropSingle(pair);
      this.connectSingle({ pair });
    });




    const startConn = Date.now();
    function verify() {
      console.log('call verify');
      setTimeout((() => {
        console.log('check');
        if (this.missingPairs.hasMissing()) return verify.call(this);
        this.reportAllConnected(startConn);
      }).bind(this), 3000);
    }
    verify.call(this);





  }

  connectSingle({ pair }) {
    bnbLog(`Creating single connection for ${pair} (${this.instance})`);
    const singleWS = this.bnbWS.onKline(
      pair,
      this.klineInterval,
      this.getMessageHandler({ single: true }).bind(this),
    );
    this.singleWSMap.set(pair, singleWS);
  }

  combinedCallback(...args) {
    this.messageHandler(...args);
  }

  drop() {
    coreLog(`Dropping Binance WS (${this.instance})`);
    this.isDropped = true;
    clearTimeout(this.wsTimeout);
    this.missingPairs.clear();
    // Disconnect socket
    // this._combinedWS.then(socket => socket.disconnect());
    this.singleWSMap.forEach((v, k) => this.dropSingle(k));
    // If no internet connection, disconnect on new message
    this.messageHandler = () => {
      this._combinedWS.then(socket => socket.disconnect && socket.disconnect());
    };
  }

  dropSingle(pair) {
    bnbLog(`Dropping single connection for ${pair} (${this.instance})`);
    const cnx = this.singleWSMap.get(pair);
    if (!cnx) return console.log(`no connection single ${pair}`);
    cnx.then(socket => socket.disconnect());
    cnx.bnbEventHandler = () => {
      cnx.then(socket => socket.disconnect && socket.disconnect());
    };
    this.singleWSMap.delete(pair);
  }

  upgradeMessageHandler() {
    this.messageHandler = this.getMessageHandler({ upgrade: true });
  }

  // Replace handler when all data is connected, so it won't check pair connection all the time
  getMessageHandler({ upgrade, single } = {}) {
    const defaultHandler = (msg) => {
      const data = msg.data || msg;
      const { k: { s: pair } } = data;
      if (single && !this.singleWSMap.has(pair)) return this.dropSingle(pair);
      this.missingPairs.refresh(pair, this.instance);
      this.letterMan.receivedBinanceCandle(pair, data);
    };

    if (single || upgrade) return defaultHandler;

    const startConn = Date.now();
    const pairsLength = this.pairs.length;

    this.wsTimeout = setTimeout(this.pairsTimeout, 150000); // 2:30 min

    return ({ data }) => {
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
    };
  }
}

module.exports = BinanceWS;
