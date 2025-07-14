import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { BaseBuilder } from './base-builder.js';

export class NextBuilder extends BaseBuilder {
  async build(): Promise<void> {
    // TODO: This needs to discover the user's existing app dir
    const outputDir = resolve(this.config.workingDir, 'app');
    const apiGeneratedDir = join(outputDir, 'api/generated');

    // TODO: add .gitignore of the api/generated outputs

    // Ensure output directories exist
    await mkdir(apiGeneratedDir, { recursive: true });

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
    await this.createStepsBundle(join(stepsRouteDir, 'route.js'));
  }

  private async buildWorkflowsFunction(apiGeneratedDir: string): Promise<void> {
    console.log('Creating Next JS workflows route');
    const workflowsRouteDir = join(apiGeneratedDir, 'workflows');
    await mkdir(workflowsRouteDir, { recursive: true });
    await this.createWorkflowsBundle(join(workflowsRouteDir, 'route.js'));
  }
}
