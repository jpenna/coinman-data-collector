/* eslint-disable prefer-arrow-callback */

const Websocket = require('ws');
const wsDebug = require('debug')('collector:Websocket');
const systemDebug = require('debug')('collector:system');
const errorsLog = require('simple-node-logger').createSimpleFileLogger('logs/errors.log');

const { gracefulExit } = require('gracefully-exit');

class CollectorWS {
  constructor() {
    this.wss = new Websocket.Server({
      port: process.env.WS_PORT,
      clientTracking: true,
      verifyClient: ({ req }) => {
        if (req.headers.auth === process.env.PASSWORD_WS) return true;
        return false;
      },
    });

    systemDebug('Collector Websocket running on port', process.env.WS_PORT);

    this._setListeners();
    this._setupPing();

    gracefulExit(function onExit() {
      this.wss.clients.forEach(c => c.terminate());
    }.bind(this));
  }

  static _heartbeat() {
    this.isAlive = true;
  }

  _setListeners() {
    this.wss.on('connection', (ws) => {
      ws.isAlive = true;

      const send = ws.send.bind(ws);
      ws.send = (msg) => {
        send(JSON.stringify(msg));
      };

      // TODO add type subscribe and send only the subscribed pairs
      // t: 'subscribe',
      // e: i.exchange,
      // p: i.pairs,

      // ws.on('message', (msg) => {
      //   const { type, data } = JSON.parse(msg);

      //   switch (type) {
      //     case 'snapshot': // I am getting from binance directly
      //       this.postman.getSnapshot(ws, data);
      //       break;
      //   }
      // });

      ws.on('pong', CollectorWS._heartbeat);

      ws.on('close', (code, reason) => {
        wsDebug(`WS disconnected (${code}): ${reason}`);
        ws.terminate();
      });

      ws.on('error', (e) => {
        wsDebug('WS Error', e);
        errorsLog('WS Error', e);
      });
    });
  }

  _setupPing() {
    this.pingTimeout = setTimeout(function ping() {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false; // eslint-disable-line no-param-reassign
        ws.ping(() => {});
      });
      this._setupPing();
    }.bind(this), 10000);
  }

  broadcast(msg) {
    this.wss.clients.forEach((client) => {
      // TODO the client should subscribe to the pairs it want to listen
      if (client.readyState !== Websocket.OPEN) return;
      client.send(JSON.stringify(msg));
    });
  }
}

module.exports = CollectorWS;
