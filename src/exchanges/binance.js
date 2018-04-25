const binanceApi = require('binance');
const coreLog = require('debug')('collector:core');
const bnbLog = require('debug')('collector:binance');

bnbLog.log = console.error.bind(console); // eslint-disable-line no-console

module.exports = ({ beautify = false, sendMessage, pairs, letterMan }) => ({
  binanceWS() {
    coreLog('Initializing Binance WS');
    const bnbWS = new binanceApi.BinanceWS(beautify);
    const { streams } = bnbWS;
    let connectedCount = 0;

    const { candleStreams, connectedPairs } = pairs.reduce((acc, pair) => {
      acc.candleStreams.push(streams.kline(pair, '30m'));
      acc.connectedPairs[pair] = false;
      return acc;
    }, { candleStreams: [], connectedPairs: {} });

    const candleStreamsLength = candleStreams.length;

    const cancelBot = setTimeout(() => {
      const text = 'Timeout. All websockets did not connect on time (2 min)';
      bnbLog(text);
      sendMessage(text);
      process.emit('SIGINT');
    }, 120000);

    const startConn = Date.now();

    bnbWS.onCombinedStream(
      candleStreams,
      ({ data }) => {
        // TODO use time to check if the candle is over in case of websocket failure
        const { k: { s: pair } } = data;
        if (!connectedPairs[pair]) {
          connectedCount++;
          bnbLog(`Connected ${pair} websocket (${connectedCount}/${candleStreamsLength})`);
          connectedPairs[pair] = true;
          if (connectedCount === candleStreamsLength) {
            bnbLog(`All websockets connected (${((Date.now() - startConn) / 1000).toFixed(2)}sec)`);
            clearTimeout(cancelBot);
          }
        }

        letterMan.receivedBinanceCandle(pair, data);
      },
    );

    return { connectedPairs };
  },

  binanceRest() {
    coreLog('Initializing Binance Rest');
    return new binanceApi.BinanceRest({
      key: process.env.BNB_KEY,
      secret: process.env.BNB_SECRET,
      timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
      recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
      disableBeautification: !beautify,
      handleDrift: false, // true: the library will attempt to handle any drift of your clock on it's own
    });
  },
});
