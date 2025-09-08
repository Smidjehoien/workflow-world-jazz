import { constants } from 'node:fs';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BaseBuilder } from './base-builder.js';

export class NextBuilder extends BaseBuilder {
  async build(): Promise<void> {
    const outputDir = await this.findAppDirectory();
    const apiGeneratedDir = join(outputDir, 'api/generated');

    // Ensure output directories exist
    await mkdir(apiGeneratedDir, { recursive: true });
    // ignore the generated assets

    await writeFile(join(apiGeneratedDir, '.gitignore'), '*');

    const inputFiles = await this.getInputFiles();
    const tsConfig = await this.getTsConfigOptions();

    const options = {
      inputFiles,
      apiGeneratedDir,
      tsBaseUrl: tsConfig.baseUrl,
      tsPaths: tsConfig.paths,
    };
    await this.buildStepsFunction(options);
    await this.buildWorkflowsFunction(options);
    await this.writeFunctionsConfig(outputDir);
  }

  private async writeFunctionsConfig(outputDir: string) {
    // we don't run this in development mode as it's not needed
    if (process.env.NODE_ENV === 'development') {
      return;
    }
    const generatedConfig = {
      version: '0',
      steps: {
        experimentalTriggers: [
          {
            type: 'queue/v1beta',
            topic: '__wkf_step_*',
            consumer: 'default',
            maxDeliveries: 64,
            retryAfterSeconds: 5,
            initialDelaySeconds: 0,
          },
        ],
      },
      workflows: {
        experimentalTriggers: [
          {
            type: 'queue/v1beta',
            topic: '__wkf_workflow_*',
            consumer: 'default',
            maxDeliveries: 64,
            retryAfterSeconds: 5,
            initialDelaySeconds: 0,
          },
        ],
      },
    };

    // We write this file to the generated directory for
    // the Next.js builder to consume
    await writeFile(
      join(outputDir, 'api/generated/config.json'),
      JSON.stringify(generatedConfig, null, 2)
    );
  }

  private async buildStepsFunction({
    inputFiles,
    apiGeneratedDir,
    tsPaths,
    tsBaseUrl,
  }: {
    inputFiles: string[];
    apiGeneratedDir: string;
    tsBaseUrl?: string;
    tsPaths?: Record<string, string[]>;
  }): Promise<void> {
    console.log('Creating steps function');
    // Create steps bundle
    const stepsRouteDir = join(apiGeneratedDir, 'steps');
    await mkdir(stepsRouteDir, { recursive: true });
    await this.createStepsBundle({
      // If any dynamic requires are used when bundling with ESM
      // esbuild will create a too dynamic wrapper around require
      // which turbopack/webpack fail to analyze. If we externalize
      // correctly this shouldn't be an issue although we might want
      // to use cjs as alternative to avoid
      format: 'esm',
      inputFiles,
      outfile: join(stepsRouteDir, 'route.js'),
      externalizeNonSteps: true,
      tsBaseUrl,
      tsPaths,
    });
  }

  private async buildWorkflowsFunction({
    inputFiles,
    apiGeneratedDir,
    tsPaths,
    tsBaseUrl,
  }: {
    inputFiles: string[];
    apiGeneratedDir: string;
    tsBaseUrl?: string;
    tsPaths?: Record<string, string[]>;
  }): Promise<void> {
    console.log('Creating Next JS workflows route');
    const workflowsRouteDir = join(apiGeneratedDir, 'workflows');
    await mkdir(workflowsRouteDir, { recursive: true });
    await this.createWorkflowsBundle({
      format: 'esm',
      outfile: join(workflowsRouteDir, 'route.js'),
      bundleFinalOutput: false,
      inputFiles,
      tsBaseUrl,
      tsPaths,
    });
  }

  private async findAppDirectory(): Promise<string> {
    const appDir = resolve(this.config.workingDir, 'app');
    const srcAppDir = resolve(this.config.workingDir, 'src/app');

    try {
      await access(appDir, constants.F_OK);
      const appStats = await stat(appDir);
      if (!appStats.isDirectory()) {
        throw new Error(`Path exists but is not a directory: ${appDir}`);
      }
      return appDir;
    } catch {
      try {
        await access(srcAppDir, constants.F_OK);
        const srcAppStats = await stat(srcAppDir);
        if (!srcAppStats.isDirectory()) {
          throw new Error(`Path exists but is not a directory: ${srcAppDir}`);
        }
        return srcAppDir;
      } catch {
        throw new Error(
          'Could not find Next.js app directory. Expected either "app" or "src/app" to exist.'
        );
      }
    }
  }
}
