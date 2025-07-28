import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const staticDir = '.vercel/output/static';
const outDir = '.vercel/output/functions/api/trigger.func';

await mkdir(staticDir, { recursive: true });
await mkdir(outDir, { recursive: true });

// Return a 200 for the `patrickedqvist/wait-for-vercel-preview` GH action for e2e tests
await writeFile(`${staticDir}/index.html`, '<h1>Workflows SDK Example</h1>');

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
