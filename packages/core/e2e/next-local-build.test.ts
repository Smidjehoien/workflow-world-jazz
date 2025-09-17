import { exec as execOriginal } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { describe, expect, test } from 'vitest';

const exec = promisify(execOriginal);

describe.each(['nextjs-webpack', 'nextjs-turbopack'])('e2e', (project) => {
  test('builds without errors', { timeout: 120_000 }, async () => {
    // skip if we're targeting specific app to test
    if (process.env.APP_NAME && project !== process.env.APP_NAME) {
      return;
    }

    const result = await exec('pnpm build', {
      cwd: path.join(process.cwd(), 'apps', project),
    });

    expect(result.stderr).not.toContain('Error:');
  });
});
