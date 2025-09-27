import chalk from 'chalk';

export const LOGGING_CONFIG = {
  JSON_MODE: false,
  VERBOSE_MODE: false,
};

export const setJsonMode = (value: boolean) => {
  LOGGING_CONFIG.JSON_MODE = Boolean(value);
};

export const setVerboseMode = (value: boolean) => {
  LOGGING_CONFIG.VERBOSE_MODE = Boolean(value);
};

const log = (...args: any[]) => {
  if (LOGGING_CONFIG.JSON_MODE) {
    return;
  }
  console.log(...args);
};
const debug = (...args: any[]) => {
  if (!LOGGING_CONFIG.VERBOSE_MODE || LOGGING_CONFIG.JSON_MODE) {
    return;
  }
  console.debug(...args);
};
const warn = (...args: any[]) => {
  if (LOGGING_CONFIG.JSON_MODE) {
    return;
  }
  console.warn(...args);
};

export const logInfo = (...args: any[]) => {
  log(chalk.white(`[Info]`, ...args));
};

export const logPlain = (...args: any[]) => {
  log(...args);
};

export const logSuccess = (...args: any[]) => {
  log(chalk.green(`[Success]`, ...args));
};

export const logDebug = (...args: any[]) => {
  debug(chalk.gray(`[Debug]`, ...args));
};

export const logWarn = (...args: any[]) => {
  // warnings should always go to stderr
  warn(chalk.yellow(`[Warn]`, ...args));
};

export const logError = (...args: any[]) => {
  // errors should always go to stderr
  console.error(chalk.red(`[Error]`, ...args));
};
