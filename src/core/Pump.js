/* eslint-disable class-methods-use-this */

const fs = require('fs');
const debug = require('debug')('collector:pump');

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

  static pipeFolder(path) {
    return this.getFolderContent(path)
      .then((fileNames) => {
        const promises = Promise.all(fileNames.map((name) => {
          const promise = new Promise((resolve, reject) => {
            const options = { encoding: 'ascii' };
            const readable = fs.createReadStream(`${path}/${name}`, options);

            readable.on('data', (chunk) => {
              console.log(chunk);
            });

            readable.on('end', () => resolve());

            readable.on('error', err => reject(err));
          });

          return promise;
        }));

        return promises;
      });
  }

  start(ws, data) {
    const root = process.env.ENV === 'test' ? 'test/data' : 'data';
    Pump.getFolderContent(root)
      .then((folders) => {
        return Promise.all(folders.map(f => Pump.pipeFolder(`${root}/${f}`)));
      })
      .then((files) => {
        ws.send(files);
        console.log('END ALL');
      })
      .catch((err) => {
        debug(err);
        ws.send({ err });
      });
  }
}

module.exports = Pump;
