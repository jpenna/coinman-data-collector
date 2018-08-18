// const express = require('express');
// const bodyParser = require('body-parser');
const debugSystem = require('debug')('pump:system');

require('./Websocket');

debugSystem(`Pump initialized at PID ${process.pid}`);

// const app = express();

// app.use(bodyParser.json());

// app.post('/backtest', (req, res) => pump.start(res, req.body));

// app.listen(process.env.REST_PUMP_PORT, () => {
//   debugSystem(`Collector REST on port ${process.env.REST_PORT}`);
// });
