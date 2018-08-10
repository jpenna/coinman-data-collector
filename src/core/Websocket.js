/* eslint-disable prefer-arrow-callback */

const Websocket = require('ws');
const wsDebug = require('debug')('collector:Websocket');
const errorsLog = require('simple-node-logger').createSimpleFileLogger('logs/errors.log');

const { gracefulExit } = require('gracefully-exit');

class CollectorWS {
  constructor({ pump }) {
    this.pump = pump;
    this.wss = new Websocket.Server({
      port: process.env.WS_PORT,
      clientTracking: true,
      verifyClient: ({ req }) => {
        console.log('req', req);
        // TODO 1 use a hard coded password for this
      },
    });

    wsDebug('Collector Websocket running');

    this.setListeners();
    this.setupPing();

    gracefulExit(function onExit() {
      this.wss.clients.forEach(c => c.terminate());
    }.bind(this));
  }

  static heartbeat() {
    this.isAlive = true;
  }

  setListeners() {
    this.wss.on('connection', function connection(ws) {
      ws.isAlive = true;

      ws.on('message', ({ type, data }) => {
        switch (type) {
          case 'backtest':
            this.pump.start(ws, data);
            break;
        }
      });

      ws.on('pong', CollectorWS.heartbeat);

      ws.on('close', (code, reason) => {
        console.log('it exist on server?');

        wsDebug(`WS disconnected (${code}): ${reason}`);
        ws.terminate();
      });

      ws.on('error', (e) => {
        wsDebug('WS Error', e);
        errorsLog('WS Error', e);
      });
    });
  }

  setupPing() {
    this.pingTimeout = setTimeout(function ping() {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false; // eslint-disable-line no-param-reassign
        ws.ping(() => {});
      });
      this.setupPing();
    }.bind(this), 10000);
  }

  broadcast(msg) {
    this.wss.clients.forEach((client) => {
      if (client.readyState !== Websocket.OPEN) return;
      client.send(JSON.stringify(msg));
    });
  }
}

module.exports = CollectorWS;
