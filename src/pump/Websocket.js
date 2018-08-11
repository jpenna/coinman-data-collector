const Websocket = require('ws');
const debug = require('debug')('pump:ws');

const Pump = require('./Pump');

const pump = new Pump();

const wss = new Websocket.Server({
  port: process.env.WS_PUMP_PORT,
  clientTracking: true,
  verifyClient: ({ req }) => {
    if (req.headers.auth === process.env.PASSWORD_WS) return true;
    return false;
  },
});

wss.on('connection', (ws) => {
  const send = ws.send.bind(ws);
  ws.send = (msg) => {
    send(JSON.stringify(msg));
  };

  ws.on('message', (msg) => {
    const { type, data } = JSON.parse(msg);
    console.log('type', type);

    switch (type) {
      case 'backtest':
        pump.start(ws, data);
        break;
    }
  });

  ws.on('close', (code, reason) => {
    debug(`WS disconnected (${code}): ${reason}`);
    ws.terminate();
  });
});
