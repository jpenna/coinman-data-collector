const { setup } = require('graceful-exit');

const logger = require('simple-node-logger').createSimpleLogger('logs/errors.log');
const fileLogger = require('debug')('collector:process:error');

module.exports = setup({
  callbacks: [],
  logger,
  fileLogger,
  forceExitAfter: 10000,
});
