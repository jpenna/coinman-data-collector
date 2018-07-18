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
    // eventTime startTime closeTime open close high low volumeQuote volumeBase takerBuyVolumeQuote takerBuyVolumeBase numberOfTrades lastKline
    const kline = `${data.E} ${data.k.t} ${data.k.T} ${data.k.o} ${data.k.c} ${data.k.h} ${data.k.l} ${data.k.v} ${data.k.q} ${data.k.V} ${data.k.Q} ${data.k.n} ${data.k.x ? 1 : 0}`
    this.dbManager.addKline(pair, kline);
  }
}

module.exports = LetterMan;
