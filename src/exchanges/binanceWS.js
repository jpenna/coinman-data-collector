const binanceApi = require('binance');
const MissingPairs = require('../tools/missingPairs');
const coreLog = require('debug')('collector:core');
const bnbLog = require('debug')('collector:binance');

bnbLog.log = console.error.bind(console); // eslint-disable-line no-console

let instancesCount = 0;
class BinanceWS {
  constructor({ beautify = false, pairs, letterMan, wsTimeout, allConnected }) {
    this.beautify = beautify;
    this.pairs = pairs;
    this.letterMan = letterMan;
    this.wsTimeout = wsTimeout;
    this.missingPairs = new MissingPairs({ pairs });

    this.reportAllConnected = allConnected;

    this.messageHandler = this.getMessageHandler();

    this.instance = instancesCount;
    instancesCount++;

    this.connect();
  }

  connect() {
    coreLog('Initializing Binance WS');
    const bnbWS = new binanceApi.BinanceWS(this.beautify);
    const { streams } = bnbWS;

    const candleStreams = this.pairs.map(pair => streams.kline(pair, '30m'));

    this.wsPromise = bnbWS.onCombinedStream(
      candleStreams,
      this.wsCallback.bind(this),
      this.instance, // TODO remove this instance, this is only for debugging
    );
  }

  wsCallback(...args) {
    this.messageHandler(...args);
  }

  drop() {
    coreLog('Dropping Binance WS');
    this.isDropped = true;
    // this.messageHandler = () => {};
    this.messageHandler = () => console.log('dropped msg handler -', this.instance);
    // TODO disconeta a porra do WS (test: conecta, disconecta internet, espera e conecta de novo. O primeiro e o ultimo ficam recebendo. O disconnect não funciona). troquei o metodo de disconnect do binance, as vezes com o close ele fica tentando e nao vai dar erro (check)
    this.wsPromise.then(socket => socket.disconnect());
  }

  upgradeMessageHandler() {
    this.messageHandler = this.getMessageHandler(true);
  }

  // Replace handler when all data is connected, so it won't check pair connection all the time
  getMessageHandler(upgrade) {
    const defaultHandler = ({ data }) => {
      console.log('default handler. Instance: ', this.instance);

      const { k: { s: pair } } = data;
      this.missingPairs.refresh(pair, this.instance);
      this.letterMan.receivedBinanceCandle(pair, data);
    };

    if (upgrade) return defaultHandler;

    const startConn = Date.now();
    const pairsLength = this.pairs.length;
    const firstConnection = new Set(this.pairs);

    // const wsTimeoutTO = setTimeout(this.wsTimeout, 120000);
    const wsTimeoutTO = setTimeout(this.wsTimeout, 60000);

    return ({ data }) => {
      const { k: { s: pair } } = data;
      defaultHandler({ data });
      if (firstConnection.has(pair)) {
        firstConnection.delete(pair);
        const connectedCount = pairsLength - this.missingPairs.size();
        bnbLog(`Connected ${pair} websocket (${connectedCount}/${pairsLength})`);

        if (!this.missingPairs.hasMissing()) {
          bnbLog(`All websockets connected (${((Date.now() - startConn) / 1000).toFixed(2)}sec)`);
          clearTimeout(wsTimeoutTO);
          this.reportAllConnected();
        }
      }
    };
  }
}

module.exports = BinanceWS;
