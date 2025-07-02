import { resolve } from 'node:path';
import commonjs from '@rollup/plugin-commonjs';
import multi from '@rollup/plugin-multi-entry';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { type RollupBuild, rollup } from 'rollup';
import { swc } from 'rollup-plugin-swc3';
import type { InputEntrypoints, WorkflowConfig } from '../config/types.js';

export abstract class BaseBuilder {
  protected config: WorkflowConfig;
  protected inputEntrypoints: InputEntrypoints;
  protected stepBundleEntrypoint: string;

  constructor(config: WorkflowConfig, dirname: string) {
    this.config = config;
    this.stepBundleEntrypoint = resolve(
      dirname,
      '..',
      'entrypoints',
      'vercelAPIStepEntrypoint.js'
    );

    this.inputEntrypoints = {
      include: this.config.dirs.map(
        (dir) =>
          `${resolve(this.config.workingDir, dir)}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`
      ),
      exclude: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/.vercel/**',
        '**/.workflow/**',
      ],
    };
  }

  abstract build(): Promise<void>;

  protected async createStepsBundle(): Promise<RollupBuild> {
    return rollup({
      // @ts-expect-error - multi plugin changes the input type
      input: {
        include: [...this.inputEntrypoints.include, this.stepBundleEntrypoint],
        exclude: this.inputEntrypoints.exclude,
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
          modulePaths: [resolve(process.cwd(), 'node_modules', 'mixpart')],
          dedupe: ['@vercel/workflow-core'],
        }),
        // @ts-expect-error - default export is a function
        commonjs(),
      ],
      preserveSymlinks: true,
    });
  }

  protected async createWorkflowsBundle(): Promise<RollupBuild> {
    return rollup({
      // @ts-expect-error - multi plugin changes the input type
      input: this.inputEntrypoints,
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
          modulePaths: [resolve(process.cwd(), 'node_modules', 'mixpart')],
          dedupe: ['@vercel/workflow-core'],
        }),
        // @ts-expect-error - default export is a function
        commonjs(),
      ],
      preserveSymlinks: true,
    });
  }
}
