import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base.js';
import { VercelBuildOutputAPIBuilder } from '../lib/builders/vercel-build-output-api.js';
import { VercelStaticBuilder } from '../lib/builders/vercel-static.js';
import {
  type BuildTarget,
  isValidBuildTarget,
  type WorkflowConfig,
} from '../lib/config/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default class Build extends BaseCommand {
  static description = 'Build workflow bundles for deployment';

  static examples = [
    '$ workflow build',
    '$ workflow build --target vercel-build-output-api',
    '$ workflow build vercel-static',
  ];

  static flags = {
    target: Flags.string({
      char: 't',
      description: 'build target',
      options: ['vercel-static', 'vercel-build-output-api'],
      default: 'vercel-static',
    }),
  };

  static args = {
    target: Args.string({
      description: 'build target (deprecated, use --target flag)',
      required: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Build);

    // Get build target from flag or arg (with flag taking precedence)
    let buildTarget: string = flags.target;
    if (args.target && !flags.target) {
      buildTarget = args.target;
      this.logWarn(
        'Using positional argument for target is deprecated. Use --target flag instead.'
      );
    }

    // Validate build target
    if (!isValidBuildTarget(buildTarget)) {
      this.logWarn(
        `Invalid target "${buildTarget}". Using default "vercel-static".`
      );
      this.logWarn('Valid targets: vercel-static, vercel-build-output-api');
      buildTarget = 'vercel-static';
    }

    this.logInfo(`Using target: ${buildTarget}`);

    // Create configuration
    const config: WorkflowConfig = {
      dirs: ['./workflows'],
      workingDir: process.cwd(),
      buildTarget: buildTarget as BuildTarget,
      stepsBundlePath: './api/generated/steps.js',
      workflowsBundlePath: './api/generated/workflows.js',

      // WIP: generate a client library to easily execute workflows/steps
      // clientBundlePath: './lib/generated/workflows.js',
    };

    try {
      // Build using appropriate builder
      if (config.buildTarget === 'vercel-static') {
        this.logInfo('Building with VercelStaticBuilder');
        const builder = new VercelStaticBuilder(config);
        await builder.build();
      } else if (config.buildTarget === 'vercel-build-output-api') {
        this.logInfo('Building with VercelBuildOutputAPIBuilder');
        const builder = new VercelBuildOutputAPIBuilder(config);
        await builder.build();
      } else {
        this.error(`Unknown build target: ${config.buildTarget}`);
      }

      this.logInfo('Build completed successfully!');
    } catch (error) {
      this.error(
        `Build failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
