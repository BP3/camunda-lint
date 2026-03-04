/* eslint-disable no-console */

/*================================================================================
 =
 = Licensed Materials - Property of BP3 Global
 =
 =  bpmnlint-plugin-bpmn-rules
 =
 = Copyright © BP3 Global Inc. 2026. All Rights Reserved.
 = This software is subject to copyright protection under
 = the laws of the United States, United Kingdom and other countries.
 =
 =================================================================================*/

const chalk = require('chalk');
const process = require('process');

const logger = {
  debug: (...args) => {
    if (process.env.VERBOSE != null && process.env.VERBOSE.toLowerCase() != 'false') {
      console.log(chalk.gray('DEBUG:'), ...args);
    }
  },
  info: (...args) => {
    console.log(chalk.blueBright.bold('INFO:'), ...args);
  },
  warn: (...args) => {
    console.warn(chalk.yellowBright.bold('WARN:'), ...args);
  },
  error: (...args) => {
    console.error(chalk.redBright.bold('ERROR:'), ...args);
  },
};

module.exports = {
  logger,
};
