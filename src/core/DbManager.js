const fs = require('fs');
const debug = require('debug')('collector:persist');
const fileLog = require('simple-node-logger').createSimpleLogger('logs/errors.log');

const { gracefulExit } = require('graceful-exit');

class DbManager {
  constructor({ sourceSet }) {
    this.writing = new Map();
    this.sourceSet = sourceSet;
    this.writeStreams = new Map();
    this.notFirstWrite = new Set();
    this.startTimeString = (new Date()).toISOString();
    gracefulExit(this._onExit.bind(this));
    this.checkFileSizes(432000000); // 5 days
  }

  static getUid({ source, pair, interval }) {
    return `${source}${pair}${interval}`;
  }

  checkSplit(stream) {
    // 96076800 = 60*60*24*8 (8 days) * 139 (bytes/kline)
    if (stream.bytesWritten < 96076800) return;

    const [,, name] = stream.path.split('/');
    const [source, pair, interval, part] = name.replace('.coinman', '').split('_');

    debug(`Splitting file (${(stream.bytesWritten / 1000).toFixed(1)} kb): ${name}`);

    const uid = DbManager.getUid({ source, pair, interval });

    this.notFirstWrite.delete(uid);
    this._createStream({ source, interval, pair, part: +part + 1 })
      .then(() => stream.end());
  }

  checkFileSizes(timeout) {
    clearTimeout(this.checkFileSizesTimeout);
    this.checkFileSizesTimeout = setTimeout(() => {
      this.writeStreams.forEach(stream => this.checkSplit(stream));
      this.checkFileSizes(86400000); // 1 day
    }, timeout);
  }

  _onExit() {
    clearTimeout(this.checkFileSizesTimeout);
    return new Promise((function rerun(resolve) {
      const { length: wait } = Array.from(this.writing.values()).filter(v => v);
      if (!wait) {
        return this._cleanFolder()
          .then(resolve);
      }
      debug(`Waiting all writes to finish. Count: ${wait}`);
      setTimeout(rerun.bind(this, resolve), 100);
    }).bind(this));
  }

  _cleanFolder() {
    // If more than 10 hours recording, don't remove anything
    const date = (new Date(this.startTimeString)).getTime();
    if (Date.now() - date > 36000000) return Promise.resolve();

    const promises = [];
    const folderSet = new Set();

    this.writeStreams.forEach((stream) => {
      const promise = new Promise((resolve) => {
        let done = 0; // Wait for both unlinks to finish
        const [prefix, folder, name] = stream.path.split('/');
        const [source, pair, interval] = name.split('_');

        folderSet.add(`${prefix}/${folder}`);

        const callback = (skip, err) => {
          if (!skip) err = skip;
          if (err) {
            debug('Could not remove file', err);
            fileLog.error('Could not remove file', err);
          } else if (!skip) {
            debug(`Deleted file (${(stream.bytesWritten / 1000).toFixed(1)} kb): ${stream.path}`);
          }
          if (done === 1) return resolve();
          return done++;
        };

        // 10800 records (approx. 6 hours)
        if (stream.bytesWritten > 1501200) return resolve();

        fs.unlink(stream.path, callback);
      });

      promises.push(promise);
    });

    return Promise.all(promises)
      .then(() => {
        const folderPromises = [];

        folderSet.forEach((folder) => {
          const fPromise = new Promise((resolve) => {
            fs.readdir(folder, (e, files) => {
              if (files.length > 0) return resolve();

              fs.rmdir(folder, (err) => {
                if (err) {
                  debug(`Couldn't remove folder: ${folder}`, err);
                  fileLog.error(`Couldn't remove folder: ${folder}`, err);
                } else {
                  debug(`Empty folder removed: ${folder}`);
                }
                resolve();
              });
            });
          });

          folderPromises.push(fPromise);
        });

        return Promise.all(folderPromises);
      });
  }

  _createStream({ source, interval, pair, part }) {
    return new Promise((resolve) => {
      const name = `${source}_${pair}_${interval}_${part}.coinman`;
      const path = `logs/${this.startTimeString}/${name}`;
      const uid = DbManager.getUid({ source, pair, interval });

      const fd = fs.openSync(path, 'wx');
      // Set path for cleaning
      const writeStream = fs.createWriteStream(path, { fd, encoding: 'ascii' });

      writeStream.on('error', (err) => {
        debug(`Error writing to Stream ${pair}`, err);
        fileLog.error(`Error writing to Stream ${pair}`, err);
      });

      writeStream.on('drain', function () {
        this.writing.set(uid, false);
      });

      const originalWrite = Object.getPrototypeOf(writeStream).write;

      writeStream.write = (function (_uid, notFirstWrite, string) {
        if (notFirstWrite.has(_uid)) {
          writeStream.write = originalWrite;
          return writeStream.write(string);
        }
        const nlRemoved = string.substr(1);
        notFirstWrite.add(_uid);
        return originalWrite.call(writeStream, nlRemoved);
      }).bind(writeStream, uid, this.notFirstWrite);

      this.writeStreams.set(uid, writeStream);
      resolve();
    });
  }

  setStreams() {
    fs.mkdirSync(`logs/${this.startTimeString}`);
    const promises = [];
    this.sourceSet.forEach((info) => {
      info.pairs.forEach((pair) => {
        promises.push(this._createStream({
          pair,
          source: info.source,
          interval: info.interval,
          part: 0,
        }));
      });
    });
    return Promise.all(promises);
  }

  addKline(pair, source, interval, data) {
    const uid = DbManager.getUid({ source, pair, interval });
    const ready = this.writeStreams.get(uid).write(`\n${data}`);
    if (!ready) this.writing.set(uid, true);
  }
}

module.exports = DbManager;
