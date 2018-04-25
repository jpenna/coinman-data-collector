module.exports = ({ binanceRest, pairs }) => ({
  fetchInitialData() {
    const klines = pairs.map(pair => binanceRest.klines({
      symbol: pair,
      limit: 8,
      interval: '30m',
    }));

    return Promise.all(klines);
  },
});
