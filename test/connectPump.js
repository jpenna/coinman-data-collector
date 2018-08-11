const Websocket = require('ws');

const ws = new Websocket('ws://localhost:4903', {
  headers: { auth: process.env.PASSWORD_WS },
});

ws.on('open', () => {
  console.log('open connection');
  ws.send(JSON.stringify({
    type: 'backtest',
    data: {
      startDate: '2018-08-08T01:30:41.654Z',
      endDate: '2018-08-15T01:30:41.654Z',
    },
  }));
});

ws.on('message', (msg) => {
  const data = JSON.parse(msg);
  console.log('got message', data.t, data.p);
});
