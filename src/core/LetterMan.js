class LetterMan {
  constructor({ dbManager, extraInfoSymbol }) {
    this.dbManager = dbManager;
    this.extraInfoSymbol = extraInfoSymbol;

    process.on('cleanup', LetterMan.cleanupModule.bind(this));
  }

  static cleanupModule() {
    Object.getOwnPropertyNames(LetterMan.prototype).forEach((key) => {
      if (key !== 'constructor' && typeof LetterMan.prototype[key] === 'function') {
        LetterMan.prototype[key] = () => {
          // Count missed requests after system is flagged to shut down
          global[this.extraInfoSymbol][key] = (global[this.extraInfoSymbol].key || 0) + 1;
        };
      }
    });
  }

  receivedBinanceCandle(pair, data) {
    this.dbManager.addKline(pair, data);
  }
}

module.exports = LetterMan;
