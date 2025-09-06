import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import enhancedResolveOriginal from 'enhanced-resolve';
import * as esbuild from 'esbuild';
import { glob } from 'tinyglobby';
import type { WorkflowConfig } from '../config/types.js';
import { createDiscoverEntriesPlugin } from './discover-entries-esbuild-plugin.js';
import { createSwcPlugin } from './swc-esbuild-plugin.js';

const enhancedResolve = promisify(enhancedResolveOriginal);

export abstract class BaseBuilder {
  protected config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  abstract build(): Promise<void>;

  private cachedInputFiles: string[] | undefined;

  protected async getInputFiles(): Promise<string[]> {
    if (this.cachedInputFiles) {
      return this.cachedInputFiles;
    }
    const result = await glob(
      this.config.dirs.map(
        (dir) =>
          `${resolve(
            this.config.workingDir,
            dir
          )}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`
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
    this.cachedInputFiles = result;
    return result;
  }

  private discoveredEntries: WeakMap<
    string[],
    {
      discoveredSteps: string[];
      discoveredWorkflows: string[];
    }
  > = new WeakMap();

  protected async discoverEntries(
    inputs: string[],
    outdir: string
  ): Promise<{
    discoveredSteps: string[];
    discoveredWorkflows: string[];
  }> {
    const previousResult = this.discoveredEntries.get(inputs);

    if (previousResult) {
      return previousResult;
    }
    const state: {
      discoveredSteps: string[];
      discoveredWorkflows: string[];
    } = {
      discoveredSteps: [],
      discoveredWorkflows: [],
    };

    try {
      await esbuild.build({
        treeShaking: true,
        entryPoints: inputs,
        plugins: [createDiscoverEntriesPlugin(state)],
        platform: 'node',
        write: false,
        outdir,
        bundle: true,
        absWorkingDir: this.config.workingDir,
        logLevel: 'silent',
      });
    } catch (_) {}

    this.discoveredEntries.set(inputs, state);
    return state;
  }

  protected async createStepsBundle({
    format = 'cjs',
    outfile,
    externalizeNonSteps,
  }: {
    outfile: string;
    format?: 'cjs' | 'esm';
    externalizeNonSteps?: boolean;
  }): Promise<void> {
    // These need to handle watching for dev to scan for
    // new entries and changes to existing ones
    const inputFiles = await this.getInputFiles();
    const { discoveredSteps: stepFiles } = await this.discoverEntries(
      inputFiles,
      dirname(outfile)
    );
    const builtInSteps = '@vercel/workflow-core/builtins';

    const resolvedBuiltInSteps = await enhancedResolve(
      dirname(outfile),
      '@vercel/workflow-core/builtins'
    );

    // Create a virtual entry that imports all files. All step definitions
    // will get registered thanks to the swc transform.
    const imports = stepFiles.map((file) => `import '${file}';`).join('\n');
    const entryContent = `
    // Built in steps
    import '${builtInSteps}';
    // User steps
    ${imports}
    // API entrypoint
    export { vercelAPIStepsEntrypoint as POST } from '@vercel/workflow-core/runtime';`;

    // Bundle with esbuild and our custom SWC plugin
    await esbuild.build({
      stdin: {
        contents: entryContent,
        resolveDir: this.config.workingDir,
        sourcefile: 'virtual-entry.js',
        loader: 'js',
      },
      outfile,
      absWorkingDir: this.config.workingDir,
      bundle: true,
      format,
      platform: 'node',
      conditions: ['workflow:step', 'node'],
      target: 'es2022',
      write: true,
      treeShaking: true,
      keepNames: true,
      minify: false,
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      sourcemap: true,
      plugins: [
        createSwcPlugin({
          mode: 'step',
          entriesToBundle: externalizeNonSteps
            ? [
                ...stepFiles,
                ...(resolvedBuiltInSteps ? [resolvedBuiltInSteps] : []),
              ]
            : undefined,
          outdir: outfile ? dirname(outfile) : undefined,
        }),
      ],
    });

    // write debug information to JSON file (maybe move to diagnostics folder)
    // if on Vercel
    try {
      await writeFile(
        `${outfile}.debug.json`,
        JSON.stringify(
          {
            stepFiles,
          },
          null,
          2
        )
      );
    } catch (error: unknown) {
      // Debug file write failure shouldn't break the build
      console.warn('Failed to write debug file:', error);
    }
  }

  protected async createWorkflowsBundle({
    format = 'cjs',
    outfile,
    bundleFinalOutput = true,
  }: {
    outfile: string;
    format?: 'cjs' | 'esm';
    bundleFinalOutput?: boolean;
  }): Promise<void> {
    const inputFiles = await this.getInputFiles();
    const { discoveredWorkflows: workflowFiles } = await this.discoverEntries(
      inputFiles,
      dirname(outfile)
    );

    // Create a virtual entry that imports all files
    const imports = workflowFiles
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
      absWorkingDir: this.config.workingDir,
      format: 'cjs', // Runs inside the VM which expects cjs
      platform: 'neutral', // The platform is neither node nor browser
      mainFields: ['module', 'main'], // To support npm style imports
      conditions: ['workflow'], // Allow packages to export 'workflow' compliant versions
      target: 'es2022',
      write: false,
      treeShaking: true,
      keepNames: true,
      minify: false,
      sourcemap: 'inline',
      external: [
        '@aws-sdk/credential-provider-web-identity',
        ...(this.config.externalPackages || []),
      ],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      plugins: [createSwcPlugin({ mode: 'workflow' })],
    });

    if (!interimBundle.outputFiles || interimBundle.outputFiles.length === 0) {
      throw new Error('No output files generated from esbuild');
    }

    const workflowBundleCode = interimBundle.outputFiles[0].text;

    // Create the workflow function handler
    const workflowFunctionCode = `import {
    vercelAPIWorkflowsEntrypoint } from '${
      // The runtime import path is configurable so that the Next.js loader
      // runtime path can be resolved. This is to avoid the user needing to
      // add @vercel/workflow-core as a dependency to their Next.js project.
      this.config.runtimeImportPath || '@vercel/workflow-core/runtime'
    }';

const workflowCode = \`${workflowBundleCode.replace(/[\\`$]/g, '\\$&')}\`;

export const POST = vercelAPIWorkflowsEntrypoint(workflowCode);`;

    // write debug information to JSON file (maybe move to diagnostics folder)
    // if on Vercel
    try {
      await writeFile(
        `${outfile}.debug.json`,
        JSON.stringify(
          {
            workflowFiles,
          },
          null,
          2
        )
      );
    } catch (error: unknown) {
      // Debug file write failure shouldn't break the build
      console.warn('Failed to write debug file:', error);
    }

    // we skip the final bundling step for Next.js so it can bundle itself
    if (!bundleFinalOutput) {
      if (!outfile) {
        throw new Error(`Invariant: missing outfile for workflow bundle`);
      }
      // Ensure the output directory exists
      const outputDir = dirname(outfile);
      await mkdir(outputDir, { recursive: true });

      await writeFile(outfile, workflowFunctionCode);
      return;
    }
    console.log('Creating final workflow bundle');

    // Now bundle this so we can resolve the @vercel/workflow-core dependency
    await esbuild.build({
      stdin: {
        contents: workflowFunctionCode,
        resolveDir: this.config.workingDir,
        sourcefile: 'virtual-entry.js',
        loader: 'js',
      },
      outfile,
      sourcemap: 'inline',
      absWorkingDir: this.config.workingDir,
      bundle: true,
      format,
      platform: 'node',
      target: 'es2022',
      write: true,
      keepNames: true,
      minify: false,
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

    // Ensure we have the directory for the client bundle
    const outputDir = dirname(this.config.clientBundlePath);
    await mkdir(outputDir, { recursive: true });

    const inputFiles = await this.getInputFiles();

    // Create a virtual entry that imports all files
    const imports = inputFiles
      .map((file) => `export * from '${file}';`)
      .join('\n');

    // Bundle with esbuild and our custom SWC plugin
    await esbuild.build({
      stdin: {
        contents: imports,
        resolveDir: this.config.workingDir,
        sourcefile: 'virtual-entry.js',
        loader: 'js',
      },
      outfile: this.config.clientBundlePath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2022',
      write: true,
      treeShaking: true,
      external: ['@vercel/workflow-core'],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      plugins: [createSwcPlugin({ mode: 'client' })],
    });
  }
}
