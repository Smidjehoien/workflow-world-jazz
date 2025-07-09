import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

    const stepBundle = await this.createStepsBundle();
    await stepBundle.write({
      file: this.config.stepsBundlePath,
      format: 'esm',
    });
  }

  private async buildWorkflowsBundle(): Promise<void> {
    console.log(
      'Creating vercel API workflows bundle at',
      this.config.workflowsBundlePath
    );

    const workflowsBundle = await this.createWorkflowsBundle();
    const workflowsBundleOutput = await workflowsBundle.generate({
      format: 'cjs',
    });

    const workflowBundleCode = workflowsBundleOutput.output[0].code;
    if (!workflowBundleCode) {
      throw new Error('Failed to generate workflows bundle');
    }

    const workflowBundlePath = resolve(
      this.config.workingDir,
      this.config.workflowsBundlePath
    );

    const workflowFunctionCode = `import { vercelAPIWorkflowsEntrypoint } from '@vercel/workflow-core';

const workflowCode = \`${workflowBundleCode.replace(/[`$]/g, '\\$&')}\`;

export const POST = vercelAPIWorkflowsEntrypoint(workflowCode);`;

    await writeFile(workflowBundlePath, workflowFunctionCode);
  }
}
