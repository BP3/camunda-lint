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

const LOG_LEVELS = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

function isStringNullOrEmpty(strValue) {
  return strValue == null || strValue.toLowerCase() == '';
}

function isLogLevelEnabled(logLevel) {
  return (
    (!isStringNullOrEmpty(process.env.LOG_LEVEL) && Object.keys(LOG_LEVELS).includes(process.env.LOG_LEVEL.toLowerCase()) && LOG_LEVELS[process.env.LOG_LEVEL.toLowerCase()] <= logLevel) ||
    (isStringNullOrEmpty(process.env.LOG_LEVEL) && LOG_LEVELS.info <= logLevel)
  );
}

const logger = {
  debug: (...args) => {
    if (isLogLevelEnabled(LOG_LEVELS.debug)) {
      console.log(chalk.gray('DEBUG:'), ...args);
    }
  },
  info: (...args) => {
    if (isLogLevelEnabled(LOG_LEVELS.info)) {
      console.log(chalk.blueBright.bold('INFO:'), ...args);
    }
  },
  warn: (...args) => {
    if (isLogLevelEnabled(LOG_LEVELS.warn)) {
      console.warn(chalk.yellowBright.bold('WARN:'), ...args);
    }
  },
  error: (...args) => {
    if (isLogLevelEnabled(LOG_LEVELS.error)) {
      console.error(chalk.redBright.bold('ERROR:'), ...args);
    }
  },
};

module.exports = {
  logger,
};
