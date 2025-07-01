#!/usr/bin/env node

import commonjs from '@rollup/plugin-commonjs';
import multi from '@rollup/plugin-multi-entry';
import { nodeResolve } from '@rollup/plugin-node-resolve';

import { writeFile } from 'fs/promises';
// import swc from '@rollup/plugin-swc';
import { dirname, join, resolve } from 'path';
import { type RollupBuild, rollup } from 'rollup';
import { swc } from 'rollup-plugin-swc3';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// TODO: resolve local config
const resolvedConfig = {
  dirs: ['./workflows'],
  workingDir: process.cwd(),

  // The server bundle to handle step execution
  stepsBundlePath: './api/generated/steps.js', // @vercel/workflow-core hardcodes this path rn

  // The server bundle to handle step execution
  workflowBundle: './api/generated/workflows.js', // @vercel/workflow-core hardcodes this path rn

  // Client bindings to execute steps/workflows
  clientBundlePath: './generated/workflows.js',
};

const stepBundleEntrypoint = join(
  __dirname,
  'entrypoints',
  'vercelAPIStepEntrypoint.js'
);

const inputEntrypoints = {
  include: resolvedConfig.dirs.map(
    (dir) =>
      `${resolve(resolvedConfig.workingDir, dir)}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`
  ),
  exclude: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.next/**',
    '**/.vercel/**',
    '**/.workflow/**',
  ],
};

// Right now we create 3 bundles by calling rollup 3 times. This could just
// be a single rollup plugin that outputs multiple assets, but this was
// hacky and fast to implement.

// Steps Bundle

console.log(
  'Creating Vercel API steps bundle at',
  resolvedConfig.stepsBundlePath
);
const stepBundle: RollupBuild = await rollup({
  // @ts-expect-error - multi plugin changes the input type
  input: {
    include: [...inputEntrypoints.include, stepBundleEntrypoint],
    exclude: inputEntrypoints.exclude,
  },
  treeshake: 'smallest',
  // TODO: use typescript plugin to support user tsconfig
  plugins: [
    swc({
      tsconfig: false,
      jsc: {
        experimental: {
          plugins: [['swc-plugin-workflow', { mode: 'server' }]],
        },
      },
    }),
    // @ts-expect-error - default export is a function
    multi(),
    nodeResolve({
      exportConditions: ['node'],
      modulePaths: [
        // The target directory
        // resolve(resolvedConfig.workingDir, 'node_modules'),
        // CLI package
        resolve(__dirname, 'node_modules', 'mixpart'),
      ],
      dedupe: ['@vercel/workflow-core'],
    }),
    // @ts-expect-error - default export is a function
    commonjs(),
  ],
  preserveSymlinks: true,
});
await stepBundle.write({
  file: resolvedConfig.stepsBundlePath,
  format: 'esm',
});

// Workflows Bundle

console.log(
  'Creating vercel API workflows bundle at',
  resolvedConfig.workflowBundle
);
const workflowsBundle: RollupBuild = await rollup({
  // @ts-expect-error - multi plugin changes the input type
  input: inputEntrypoints,
  treeshake: 'smallest',
  // TODO: use typescript plugin to support user tsconfig
  plugins: [
    swc({
      tsconfig: false,
      jsc: {
        experimental: {
          plugins: [['swc-plugin-workflow', { mode: 'workflow' }]],
        },
      },
    }),
    // @ts-expect-error - default export is a function
    multi(),
    nodeResolve({
      exportConditions: ['node'],
      modulePaths: [
        // The target directory
        // resolve(resolvedConfig.workingDir, 'node_modules'),
        // CLI package
        // resolve(__dirname, 'node_modules'),
        resolve(__dirname, 'node_modules', 'mixpart'),
      ],
      dedupe: ['@vercel/workflow-core'],
    }),
    // @ts-expect-error - default export is a function
    commonjs(),
  ],
  preserveSymlinks: true,
});
const workflowsBundleOutput = await workflowsBundle.generate({
  format: 'cjs',
});
const workflowBundleCode = workflowsBundleOutput.output[0].code;
if (!workflowBundleCode) {
  throw new Error('Failed to generate workflows bundle');
}
const workflowBundlePath = resolve(
  resolvedConfig.workingDir,
  resolvedConfig.workflowBundle
);
await writeFile(
  workflowBundlePath,
  `import { vercelAPIWorkflowsEntrypoint } from '@vercel/workflow-core';
export const POST = vercelAPIWorkflowsEntrypoint(
  ${JSON.stringify(workflowBundleCode)}
);`
);

// Client SDK Bundle

// TODO: we need to update the swc plugin to create a bundle containing
// `start`/`trigger` wrappers for the SDK to re-enable this

// console.log('Creating client SDK bundle at', resolvedConfig.clientBundlePath);
// const clientSDKBundle: RollupBuild = await rollup({
//   // @ts-expect-error - multi plugin changes the input type
//   input: inputEntrypoints,
//   // TODO: use typescript plugin to support user tsconfig
//   plugins: [
//     swc({
//       tsconfig: false,
//       jsc: {
//         experimental: {
//           plugins: [['swc-plugin-workflow', { mode: 'workflow' }]],
//         },
//       },
//     }),
//     // @ts-expect-error - default export is a function
//     multi(),
//   ],
// });
// await clientSDKBundle.write({
//   file: resolvedConfig.clientBundlePath,
//   format: 'module',
// });
