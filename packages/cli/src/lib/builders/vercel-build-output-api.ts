import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as esbuild from 'esbuild';
import { BaseBuilder } from './base-builder.js';

export class VercelBuildOutputAPIBuilder extends BaseBuilder {
  async build(): Promise<void> {
    const outputDir = resolve(this.config.workingDir, '.vercel/output');
    const functionsDir = join(outputDir, 'functions');
    const apiGeneratedDir = join(functionsDir, 'api/generated');

    // Ensure output directories exist
    await mkdir(apiGeneratedDir, { recursive: true });

    await this.buildStepsFunction(apiGeneratedDir);
    await this.buildWorkflowsFunction(apiGeneratedDir);
    await this.createBuildOutputConfig(outputDir);

    await this.buildClientLibrary();
  }

  private async buildStepsFunction(apiGeneratedDir: string): Promise<void> {
    console.log('Creating Vercel Build Output API steps function');
    const stepsFuncDir = join(apiGeneratedDir, 'steps.func');
    await mkdir(stepsFuncDir, { recursive: true });

    // Create steps bundle
    await this.createStepsBundle(join(stepsFuncDir, 'index.js'));

    // Create package.json for ESM support
    const packageJson = {
      type: 'commonjs',
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
      architecture: 'arm64',
      shouldAddHelpers: true,
      experimentalTriggers: [
        {
          type: 'queue/v1beta',
          topic: 'step-*',
          consumer: 'default',
          maxDeliveries: 10, // Optional: Maximum number of delivery attempts (default: 3)
          retryAfterSeconds: 5, // Optional: Delay between retries (default: 60)
          initialDelaySeconds: 0, // Optional: Initial delay before first delivery (default: 0)
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

    await this.createWorkflowsBundle(join(workflowsFuncDir, 'index.js'));

    // Create package.json for ESM support
    const packageJson = {
      type: 'commonjs',
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
      architecture: 'arm64',
      shouldAddHelpers: true,
      experimentalTriggers: [
        {
          type: 'queue/v1beta',
          topic: 'workflow-*',
          consumer: 'default',
          maxDeliveries: 10, // Optional: Maximum number of delivery attempts (default: 3)
          retryAfterSeconds: 5, // Optional: Delay between retries (default: 60)
          initialDelaySeconds: 0, // Optional: Initial delay before first delivery (default: 0)
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
