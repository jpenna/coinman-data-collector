/* eslint-disable class-methods-use-this */

const fs = require('fs');
const readline = require('readline');
const debug = require('debug')('collector:pump');

const utils = require('../tools/utils');

// STARTUP
// open logs and get folder names, create list of folder names
// open 1st folder, get all file names, create list with file names (ws)
// WS send pair names to get called by REST from client
// REST files: read and build candles with data, save in memory, send on requet and delete data

// LOOP
// startNext is called on REST request of pair
// use pair name to get WS file
// start reading WS, build JSON and for each JSON pipe to WS
// on end file, remove it from list and check if list is empty
// if list empty, send 'closePeriod'
// REST request will trigger next folder
// ...

// CHECK FOR ERRORS
// checkpoints: send 100 JSON, wait for 'continue' reply to send more (log time to see if can increase JSON number)
// client: check if time is greater than last time of JSON
class Pump {
  // constructor() {

  // }

  static getFolderContent(path) {
    return new Promise((resolve, reject) => {
      fs.readdir(path, (err, names) => {
        if (err) {
          debug(`Error reading folder content (${path})`, err);
          reject(err);
        }
        resolve(names);
      });
    });
  }

  static pipeFolder(path, ws) {
    return this.getFolderContent(path)
      .then((fileNames) => {
        const groups = new Map();

        fileNames.forEach((fileName) => {
          const [exchange, pair, interval, end] = fileName.split('_');
          const part = Number.parseInt(end.split('.')[0], 10);
          const key = `${exchange}${pair}${interval}`;
          const group = groups.get(key) || [];
          group[part] = fileName;
          groups.set(key, group);
        });

        const promises = [];

        Array.from(groups)
          .map(([, group]) => group.map((name) => {
            const promise = new Promise((resolve, reject) => {
              const options = { encoding: 'ascii' };
              const readable = fs.createReadStream(`${path}/${name}`, options);
              const [exchange, pair] = name.split('_');
              const exchangeCode = utils.exchangeMap.get(exchange);

              const rl = readline.createInterface({
                input: readable,
                historySize: 0,
              });

              rl.on('line', line => ws.send({
                p: pair,
                t: 1,
                e: exchangeCode,
                d: line,
              }));

              rl.on('close', () => resolve());

              readable.on('error', err => reject(err));
            });

            promises.push(promise);
          }));

        return Promise.all(promises);
      });
  }

  start(ws, data) {
    const root = process.env.NODE_ENV === 'test' ? 'test/data' : 'data';
    Pump.getFolderContent(root)
      .then((folders) => {
        // Run one single folder at a time, when finished, go to next one
        let chain;
        const nodes = folders.map(f => (() => Pump.pipeFolder(`${root}/${f}`, ws)));
        nodes.forEach((node) => {
          if (chain) return chain.then(node);
          chain = node();
        });
        return chain;
      })
      .then(() => {
        ws.send('end');
      })
      .catch((err) => {
        debug(err);
        ws.send({ err: err.name, msg: err.message });
      });
  }
}

module.exports = Pump;
