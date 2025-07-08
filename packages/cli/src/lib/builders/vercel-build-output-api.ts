import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import virtual from '@rollup/plugin-virtual';
import { type RollupBuild, rollup } from 'rollup';
import { BaseBuilder } from './base-builder.js';

export class VercelBuildOutputAPIBuilder extends BaseBuilder {
  async build(): Promise<void> {
    const outputDir = resolve(
      this.config.workingDir,
      this.config.buildOutputDir
    );
    const functionsDir = join(outputDir, 'functions');
    const apiGeneratedDir = join(functionsDir, 'api/generated');

    // Ensure output directories exist
    await mkdir(apiGeneratedDir, { recursive: true });

    await this.buildStepsFunction(apiGeneratedDir);
    await this.buildWorkflowsFunction(apiGeneratedDir);
    await this.createBuildOutputConfig(outputDir);
  }

  private async buildStepsFunction(apiGeneratedDir: string): Promise<void> {
    console.log('Creating Vercel Build Output API steps function');
    const stepsFuncDir = join(apiGeneratedDir, 'steps.func');
    await mkdir(stepsFuncDir, { recursive: true });

    const stepBundle = await this.createStepsBundle();
    await stepBundle.write({
      file: join(stepsFuncDir, 'index.js'),
      format: 'esm',
    });

    // Create package.json for ESM support
    const packageJson = {
      type: 'module',
    };
    await writeFile(
      join(stepsFuncDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create .vc-config.json for steps function
    const stepsConfig = {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: true,
      experimentalTriggers: [
        {
          type: 'queue/v1beta',
          topic: 'step-*',
          consumer: 'default',
        },
      ],
    };

    await writeFile(
      join(stepsFuncDir, '.vc-config.json'),
      JSON.stringify(stepsConfig, null, 2)
    );
  }

  private async buildWorkflowsFunction(apiGeneratedDir: string): Promise<void> {
    console.log('Creating Vercel Build Output API workflows function');
    const workflowsFuncDir = join(apiGeneratedDir, 'workflows.func');
    await mkdir(workflowsFuncDir, { recursive: true });

    const embeddedCodeBundle = await this.createWorkflowsBundle();
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

export const POST = vercelAPIWorkflowsEntrypoint(workflowCode);`;

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

    // Create package.json for ESM support
    const packageJson = {
      type: 'module',
    };
    await writeFile(
      join(workflowsFuncDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create .vc-config.json for workflows function
    const workflowsConfig = {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      shouldAddHelpers: true,
      experimentalTriggers: [
        {
          type: 'queue/v1beta',
          topic: 'workflow-*',
          consumer: 'default',
        },
      ],
    };

    await writeFile(
      join(workflowsFuncDir, '.vc-config.json'),
      JSON.stringify(workflowsConfig, null, 2)
    );
  }

  private async createBuildOutputConfig(outputDir: string): Promise<void> {
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
}
