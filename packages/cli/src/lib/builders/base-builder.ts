import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as esbuild from 'esbuild';
import { createRequire } from 'module';
import { glob } from 'tinyglobby';
import type { WorkflowConfig } from '../config/types.js';
import { createSwcPlugin } from './swc-esbuild-plugin.js';

const require = createRequire(import.meta.url);

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
  }

  protected async createStepsBundle({
    format = 'cjs',
    outfile,
  }: Pick<esbuild.BuildOptions, 'outfile' | 'format'>): Promise<void> {
    const inputFiles = await this.getInputFiles();

    // Create a virtual entry that imports all files. All step definitions
    // will get registered thanks to the swc transform.
    const imports = inputFiles.map((file) => `import '${file}';`).join('\n');
    const entryContent = `
    // Built in steps
    import '@vercel/workflow-core/builtins';
    // User steps
    ${imports}
    // API entrypoint
    export { vercelAPIStepsEntrypoint as POST } from '@vercel/workflow-core/runtime';`;

    // Bundle with esbuild and our custom SWC plugin
    const result = await esbuild.build({
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
      write: false,
      treeShaking: true,
      keepNames: true,
      minify: false,
      external: [
        '@aws-sdk/credential-provider-web-identity',
        ...(this.config.externalPackages || []),
      ],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      sourcemap: 'inline',
      plugins: [
        createSwcPlugin({
          mode: 'step',
        }),
      ],
    });

    if (outfile) {
      // Ensure the output directory exists
      const outputDir = dirname(outfile);
      await mkdir(outputDir, { recursive: true });

      // we need to make require usage from esbuild non-statically
      // analyzable so webpack doesn't break externals from
      // too dynamic of a require
      await writeFile(
        outfile,
        result.outputFiles[0].text.replace(
          /([\s;])require((?!:)[\s(])/g,
          '$1eval("require")$2'
        )
      );
    }
  }

  protected async createWorkflowsBundle({
    format = 'cjs',
    outfile,
    bundleFinalOutput = true,
  }: Pick<esbuild.BuildOptions, 'outfile' | 'format'> & {
    bundleFinalOutput?: boolean;
  }): Promise<void> {
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
      // we need to resolve here so it is absolute and
      // doesn't need to be a dependency of the Next.js project
      require.resolve('@vercel/workflow-core/runtime')
    }';

const workflowCode = \`${workflowBundleCode.replace(/[\\`$]/g, '\\$&')}\`;

export const POST = vercelAPIWorkflowsEntrypoint(workflowCode);`;

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
