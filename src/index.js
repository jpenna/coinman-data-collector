const fs = require('fs');
const errorLog = require('debug')('collector:core');
const debugSystem = require('debug')('collector:system');
const { extraInfoSymbol } = require('./tools/gracefulExit');

try {
  fs.mkdirSync('logs');
} catch (e) { /* empty */ }
try {
  fs.mkdirSync('data');
} catch (e) { /* empty */ }

const {
  Spokesman,
  DbManager,
  fetcher,
  Postman,
  Websocket,
} = require('./core');

// TODO add Telegram actions: refresh cnx, add/remove pair, stop collector (apocalypse)

// const pairs = ['BNBBTC', 'XLMBTC', 'XVGBTC', 'TRXBTC', 'ETHBTC', 'QTUMBTC', 'ADABTC', 'LUNBTC', 'ARKBTC', 'LSKBTC', 'ZRXBTC', 'XRPBTC'];
// const pairs = ['ETHBTC', 'LUNBTC', 'XVGBTC', 'ARKBTC'];
const pairs = ['ETHBTC'];

debugSystem(`Initializing Collector at PID ${process.pid}`);

const spokesman = new Spokesman();
spokesman.sendMessage(`📦 Initializing Collector\n${(new Date()).toLocaleString()}`);

const sourceSet = new Set([{ source: 'BNB', interval: '30m', pairs }]);

const websocket = new Websocket();
const dbManager = new DbManager({ sourceSet });
const postman = new Postman({ dbManager, extraInfoSymbol, websocket });
// const postman = new Postman({ dbManager, extraInfoSymbol, websocket: { broadcast: () => {} } });

const binanceRest = require('./exchanges/binanceRest');
const WsHandler = require('./exchanges/wsHandler');

const wsHandler = new WsHandler({
  beautify: false,
  sendMessage: spokesman.sendMessage,
  pairs,
  postman,
});

const bnbRest = binanceRest({ beautify: false });

const init = fetcher({ binanceRest: bnbRest, pairs });

let interval = 1000;

// Start creating files and...
const dbManagerStarting = dbManager.setStreams();

spokesman.register({ wsHandler, dbManager, sourceSet });

(async function retry() {
  let data;

  try {
    // TODO 2 refetch only the missing assets, not all
    data = await init.fetchInitialData();
  } catch (e) {
    errorLog('Error fetching initial data. Retrying.', e);
    setTimeout(() => {
      if (interval < 10000) interval += 1000;
      retry();
    }, interval);
    return;
  }

  // ... wait until all files created
  await dbManagerStarting;

  data.forEach((d, index) => {
    postman.initialBinanceCandles({
      pair: pairs[index],
      interval: '30m',
      data: d,
    });
  });

  wsHandler.start();
}());
