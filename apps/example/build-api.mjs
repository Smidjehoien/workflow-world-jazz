import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

// Return a 200 for the `patrickedqvist/wait-for-vercel-preview` GH action for e2e tests
const staticDir = '.vercel/output/static';
await mkdir(staticDir, { recursive: true });
await writeFile(`${staticDir}/index.html`, '<h1>Workflows SDK Example</h1>');

const files = await readdir('api_');

for (const file of files) {
  // remove the .ts extension
  const outFile = file.replace('.ts', '');

  const outDir = `.vercel/output/functions/api/${outFile}.func`;
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
    entryPoints: [`api_/${file}`],
    outfile: `${outDir}/main.js`,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    external: ['@aws-sdk/credential-provider-web-identity'],
  });

  console.log(`Built \`/api/${outFile}\` endpoint`);
}
