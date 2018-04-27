const debugLog = require('debug')('collector:LetterMan');

class LetterMan {
  constructor({ pairs, dbManager, sendMessage, skipedSymbol }) {
    this.pairs = pairs;
    this.dbManager = dbManager;
    this.sendMessage = sendMessage;
    this.skipedSymbol = skipedSymbol;
    this.missingSet = new Set();
    this.startTime = Date.now();
    process.on('cleanup', LetterMan.cleanupModule.bind(this));

    setTimeout(this.resetMissingSet.bind(this), 180000);
  }

  resetMissingSet() {
    const runningFor = `Running nonstop for ${((Date.now() - this.startTime) / 60000).toFixed(0)} minutes`;
    if (this.missingSet.size) {
      const msg = `Not all assets are running (${this.missingSet.length}): ${this.missingSet}\n${runningFor}`;
      debugLog(msg);
    } else {
      debugLog(`All assets are running. ${runningFor}`);
    }

    this.missingSet = new Set(this.pairs);
    setTimeout(this.resetMissingSet.bind(this), 180000);
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
    if (this.missingSet.has(pair)) this.missingSet.delete(pair);
    this.dbManager.addKline(pair, data);
  }
}

module.exports = LetterMan;
