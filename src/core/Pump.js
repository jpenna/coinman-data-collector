/* eslint-disable class-methods-use-this */

const fs = require('fs');
const readline = require('readline');
const debug = require('debug')('collector:pump');

const utils = require('../tools/utils');

class Pump {
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

  static pipeFolder(path, ws, data) {
    console.log('path', path);
    const [,, timestamp] = path.split('/');
    const groupDate = new Date(timestamp);

    if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (groupDate < startDate) return Promise.resolve(true);
    }

    if (data.endDate) {
      const endDate = new Date(data.endDate);
      if (groupDate > endDate) return Promise.resolve(true);
    }

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
        const nodes = folders.map(f => (() => Pump.pipeFolder(`${root}/${f}`, ws, data)));
        return nodes.reduce((acc, node, i) => {
          return acc.then((filtered) => {
            if (!i) return; // Skip 1st, it runs on initialValue
            if (filtered === true) ws.send({ t: 10 }); // Next folder
            return node();
          });
        }, nodes[0]());
      })
      .then(() => {
        ws.send({ t: 99 });
      })
      .catch((err) => {
        debug(err);
        ws.send({ err: err.name, msg: err.message });
      });
  }
}

module.exports = Pump;
