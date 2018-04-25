const debugLog = require('debug')('collector:LetterMan');

class LetterMan {
  constructor({ pairs, dbManager, skipedSymbol }) {
    this.pairs = pairs;
    this.dbManager = dbManager;
    this.skipedSymbol = skipedSymbol;
    this.runningSet = new Set();
    process.on('cleanup', LetterMan.cleanupModule.bind(this));

    setTimeout(this.resetRunningSet.bind(this), 180000);
  }

  resetRunningSet() {
    if (this.runningSet.size !== this.pairs.length) {
      const missing = this.pairs.filter(k => !this.runningSet.has(k));
      debugLog(`Not all assets are running ${missing}`);
    } else {
      debugLog('All assets are running. Next check in 3 minutes.');
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
