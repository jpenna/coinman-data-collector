const Websocket = require('ws');

const ws = new Websocket(`ws://localhost:${process.env.WS_PUMP_PORT}`, {
  headers: { auth: process.env.PASSWORD_WS },
});

ws.on('open', () => {
  console.log('open connection');
  ws.send(JSON.stringify({
    type: 'backtest',
    data: {
      startDate: '2018-08-14T01:30:41.654Z',
      endDate: '2018-08-15T01:30:41.654Z',
      exchanges: ['BNB'],
      pairs: ['ETHBTC'],
    },
  }));
});

let last = '';

ws.on('message', (msg) => {
  const data = JSON.parse(msg);
  if (`${data.t} ${data.p}` === last) return;
  last = `${data.t} ${data.p}`;
  console.log('message', data.t ? last : data);
});

ws.on('error', err => console.log(err));

ws.on('close', (code, reason) => console.log('disconnected', code, reason));
