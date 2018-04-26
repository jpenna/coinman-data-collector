const debugLog = require('debug')('collector:LetterMan');

class LetterMan {
  constructor({ pairs, dbManager, sendMessage, skipedSymbol }) {
    this.pairs = pairs;
    this.dbManager = dbManager;
    this.sendMessage = sendMessage;
    this.skipedSymbol = skipedSymbol;
    this.runningSet = new Set();
    this.startTime = Date.now();
    process.on('cleanup', LetterMan.cleanupModule.bind(this));

    setTimeout(this.resetRunningSet.bind(this), 180000);
  }

  resetRunningSet() {
    const runningFor = `Running nonstop for ${((Date.now() - this.startTime) / 60000).toFixed(0)} minutes`;
    if (this.runningSet.size !== this.pairs.length) {
      const missing = this.pairs.filter(k => !this.runningSet.has(k));
      const msg = `Not all assets are running (${missing.length}): ${missing}\n${runningFor}`;
      debugLog(msg);
      this.sendMessage(`📝 ${msg}`);
    } else {
      debugLog(`All assets are running. ${runningFor}`);
    }

    this.runningSet.clear();
    setTimeout(this.resetRunningSet.bind(this), 180000);
  }

  static cleanupModule() {
    process[this.skipedSymbol] = {};
    Object.getOwnPropertyNames(LetterMan.prototype).forEach((key) => {
      if (key !== 'constructor' && typeof LetterMan.prototype[key] === 'function') {
        LetterMan.prototype[key] = () => {
          // Count missed requests after system is flagged to shut down
          process[this.skipedSymbol][key] = (process[this.skipedSymbol].key || 0) + 1;
        };
      }
    });
  }

  receivedBinanceCandle(pair, data) {
    if (!this.runningSet.has(pair)) this.runningSet.add(pair);
    this.dbManager.addKline(pair, data);
  }
}

module.exports = LetterMan;
