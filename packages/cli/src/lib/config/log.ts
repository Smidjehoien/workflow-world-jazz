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

/**
 * There are practically three modes of operation:
 * - Regular (both JSON and VERBOSE modes are off)
 * - JSON mode (JSON mode is on, VERBOSE mode is off)
 * - verbose mode (JSON mode is off, VERBOSE mode is on)
 * - verbose JSON mode (JSON and VERBOSE modes are on)
 *
 * Generally, we want to hide debug logs unless verbose mode is on,
 * and during JSON mode, we want to ensure no logs end up in stdout,
 * because we assume the user might be piping the output to a JSON parser.
 * However, during verbose JSON mode, we want to keep debug information
 * without breaking the JSON output, so we redirect all logs to stderr.
 */
const Logger = {
  shouldLogToStderr: () => {
    return LOGGING_CONFIG.JSON_MODE;
  },
  shouldSkipDebugLogs: () => {
    return !LOGGING_CONFIG.VERBOSE_MODE;
  },

  log: (...args: any[]) => {
    if (Logger.shouldLogToStderr()) {
      console.error(...args);
      return;
    }
    console.log(...args);
  },
  debug: (...args: any[]) => {
    if (Logger.shouldSkipDebugLogs()) {
      return;
    }
    if (Logger.shouldLogToStderr()) {
      console.error(...args);
      return;
    }
    console.debug(...args);
  },
  warn: (...args: any[]) => {
    if (Logger.shouldLogToStderr()) {
      console.error(...args);
      return;
    }
    console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};

export const logInfo = (...args: any[]) => {
  Logger.log(chalk.white(`[Info]`, ...args));
};

export const logPlain = (...args: any[]) => {
  Logger.log(...args);
};

export const logSuccess = (...args: any[]) => {
  Logger.log(chalk.green(`[Success]`, ...args));
};

export const logDebug = (...args: any[]) => {
  Logger.debug(chalk.gray(`[Debug]`, ...args));
};

export const logWarn = (...args: any[]) => {
  // warnings should always go to stderr
  Logger.warn(chalk.yellow(`[Warn]`, ...args));
};

export const logError = (...args: any[]) => {
  // errors should always go to stderr
  Logger.error(chalk.red(`[Error]`, ...args));
};

export const showBox = (
  color: 'yellow' | 'green' | 'white',
  ...lines: (string | undefined)[]
) => {
  const maxLength = Math.max(
    ...lines.map((line) => {
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Ignore coloring characters
      const visibleLine = line?.replace(/\x1b\[[0-9;]*m/g, '');
      return visibleLine?.length ?? 0;
    })
  );
  const border = `┌${'─'.repeat(maxLength + 2)}┐`;
  const footer = `└${'─'.repeat(maxLength + 2)}┘`;
  const colorFunc =
    color === 'yellow'
      ? chalk.yellow
      : color === 'green'
        ? chalk.green
        : chalk.white;
  Logger.log(colorFunc(border));
  for (const line of lines) {
    if (line) {
      Logger.log(colorFunc(`│ ${line.padEnd(maxLength)} │`));
    }
  }
  Logger.log(colorFunc(footer));
};
