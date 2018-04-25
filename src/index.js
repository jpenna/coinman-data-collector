const errorLog = require('debug')('collector:core');
const debugSystem = require('debug')('collector:system');

const {
  telegram,
  DbManager,
  fetcher,
  LetterMan,
} = require('./core');
const binanceApi = require('./exchanges/binance');

const pairs = ['BNBBTC', 'XLMBTC', 'XVGBTC', 'TRXBTC', 'ETHBTC', 'QTUMBTC', 'ADABTC', 'LUNBTC', 'ARKBTC', 'LSKBTC', 'ZRXBTC', 'XRPBTC'];
// const pairs = ['BNBBTC'];

debugSystem(`Initializing Collector at PID ${process.pid}`);
global.timeCoinmanCollectorStarted = (new Date()).toISOString();

const { setup: setupGracefulExit } = require('./utils/gracefulExit');

const { symbols: processSymbols } = setupGracefulExit();

const { sendMessage } = telegram.init();

const dbManager = new DbManager({ pairs });
const letterMan = new LetterMan({ pairs, dbManager, skipedSymbol: processSymbols.letterManSkiped });
const { binanceWS, binanceRest } = binanceApi({ beautify: false, sendMessage, pairs, letterMan });
const bnbRest = binanceRest();

const init = fetcher({ binanceRest: bnbRest, pairs });

let retries = 0;

async function startCollecting() {
  if (retries >= 3) return errorLog(`Exiting. Maximum retries reachead (${retries})`);
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

  binanceWS();
}

startCollecting();
