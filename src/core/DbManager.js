const fs = require('fs');
const zlib = require('zlib');
const debug = require('debug')('collector:persist');
const fileLog = require('simple-node-logger').createSimpleFileLogger('logs/errors.log');

const { gracefulExit } = require('gracefully-exit');

class DbManager {
  constructor({ sourceSet, sendMessage }) {
    this.writing = new Map();
    this.sourceSet = sourceSet;
    this.sendMessage = sendMessage;
    this.writeStreams = new Map();
    this.notFirstWrite = new Set();
    this.startTimeString = (new Date()).toISOString(); // folder name
    this.gzip = zlib.createGzip();

    gracefulExit(this._onExit.bind(this));

    // // 96076800 = 60*60*24*8 (8 days) * 139 (bytes/kline)
    // this.maxFileSize = 96076800;
    // // 10800 records (approx. 6 hours)
    // this.minFileSize = 1501200;
    // // 1 day
    // this.checkFileSizeInterval = 86400000;
    // this.retryCreatingStreamTimeout = 60000;
    // // 5 days
    // const firstCheckSizeTimeout = 432000000;


    // TODO THERE IS AN ERROR, log is on the ./log
    // looks like the write stream is being closed before pipe ends..
    this.maxFileSize = 200000;
    // 10800 records (approx. 6 hours)
    this.minFileSize = 0;
    // 1 day
    this.checkFileSizeInterval = 10000;
    this.retryCreatingStreamTimeout = 60000;
    // 5 days
    const firstCheckSizeTimeout = 15000;

    this._checkFileSizes(firstCheckSizeTimeout);
  }

  static _getUid({ source, pair, interval }) {
    return `${source}${pair}${interval}`;
  }

  _checkSplit(stream) {
    if (stream.bytesWritten < this.maxFileSize) return;

    const [,, name] = stream.path.split('/');
    const [source, pair, interval, part] = name.replace('.coinman', '').split('_');

    debug(`Splitting file (${(stream.bytesWritten / 1000).toFixed(1)} kb): ${name}`);

    const uid = DbManager._getUid({ source, pair, interval });

    this.notFirstWrite.delete(uid);
    this._createStream({ source, interval, pair, part: +part + 1 })
      .then(() => {
        stream
          .on('finish', () => this._compress(stream.path))
          .end();
      });
  }

  _checkFileSizes(timeout) {
    clearTimeout(this.checkFileSizesTimeout);
    this.checkFileSizesTimeout = setTimeout(() => {
      this.writeStreams.forEach(stream => this._checkSplit(stream));
      this._checkFileSizes(this.checkFileSizeInterval); // 1 day
    }, timeout);
  }

  _compress(path) {
    return new Promise((resolve) => {
      fs.stat(path, (errStat) => {
        if (errStat) {
          if (errStat.code !== 'ENOENT') {
            debug('Error compressing file', path, errStat);
            fileLog.error('Error compressing file', path, errStat);
          }
          return resolve();
        }

        const input = fs.createReadStream(path);
        const output = fs.createWriteStream(`${path}.gz`);

        output.on('error', (err) => {
          debug('Error outputting GZIP file (output):', err);
          fileLog.error('Error outputting GZIP file (output):', err);
          return resolve();
        });

        output.on('finish', () => {
          debug('Output is finished');
          // Wait 15 seconds to delete original (if application crashes, it won't remove the file)
          setTimeout(() => {
            fs.unlink(path, (err) => {
              if (err) {
                debug('File was gzip, but couldn\'t remove original', err);
                fileLog.error('File was gzip, but couldn\'t remove original', err);
              } else {
                debug(`GZIP: ${path}`);
              }
              resolve();
            });
          }, 15000);
        });

        input.pipe(this.gzip).pipe(output);
      });
    });
  }

  _compressAll() {
    return Promise.all(
      Array.from(this.writeStreams)
        .map(([, stream]) => stream && this._compress(stream.path)),
    );
  }

  _onExit() {
    clearTimeout(this.checkFileSizesTimeout);
    return new Promise((function rerun(resolve) {
      const { length: wait } = Array.from(this.writing.values()).filter(v => v);
      if (!wait) {
        return this._cleanFolder()
          .then(() => this._compressAll())
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

    // Check files
    this.writeStreams.forEach((stream) => {
      const promise = new Promise((resolve) => {
        const [prefix, folder, name] = stream.path.split('/');
        const [,,, p] = name.split('_');
        const part = Number.parseInt(p.replace('.coinman', ''), 10);

        if (part > 0) return;

        folderSet.add(`${prefix}/${folder}`);

        const callback = (err) => {
          if (err) {
            debug('Could not remove file', err);
            fileLog.error('Could not remove file', err);
          } else {
            debug(`Deleted file (${(stream.bytesWritten / 1000).toFixed(1)} kb): ${stream.path}`);
          }
          resolve();
        };

        if (stream.bytesWritten > this.minFileSize) return resolve();

        fs.unlink(stream.path, callback);
      });
      promises.push(promise);
    });

    // Check folder
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
      const path = `data/${this.startTimeString}/${name}`;
      const uid = DbManager._getUid({ source, pair, interval });

      fs.open(path, 'wx', (error, fd) => {
        if (error) {
          debug(`Couldn't create file: ${path}`, error);
          fileLog.error(`Couldn't create file: ${path}`, error);
          return setTimeout(() => {
            this.sendMessage(`Couldn't create file: ${path}. Retrying in 1 minute`);
            resolve(this._createStream({ source, interval, pair, part }));
          }, this.retryCreatingStreamTimeout);
        }

        // Set path for cleaning
        const writeStream = fs.createWriteStream(path, { fd, encoding: 'ascii' });

        writeStream.on('error', (err) => {
          debug(`Error writing to Stream ${pair}`, err);
          fileLog.error(`Error writing to Stream ${pair}`, err);
        });

        writeStream.on('drain', () => {
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
    });
  }

  setStreams() {
    fs.mkdirSync(`data/${this.startTimeString}`);
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
    const uid = DbManager._getUid({ source, pair, interval });
    const ready = this.writeStreams.get(uid).write(`\n${data}`);
    if (!ready) this.writing.set(uid, true);
  }
}

module.exports = DbManager;
