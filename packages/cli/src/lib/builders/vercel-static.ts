import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { BaseBuilder } from './base-builder.js';

export class VercelStaticBuilder extends BaseBuilder {
  async build(): Promise<void> {
    await this.buildStepsBundle();
    await this.buildWorkflowsBundle();

    await this.buildClientLibrary();
  }

  private async buildStepsBundle(): Promise<void> {
    console.log(
      'Creating Vercel API steps bundle at',
      this.config.stepsBundlePath
    );

    const stepsBundlePath = resolve(
      this.config.workingDir,
      this.config.stepsBundlePath
    );

    // Ensure directory exists
    await mkdir(dirname(stepsBundlePath), { recursive: true });

    await this.createStepsBundle(stepsBundlePath);
  }

  private async buildWorkflowsBundle(): Promise<void> {
    console.log(
      'Creating vercel API workflows bundle at',
      this.config.workflowsBundlePath
    );

    const workflowBundlePath = resolve(
      this.config.workingDir,
      this.config.workflowsBundlePath
    );

    // Ensure directory exists
    await mkdir(dirname(workflowBundlePath), { recursive: true });

    await this.createWorkflowsBundle(workflowBundlePath);
  }
}
