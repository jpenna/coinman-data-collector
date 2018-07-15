const logger = require('debug')('collector:missingPairs');

class MissingPairs {
  constructor({ pairs }) {
    this.missing = new Set(pairs);
    this.interval = 180000; // 3 minutes
    this.timeouts = new Map();
    this.threshold = 3;
  }

  get size() {
    return this.missing.size;
  }

  refresh(pair, ins) {
    this.missing.delete(pair);
    clearTimeout(this.timeouts.get(pair));

    this.timeouts.set(pair, setTimeout(() => {
      logger(`adding back pair (${ins})`, pair);

      this.missing.add(pair);
    }, this.interval));
  }

  clear() {
    this.timeouts.forEach(t => clearTimeout(t));
  }

  hasMissing() {
    return !!this.missing.size;
  }

  checkThreshold() {
    return this.missing.size >= this.threshold;
  }

  has(pair) {
    return this.missing.has(pair);
  }

  toString() {
    return Array.from(this.missing);
  }

  forEach(callback) {
    this.missing.forEach(callback);
  }
}

module.exports = MissingPairs;
