#!/usr/bin/env node

import commonjs from '@rollup/plugin-commonjs';
import multi from '@rollup/plugin-multi-entry';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import virtual from '@rollup/plugin-virtual';

import { mkdir, writeFile } from 'fs/promises';
// import swc from '@rollup/plugin-swc';
import { dirname, join, resolve } from 'path';
import { type RollupBuild, rollup } from 'rollup';
import { swc } from 'rollup-plugin-swc3';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: { buildTarget?: string; help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target' && i + 1 < args.length) {
      options.buildTarget = args[i + 1];
      i++; // skip next argument since it's the value
    } else if (arg.startsWith('--target=')) {
      options.buildTarget = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Workflow CLI - Build workflow bundles for Vercel

Usage: workflow [options]

Options:
  --target <target>        Set the build target (default: vercel-static)
                          Available targets:
                            vercel-static           - Create static bundles (current approach)
                            vercel-build-output-api - Create Vercel Build Output API structure
  --help, -h              Show this help message

Examples:
  workflow                                  # Use default build target (vercel-static)
  workflow --target vercel-static          # Use vercel-static target
  workflow --target vercel-build-output-api  # Use Build Output API target
`);
}

const cliOptions = parseArgs();

// Show help if requested
if (cliOptions.help) {
  showHelp();
  process.exit(0);
}

// Validate build target
const validBuildTargets = ['vercel-static', 'vercel-build-output-api'] as const;
type BuildTarget = (typeof validBuildTargets)[number];

function isValidBuildTarget(target: string | undefined): target is BuildTarget {
  return validBuildTargets.includes(target as BuildTarget);
}

const defaultBuildTarget: BuildTarget = 'vercel-static';
const buildTarget = isValidBuildTarget(cliOptions.buildTarget)
  ? cliOptions.buildTarget
  : defaultBuildTarget;

if (cliOptions.buildTarget && !isValidBuildTarget(cliOptions.buildTarget)) {
  console.warn(
    `Warning: Invalid target "${cliOptions.buildTarget}". Using default "${defaultBuildTarget}".`
  );
  console.warn(`Valid targets: ${validBuildTargets.join(', ')}`);
}

console.log(`Using target: ${buildTarget}`);

// TODO: resolve local config
const resolvedConfig = {
  dirs: ['./workflows'],
  workingDir: process.cwd(),

  // Build target: 'vercel-static' or 'vercel-build-output-api'
  buildTarget,

  // The server bundle to handle step execution (for vercel-static target)
  stepsBundlePath: './api/generated/steps.js', // @vercel/workflow-core hardcodes this path rn

  // The server bundle to handle step execution (for vercel-static target)
  workflowBundle: './api/generated/workflows.js', // @vercel/workflow-core hardcodes this path rn

  // Client bindings to execute steps/workflows
  clientBundlePath: './generated/workflows.js',

  // Build Output API paths (for vercel-build-output-api target)
  buildOutputDir: './.vercel/output',
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

if (resolvedConfig.buildTarget === 'vercel-static') {
  await buildVercelStatic();
} else if (resolvedConfig.buildTarget === 'vercel-build-output-api') {
  await buildVercelBuildOutputAPI();
} else {
  throw new Error(`Unknown build target: ${resolvedConfig.buildTarget}`);
}

async function buildVercelStatic() {
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
}

async function buildVercelBuildOutputAPI() {
  const outputDir = resolve(
    resolvedConfig.workingDir,
    resolvedConfig.buildOutputDir
  );
  const functionsDir = join(outputDir, 'functions');
  const apiGeneratedDir = join(functionsDir, 'api/generated');

  // Ensure output directories exist
  await mkdir(apiGeneratedDir, { recursive: true });

  // Steps Function
  console.log('Creating Vercel Build Output API steps function');
  const stepsFuncDir = join(apiGeneratedDir, 'steps.func');
  await mkdir(stepsFuncDir, { recursive: true });

  const stepBundle: RollupBuild = await rollup({
    // @ts-expect-error - multi plugin changes the input type
    input: {
      include: [...inputEntrypoints.include, stepBundleEntrypoint],
      exclude: inputEntrypoints.exclude,
    },
    treeshake: 'smallest',
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
        modulePaths: [resolve(__dirname, 'node_modules', 'mixpart')],
        dedupe: ['@vercel/workflow-core'],
      }),
      // @ts-expect-error - default export is a function
      commonjs(),
    ],
    preserveSymlinks: true,
  });

  await stepBundle.write({
    file: join(stepsFuncDir, 'index.js'),
    format: 'esm',
  });

  // Create .vc-config.json for steps function
  const stepsConfig = {
    runtime: 'nodejs22.x',
    handler: 'index.js',
    launcherType: 'Nodejs',
    shouldAddHelpers: true,
  };

  await writeFile(
    join(stepsFuncDir, '.vc-config.json'),
    JSON.stringify(stepsConfig, null, 2)
  );

  // Workflows Function
  console.log('Creating Vercel Build Output API workflows function');
  const workflowsFuncDir = join(apiGeneratedDir, 'workflows.func');
  await mkdir(workflowsFuncDir, { recursive: true });

  const embeddedCodeBundle: RollupBuild = await rollup({
    // @ts-expect-error - multi plugin changes the input type
    input: inputEntrypoints,
    treeshake: 'smallest',
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
        modulePaths: [resolve(__dirname, 'node_modules', 'mixpart')],
        dedupe: ['@vercel/workflow-core'],
      }),
      // @ts-expect-error - default export is a function
      commonjs(),
    ],
    preserveSymlinks: true,
  });

  const embeddedBundleOutput = await embeddedCodeBundle.generate({
    format: 'cjs',
  });
  const workflowBundleCode = embeddedBundleOutput.output[0].code;
  if (!workflowBundleCode) {
    throw new Error('Failed to generate workflows bundle');
  }

  // Create the workflow function handler
  const workflowFunctionCode = `import { vercelAPIWorkflowsEntrypoint } from '@vercel/workflow-core';

const workflowCode = \`${workflowBundleCode.replace(/[`$]/g, '\\$&')}\`;

export default function handler(req, res) {
  const entrypoint = vercelAPIWorkflowsEntrypoint(workflowCode);
  return entrypoint(req, res);
}`;

  // Now we bundle this code into the final workflow bundle
  const workflowBundle: RollupBuild = await rollup({
    input: 'entry',
    treeshake: 'smallest',
    plugins: [
      // @ts-expect-error - default export is a function
      virtual({
        entry: workflowFunctionCode,
      }),
      nodeResolve({
        exportConditions: ['node'],
        // modulePaths: [resolve(__dirname, 'node_modules', 'mixpart')],
        dedupe: ['@vercel/workflow-core'],
      }),
      // @ts-expect-error - default export is a function
      commonjs(),
    ],
    preserveSymlinks: true,
  });

  await workflowBundle.write({
    file: join(workflowsFuncDir, 'index.js'),
    format: 'esm',
  });

  // Create .vc-config.json for workflows function
  const workflowsConfig = {
    runtime: 'nodejs22.x',
    handler: 'index.js',
    launcherType: 'Nodejs',
    shouldAddHelpers: true,
  };

  await writeFile(
    join(workflowsFuncDir, '.vc-config.json'),
    JSON.stringify(workflowsConfig, null, 2)
  );

  // Create config.json for Build Output API
  const buildOutputConfig = {
    version: 3,
  };

  await writeFile(
    join(outputDir, 'config.json'),
    JSON.stringify(buildOutputConfig, null, 2)
  );

  console.log(`Build Output API created at ${outputDir}`);
  console.log('Steps function available at /api/generated/steps');
  console.log('Workflows function available at /api/generated/workflows');
}

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
