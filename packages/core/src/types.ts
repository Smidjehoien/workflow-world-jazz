import { types } from 'node:util';

export function isError<T extends Error>(
  ctor: new (...args: any[]) => T,
  err: unknown
): err is T {
  return types.isNativeError(err) && err.name === ctor.name;
}

export function getErrorName(err: unknown): string {
  return types.isNativeError(err) ? err.name : 'Error';
}
