import {
  type Context,
  runInContext,
  createContext as vmCreateContext,
} from 'node:vm';
import seedrandom from 'seedrandom';

export interface CreateContextOptions {
  seed: string;
  // Fixed timestamp for deterministic Date operations
  fixedTimestamp: number;
}

/**
 * Creates a Node.js `vm.Context` configured to be usable for
 * executing workflow logic in a deterministic environment.
 *
 * @param options - The options for the context.
 * @returns The context.
 */
export function createContext(options: CreateContextOptions): Context {
  const { seed, fixedTimestamp } = options;
  const rng = seedrandom(seed);
  const context = vmCreateContext();

  const g = runInContext('globalThis', context);

  // Deterministic `Math.random()`
  g.Math.random = rng;

  // Override `Date` constructor to return fixed time when called without arguments
  const Date_ = g.Date;
  // biome-ignore lint/suspicious/noShadowRestrictedNames: We're shadowing the global `Date` property to make it deterministic.
  g.Date = function Date(...args: Parameters<(typeof globalThis)['Date']>[]) {
    if (args.length === 0) {
      return new Date_(fixedTimestamp);
    }
    return new Date_(...args);
  };
  // Preserve static methods
  Object.setPrototypeOf(g.Date, Date_);
  g.Date.now = () => fixedTimestamp;

  // Deterministic `crypto`
  g.crypto = globalThis.crypto;

  g.crypto.getRandomValues = (
    array: Parameters<(typeof globalThis)['crypto']['getRandomValues']>['0']
  ) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(rng() * 256);
    }
    return array;
  };

  // Simple deterministic `crypto.randomUUID()` (not cryptographically secure)
  g.crypto.randomUUID = () => {
    const chars = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4'; // Version 4 UUID
      } else if (i === 19) {
        uuid += chars[Math.floor(rng() * 4) + 8]; // 8, 9, a, or b
      } else {
        uuid += chars[Math.floor(rng() * 16)];
      }
    }
    return uuid;
  };

  // Web APIs that are made available in the context
  g.TextEncoder = globalThis.TextEncoder;
  g.TextDecoder = globalThis.TextDecoder;

  return context;
}
