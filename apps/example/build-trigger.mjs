import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const outDir = '.vercel/output/functions/api/trigger.func';

await mkdir(outDir, { recursive: true });

await writeFile(
  `${outDir}/package.json`,
  JSON.stringify({ type: 'commonjs' }, null, 2)
);

await writeFile(
  `${outDir}/.vc-config.json`,
  JSON.stringify(
    {
      handler: 'main.js',
      runtime: 'nodejs22.x',
      architecture: 'arm64',
      launcherType: 'Nodejs',
    },
    null,
    2
  )
);

await build({
  entryPoints: ['api_/trigger.ts'],
  outfile: `${outDir}/main.js`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['@aws-sdk/credential-provider-web-identity'],
});
