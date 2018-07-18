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
    gracefulExit(this._onExit.bind(this));
    this._setStreams();
  }

  _onExit() {
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
        const restPath = `${prefix}/${folder}/${source}_${pair}_${interval}_rest.json`;
        fs.unlink(restPath, callback.bind(this, true));
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

  _setStreams() {
    fs.mkdirSync(`logs/${global.timeCoinmanCollectorStarted}`);
    this.sourceSet.forEach((info) => {
      info.pairs.forEach((pair) => {
        const name = `${info.source}_${pair}_${info.interval}_ws.coinman`;
        const path = `logs/${global.timeCoinmanCollectorStarted}/${name}`;
        const uid = `${info.source}${pair}${info.interval}`;
        const fd = fs.openSync(path, 'wx');
        // Set path for cleaning
        const writeStream = fs.createWriteStream(path, { fd, encoding: 'ascii' });

        writeStream.on('error', (err) => { // eslint-disable-line
          debug(`Error writing to Stream ${pair}`, err);
          fileLog.error(`Error writing to Stream ${pair}`, err);
        }); // eslint-disable-line
        writeStream.on('drain', function () { // eslint-disable-line
          this.writing.set(uid, false);
        });

        const originalWrite = Object.getPrototypeOf(writeStream).write;

        writeStream.write = (function newWrite(_uid, notFirstWrite, string) {
          if (notFirstWrite.has(_uid)) {
            writeStream.write = originalWrite;
            return writeStream.write(string);
          }
          const nlRemoved = string.substr(1);
          notFirstWrite.add(_uid);
          return originalWrite.call(writeStream, nlRemoved);
        }).bind(writeStream, uid, this.notFirstWrite);

        this.writeStreams.set(uid, writeStream);
      });
    });
  }

  isReady() {
    let numberOfFiles = 0;
    this.sourceSet.forEach(i => numberOfFiles += i.pairs.length);
    return new Promise((function rerun(res) {
      setTimeout(() => {
        if (this.writeStreams.size === numberOfFiles) return res();
        rerun(res);
      }, 100);
    }).bind(this));
  }

  addKline(pair, source, interval, data) {
    const uid = `${source}${pair}${interval}`;
    const ready = this.writeStreams.get(uid).write(`\n${data}`);
    if (!ready) this.writing.set(uid, true);
  }

  writeREST({ pair, source, interval, data }) { // eslint-disable-line
    const path = `logs/${global.timeCoinmanCollectorStarted}/${source}_${pair}_${interval}_rest.json`;
    fs.writeFile(path, JSON.stringify(data), (err) => {
      if (err) debug(`Error writing to REST ${pair}`, err);
    });
  }
}

module.exports = DbManager;
