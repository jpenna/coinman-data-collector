const binanceApi = require('binance');
const coreLog = require('debug')('collector:core');
const bnbLog = require('debug')('collector:binance');

bnbLog.log = console.error.bind(console); // eslint-disable-line no-console

module.exports = function binanceRest({ beautify = false }) {
  coreLog('Initializing Binance Rest');
  return new binanceApi.BinanceRest({
    key: process.env.BNB_KEY,
    secret: process.env.BNB_SECRET,
    timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
    recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
    beautify,
    handleDrift: false, // true: the library will attempt to handle any drift of your clock on it's own
  });
};
