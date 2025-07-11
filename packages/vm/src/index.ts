import { runInContext, createContext as vmCreateContext } from 'node:vm';
import seedrandom from 'seedrandom';
import { createRandomUUID } from './uuid';

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
export function createContext(options: CreateContextOptions) {
  let { fixedTimestamp } = options;
  const { seed } = options;
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

  // Deterministic `crypto` using Proxy to avoid mutating global objects
  const originalCrypto = globalThis.crypto;
  const originalSubtle = originalCrypto.subtle;

  function getRandomValues(array: Uint8Array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(rng() * 256);
    }
    return array;
  }

  const randomUUID = createRandomUUID(rng);

  const boundDigest = originalSubtle.digest.bind(originalSubtle);

  g.crypto = new Proxy(originalCrypto, {
    get(target, prop) {
      if (prop === 'getRandomValues') {
        return getRandomValues;
      }
      if (prop === 'randomUUID') {
        return randomUUID;
      }
      if (prop === 'subtle') {
        return new Proxy(originalSubtle, {
          get(target, prop) {
            if (prop === 'generateKey') {
              return () => {
                throw new Error('Not implemented');
              };
            } else if (prop === 'digest') {
              return boundDigest;
            }
            return target[prop as keyof typeof originalSubtle];
          },
        });
      }
      return target[prop as keyof typeof originalCrypto];
    },
  });

  // Web APIs that are made available in the context
  g.TextEncoder = globalThis.TextEncoder;
  g.TextDecoder = globalThis.TextDecoder;

  // Shim exports for bundle
  g.exports = {};

  return {
    context,
    updateTimestamp: (timestamp: number) => {
      fixedTimestamp = timestamp;
    },
  };
}
