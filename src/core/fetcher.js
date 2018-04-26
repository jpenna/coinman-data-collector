module.exports = ({ binanceRest, pairs }) => ({
  fetchInitialData() {
    const klines = pairs.map(pair => binanceRest.klines({
      symbol: pair,
      limit: 500,
      interval: '1m',
    }));

    return Promise.all(klines);
  },
});
