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
    // ALERT: Asset and Base names are inverted here and from BNB
    // startTime closeTime open close high low volumeQuote volumeBase takerBuyVolumeQuote takerBuyVolumeBase numberOfTrades
    const { k } = data;
    const kline = `${k.t} ${k.T} ${k.o} ${k.c} ${k.h} ${k.l} ${k.v} ${k.q} ${k.V} ${k.Q} ${k.n}`;
    this.dbManager.addKline(pair, 'BNB', '30m', kline);
  }

  initialBinanceCandles({ pair, interval, data }) {
    // ALERT: Asset and Base names are inverted here and from BNB
    // startTime closeTime open close high low volumeQuote volumeBase takerBuyVolumeQuote takerBuyVolumeBase numberOfTrades
    let string = '';
    data.forEach((d) => {
      string += `${d[0]} ${d[6]} ${d[1]} ${d[4]} ${d[2]} ${d[3]} ${d[5]} ${d[7]} ${d[9]} ${d[10]} ${d[8]}\n`;
    });
    const klines = string.substr(0, string.length - 1);
    this.dbManager.addKline(pair, 'BNB', interval, klines);
  }
}

module.exports = LetterMan;
