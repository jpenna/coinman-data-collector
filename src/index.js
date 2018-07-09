const fs = require('fs');
const errorLog = require('debug')('collector:core');
const debugSystem = require('debug')('collector:system');
const { extraInfoSymbol } = require('./tools/gracefulExit');

try {
  fs.mkdirSync('logs');
} catch (e) { /* empty */ }

const {
  telegram,
  DbManager,
  fetcher,
  LetterMan,
} = require('./core');

// const pairs = ['BNBBTC', 'XLMBTC', 'XVGBTC', 'TRXBTC', 'ETHBTC', 'QTUMBTC', 'ADABTC', 'LUNBTC', 'ARKBTC', 'LSKBTC', 'ZRXBTC', 'XRPBTC'];
const pairs = ['ETHBTC'];

debugSystem(`Initializing Collector at PID ${process.pid}`);
global.timeCoinmanCollectorStarted = (new Date()).toISOString();

const { sendMessage } = telegram.init();

const dbManager = new DbManager({ pairs });
const letterMan = new LetterMan({ dbManager, extraInfoSymbol });

const binanceRest = require('./exchanges/binanceRest');
const WsHandler = require('./exchanges/wsHandler');

const wsHandler = new WsHandler({ beautify: false, sendMessage, pairs, letterMan });

const bnbRest = binanceRest({ beautify: false });

const init = fetcher({ binanceRest: bnbRest, pairs });

let retries = 0;

async function startCollecting() {
  if (retries >= 3) {
    errorLog(`Exiting. Maximum retries reachead (${retries})`);
    return process.exit();
  }
  let data;

  try {
    data = await init.fetchInitialData();
  } catch (e) {
    errorLog('Error fetching initial data. Retrying.', e);
    retries++;
    return startCollecting();
  }

  await dbManager.isReady();

  data.forEach((d, index) => {
    dbManager.writeREST({
      pair: pairs[index],
      data: d,
    });
  });

  wsHandler.start();
}

startCollecting();
