const { setup } = require('gracefully-exit');

const logger = require('simple-node-logger').createSimpleFileLogger('logs/errors.log');
const fileLogger = require('debug')('collector:process:error');

module.exports = setup({
  callbacks: [],
  fileLogger,
  logger,
  forceTimeout: 10000,
});
