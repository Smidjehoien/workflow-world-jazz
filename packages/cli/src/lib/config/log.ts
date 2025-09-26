import chalk from 'chalk';

let JSON_MODE = false;

export const setJsonMode = (value: boolean) => {
  JSON_MODE = Boolean(value);
};

export const isJsonMode = () => JSON_MODE;

const log = (...args: any[]) => {
  if (JSON_MODE) return; // suppress logs in JSON mode
  console.log(...args);
};
const debug = (...args: any[]) => {
  if (JSON_MODE) return; // suppress debug logs in JSON mode
  console.debug(...args);
};
const warn = (...args: any[]) => {
  if (JSON_MODE) return; // suppress warnings in JSON mode
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
