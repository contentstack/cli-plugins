/*!
 * Contentstack Export
 * Copyright (c) 2026 Contentstack LLC
 * MIT Licensed
 */

import { redactObject, sanitizePath } from '@contentstack/cli-utilities';
import mkdirp from 'mkdirp';
import * as path from 'path';
import * as winston from 'winston';

import { ExportConfig } from '../types';

const ansiRegexPattern = [
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
].join('|');

function returnString(args: unknown[]) {
  let returnStr = '';
  if (args && args.length) {
    returnStr = args
      .map(function (item) {
        if (item && typeof item === 'object') {
          try {
            const redactedObject = redactObject(item);
            if (redactedObject && typeof redactedObject === 'object') {
              return JSON.stringify(redactedObject);
            }
          } catch (error) {}
          return item;
        }
        return item;
      })
      .join('  ')
      .trim();
  }
  returnStr = returnStr.replace(new RegExp(ansiRegexPattern, 'g'), '').trim();
  return returnStr;
}
const myCustomLevels = {
  colors: {
    debug: 'green',
    error: 'red',
    //colors aren't being used anywhere as of now, we're using chalk to add colors while logging
    info: 'blue',
    warn: 'yellow',
  },
  levels: {
    debug: 3,
    info: 2,
    warn: 1,
  },
};

let logger: winston.Logger;
let errorLogger: winston.Logger;

let successTransport;
let errorTransport;

function init(_logPath: string) {
  if (!logger || !errorLogger) {
    const logsDir = path.resolve(sanitizePath(_logPath), 'logs', 'export');
    // Create dir if doesn't already exist
    mkdirp.sync(logsDir);

    successTransport = {
      filename: path.join(sanitizePath(logsDir), 'success.log'),
      level: 'info',
      maxFiles: 20,
      maxsize: 1000000,
      tailable: true,
    };

    errorTransport = {
      filename: path.join(sanitizePath(logsDir), 'error.log'),
      level: 'error',
      maxFiles: 20,
      maxsize: 1000000,
      tailable: true,
    };

    logger = winston.createLogger({
      levels: myCustomLevels.levels,
      transports: [
        new winston.transports.File(successTransport),
        new winston.transports.Console({ format: winston.format.simple() }),
      ],
    });

    errorLogger = winston.createLogger({
      levels: { error: 0 },
      transports: [
        new winston.transports.File(errorTransport),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true, colors: { error: 'red' } }),
            winston.format.simple(),
          ),
          level: 'error',
        }),
      ],
    });
  }

  return {
    debug: function (...args: unknown[]) {
      const logString = returnString(args);
      if (logString) {
        logger.log('debug', logString);
      }
    },
    error: function (...args: unknown[]) {
      const logString = returnString(args);
      if (logString) {
        errorLogger.log('error', logString);
      }
    },
    log: function (...args: unknown[]) {
      const logString = returnString(args);
      if (logString) {
        logger.log('info', logString);
      }
    },
    warn: function (...args: unknown[]) {
      const logString = returnString(args);
      if (logString) {
        logger.log('warn', logString);
      }
    },
  };
}

export const log = async (config: ExportConfig, message: any, type: string) => {
  const logsPath = sanitizePath(config.cliLogsPath || config.data);
  // ignoring the type argument, as we are not using it to create a logfile anymore
  if (type !== 'error') {
    // removed type argument from init method
    init(logsPath).log(message);
  } else {
    init(logsPath).error(message);
  }
};

export const unlinkFileLogger = () => {
  if (logger) {
    const transports = logger.transports;
    transports.forEach((transport: any) => {
      if (transport.name === 'file') {
        logger.remove(transport);
      }
    });
  }

  if (errorLogger) {
    const transports = errorLogger.transports;
    transports.forEach((transport: any) => {
      if (transport.name === 'file') {
        errorLogger.remove(transport);
      }
    });
  }
};
