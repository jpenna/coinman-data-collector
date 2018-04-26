const errorsLog = require('simple-node-logger').createSimpleLogger('logs/errors.log');
const debugError = require('debug')('collector:process:error');

const codeMap = new Map([
  [1, 'Uncaught Exception'],
  [2, 'Unhandled Promise Rejection'],
  [3, 'SIGINT'],
  [4, 'SIGUSR1'],
  [5, 'SIGUSR2'],
  [99, 'Error on Graceful Exit Process'],
]);

function setup() {
  const letterManSkiped = Symbol('letterManSkiped');

  // Capture Errors not catched and start BOT reinicialization process
  process.on('uncaughtException', (err) => {
    const errorMsg = err;
    errorsLog.error(`Uncaught Exception -> ${errorMsg.stack}`);
    debugError(`Uncaught Exception -> ${errorMsg.stack}`);
    process.emit('cleanup', 1);
  });

  // Capture Promise rejections not handled and start BOT reinicialization process
  process.on('unhandledRejection', (reason, p) => {
    const errorMsg = `Promise: ${reason}`;
    errorsLog.error(`Unhandled Rejection -> ${errorMsg}\n`, p);
    debugError(`Unhandled Rejection -> ${errorMsg}\n`, p);
    process.emit('cleanup', 2);
  });

  // catch ctrl+c event and exit normally
  process.on('SIGINT', () => process.emit('cleanup', 3));

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', () => process.emit('cleanup', 4));
  process.on('SIGUSR2', () => process.emit('cleanup', 5));

  process.on('exit', (code) => {
    const skipedCount = JSON.stringify(process[letterManSkiped], null, 2);
    debugError(`Skiped requests to LetterMan: ${skipedCount}`);
    errorsLog.info(skipedCount);

    const errorMsg = `(PID ${process.pid}) Exiting with code: ${code} - ${codeMap.get(code)}`;
    errorsLog.info(errorMsg);
    debugError(errorMsg);
  });

  return ({ symbols: { letterManSkiped } });
}

let cleanupsCount = 0;
let cleanupsRunned = 0;

function gracefulExit(callback = () => { }) {
  cleanupsCount++;

  process.on('cleanup', async (code) => {
    debugError('CLEANUP GRACEFULLY', cleanupsCount, cleanupsRunned);
    try {
      await callback();
    } catch (e) {
      debugError('Error on cleanup callback', e);
    }
    cleanupsRunned++;
    if (cleanupsCount === cleanupsRunned) process.exit(code);
  });
}

module.exports = {
  setup,
  gracefulExit,
};
