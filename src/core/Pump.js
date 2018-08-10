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

  start(ws, data) {
    fs.readdir('logs', { encoding: 'ascii' }, (files) => {
      console.log('files', files);


    });
  }

  // getNextFolder() {

  // }

  // getNextFile() {

  // }

  // startNext(ws) {
  //   ws.send('newREST', { pair, });
  //   ws.send('newTick', { pair, });

  // }
}

module.exports = Pump;
