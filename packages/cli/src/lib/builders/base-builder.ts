import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as esbuild from 'esbuild';
import { glob } from 'tinyglobby';
import type { WorkflowConfig } from '../config/types.js';
import { createSwcPlugin } from './swc-esbuild-plugin.js';

export abstract class BaseBuilder {
  protected config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  abstract build(): Promise<void>;

  protected async getInputFiles(): Promise<string[]> {
    return glob(
      this.config.dirs.map(
        (dir) =>
          `${resolve(this.config.workingDir, dir)}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`
      ),
      {
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/.vercel/**',
          '**/.workflow/**',
        ],
        absolute: true,
      }
    );
  }

  protected async createStepsBundle(outputPath: string): Promise<void> {
    const inputFiles = await this.getInputFiles();

    // Create a virtual entry that imports all files. All step definitions
    // will get registered thanks to the swc transform.
    const imports = inputFiles.map((file) => `import '${file}';`).join('\n');
    const entryContent = `${imports}\nexport { vercelAPIStepsEntrypoint as POST } from '@vercel/workflow-core/runtime';`;

    // Bundle with esbuild and our custom SWC plugin
    await esbuild.build({
      stdin: {
        contents: entryContent,
        resolveDir: this.config.workingDir,
        sourcefile: 'virtual-entry.js',
        loader: 'js',
      },
      outfile: outputPath,
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'es2022',
      write: true,
      treeShaking: true,
      // TODO: ensure we resolve dependencies (like @vercel/workflow-core)
      // from the project root.
      external: ['@aws-sdk/credential-provider-web-identity'],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      plugins: [createSwcPlugin({ mode: 'step' })],
    });
  }

  protected async createWorkflowsBundle(outputPath: string): Promise<void> {
    const inputFiles = await this.getInputFiles();

    // Create a virtual entry that imports all files
    const imports = inputFiles
      .map((file) => `export * from '${file}';`)
      .join('\n');

    console.log('Creating intermediate workflow bundle');

    // Bundle with esbuild and our custom SWC plugin in workflow mode.
    // this bundle will be run inside a vm isolate
    const interimBundle = await esbuild.build({
      stdin: {
        contents: imports,
        resolveDir: this.config.workingDir,
        sourcefile: 'virtual-entry.js',
        loader: 'js',
      },
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'es2022',
      write: false,
      treeShaking: true,
      external: ['@aws-sdk/credential-provider-web-identity'],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      plugins: [createSwcPlugin({ mode: 'workflow' })],
    });

    if (!interimBundle.outputFiles || interimBundle.outputFiles.length === 0) {
      throw new Error('No output files generated from esbuild');
    }

    const workflowBundleCode = interimBundle.outputFiles[0].text;

    // Create the workflow function handler
    const workflowFunctionCode = `import { vercelAPIWorkflowsEntrypoint } from '@vercel/workflow-core/runtime';

const workflowCode = \`${workflowBundleCode.replace(/[\\`$]/g, '\\$&')}\`;

export const POST = vercelAPIWorkflowsEntrypoint(workflowCode);`;

    console.log('Creating final workflow bundle');

    // Now bundle this so we can resolve the @vercel/workflow-core dependency
    await esbuild.build({
      stdin: {
        contents: workflowFunctionCode,
        resolveDir: this.config.workingDir,
        sourcefile: 'virtual-entry.js',
        loader: 'js',
      },
      outfile: outputPath,
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'es2022',
      write: true,
      external: ['@aws-sdk/credential-provider-web-identity'],
    });
  }

  protected async buildClientLibrary(): Promise<void> {
    if (!this.config.clientBundlePath) {
      // Silently exit since no client bundle was requested
      return;
    }

    console.log('Generating a client library at', this.config.clientBundlePath);
    console.log(
      'NOTE: The recommended way to use workflow with a framework like NextJS is using the loader/plugin with webpack/turbobpack/rollup'
    );

    const inputFiles = await this.getInputFiles();

    // Create a virtual entry that imports all files
    const imports = inputFiles
      .map((file) => `export * from '${file}';`)
      .join('\n');

    // Bundle with esbuild and our custom SWC plugin
    const result = await esbuild.build({
      stdin: {
        contents: imports,
        resolveDir: this.config.workingDir,
        sourcefile: 'virtual-entry.js',
        loader: 'js',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      write: false,
      treeShaking: true,
      external: ['@vercel/workflow-core'],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      plugins: [createSwcPlugin({ mode: 'client' })],
    });

    if (!result.outputFiles || result.outputFiles.length === 0) {
      throw new Error('No output files generated from esbuild');
    }

    // Write the output
    const outputDir = dirname(this.config.clientBundlePath);
    await mkdir(outputDir, { recursive: true });
    await writeFile(this.config.clientBundlePath, result.outputFiles[0].text);
  }
}
