import ms, { type StringValue } from 'ms';
import { RetryableError } from './global.js';
import { getContext } from './step/get-context.js';

// vqs has a max message visibility lifespan, the workflow sleep function
// will retry repeatedly until the user requested duration is reached.
// (Eventually make this configurable based on the queue backend adapter)
const MAX_SLEEP_DURATION_SECONDS = ms('23h') / 1000;

/**
 * Sleep within a workflow for a given duration.
 *
 * @param duration - The duration to sleep for. This is a string in the format
 * of `"1000ms"`, `"1s"`, `"1m"`, `"1h"`, or `"1d"`.
 * @returns A promise that resolves when the sleep is complete.
 */

export async function sleep(duration: StringValue): Promise<void> {
  'use step';
  const { stepStartedAt } = getContext();
  const durationMs = ms(duration);

  if (typeof durationMs !== 'number' || durationMs < 0) {
    throw new Error(
      `Invalid sleep duration: "${duration}". Expected a valid duration string like "1s", "1m", "1h", etc.`
    );
  }

  const endAt = +stepStartedAt + durationMs;
  const now = Date.now();
  if (now < endAt) {
    const remainingSeconds = (endAt - now) / 1000;
    const retryAfter = Math.min(remainingSeconds, MAX_SLEEP_DURATION_SECONDS);
    throw new RetryableError(
      `Sleeping for ${ms(retryAfter * 1000, { long: true })}`,
      {
        retryAfter,
      }
    );
  }
}
sleep.maxRetries = Infinity;
