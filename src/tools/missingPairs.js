const logger = require('debug')('collector:missingPairs');

class MissingPairs {
  constructor({ pairs }) {
    this.missing = new Set(pairs);
    // this.timeout = 180000; // 3 minutes
    this.interval = 10000;
    this.timeouts = new Map();
  }

  refresh(pair, ins) {
    logger(`refresh pair (${ins})`, pair);
    this.missing.delete(pair);
    clearTimeout(this.timeouts.get(pair));

    this.timeouts.set(pair, setTimeout(() => {
      logger(`adding back pair (${ins})`, pair);

      this.missing.add(pair);
    }, this.interval));
  }

  hasMissing() {
    return !!this.missing.size;
  }

  has(pair) {
    return this.missing.has(pair);
  }

  size() {
    return this.missing.size;
  }

  toString() {
    return Array.from(this.missing);
  }
}

module.exports = MissingPairs;
