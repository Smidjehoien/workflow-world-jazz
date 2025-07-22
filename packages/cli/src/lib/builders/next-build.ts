import { constants } from 'node:fs';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BaseBuilder } from './base-builder.js';

export class NextBuilder extends BaseBuilder {
  async build(): Promise<void> {
    const outputDir = await this.findAppDirectory();
    const apiGeneratedDir = join(outputDir, 'api/generated');

    // TODO: add .gitignore of the api/generated outputs

    // Ensure output directories exist
    await mkdir(apiGeneratedDir, { recursive: true });
    // ignore the generated assets
    await writeFile(join(apiGeneratedDir, '.gitignore'), '*');

    // TODO: discover 'use workflow' and 'use step' files as inputs
    // instead of relying on workflows folder (will need to support watching)
    await this.buildStepsFunction(apiGeneratedDir);
    await this.buildWorkflowsFunction(apiGeneratedDir);
  }

  private async buildStepsFunction(apiGeneratedDir: string): Promise<void> {
    console.log('Creating steps function');
    // Create steps bundle
    const stepsRouteDir = join(apiGeneratedDir, 'steps');
    await mkdir(stepsRouteDir, { recursive: true });
    await this.createStepsBundle(join(stepsRouteDir, 'route.cjs'));
  }

  private async buildWorkflowsFunction(apiGeneratedDir: string): Promise<void> {
    console.log('Creating Next JS workflows route');
    const workflowsRouteDir = join(apiGeneratedDir, 'workflows');
    await mkdir(workflowsRouteDir, { recursive: true });
    await this.createWorkflowsBundle(join(workflowsRouteDir, 'route.cjs'));
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
