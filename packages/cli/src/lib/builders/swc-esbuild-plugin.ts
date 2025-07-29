import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { transformSync } from '@swc/core';
import type { Plugin } from 'esbuild';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export interface SwcPluginOptions {
  mode: 'step' | 'workflow' | 'client';
}

export const nativeNodeModuleImporters = new Set<string>();

const isUnderNativeNodeModuleImpoters = (resolvedImport: string) => {
  const isUnder = [...nativeNodeModuleImporters].some((item) =>
    resolvedImport.startsWith(item)
  );
  return isUnder;
};

const getAbsoluteImport = (request: string, importer: string) => {
  if (request.startsWith('.')) {
    return path.join(path.dirname(importer), request);
  }
  try {
    return require.resolve(request, { paths: [path.dirname(importer)] });
  } catch {
    return request;
  }
};

export function createSwcPlugin(options: SwcPluginOptions): Plugin {
  return {
    name: 'swc-workflow-plugin',
    setup(build) {
      // traverse from app/api/generated/step -> .next/server/app/api/generated
      const outputDir = path.dirname(build.initialOptions.outfile || '');

      const relativeToOutput = (absoluteImport: string) => {
        if (path.isAbsolute(absoluteImport)) {
          return path.relative(outputDir, absoluteImport);
        }
        return absoluteImport;
      };

      build.onResolve({ filter: /\.node$/ }, (args) => {
        const absoluteImport = getAbsoluteImport(args.path, args.importer);

        if (isUnderNativeNodeModuleImpoters(absoluteImport)) {
          return {
            path: relativeToOutput(absoluteImport),
            external: true,
          };
        }

        if (args.importer) {
          nativeNodeModuleImporters.add(path.dirname(args.importer));
          return {
            path: relativeToOutput(absoluteImport),
            external: true,
          };
        }
        return null;
      });

      build.onResolve({ filter: /.*/ }, async (args) => {
        const absoluteImport = getAbsoluteImport(args.path, args.importer);

        if (isUnderNativeNodeModuleImpoters(absoluteImport)) {
          return { path: relativeToOutput(absoluteImport), external: true };
        }
        return null;
      });

      // handle non-existing .node files
      build.onLoad({ filter: /\.node$/ }, async () => {
        return {
          contents: '',
          loader: 'binary',
        };
      });

      // Handle TypeScript and JavaScript files
      build.onLoad({ filter: /\.(ts|tsx|js|jsx|mjs|cjs)$/ }, async (args) => {
        // Read the file content
        const source = await readFile(args.path, 'utf8');

        // Determine if this is a TypeScript file
        const isTypeScript =
          args.path.endsWith('.ts') || args.path.endsWith('.tsx');
        const isTsx = args.path.endsWith('.tsx');

        try {
          // Transform with SWC
          const result = transformSync(source, {
            filename: args.path,
            jsc: {
              parser: {
                syntax: isTypeScript ? 'typescript' : 'ecmascript',
                tsx: isTsx,
              },
              target: 'es2022',
              experimental: {
                plugins: [
                  [
                    require.resolve('@vercel/swc-plugin-workflow'),
                    { mode: options.mode },
                  ],
                ],
              },
            },
            minify: false,
          });

          // Determine the loader based on the output
          let loader: 'js' | 'jsx' = 'js';
          if (!isTypeScript && args.path.endsWith('.jsx')) {
            loader = 'jsx';
          }

          return {
            contents: result.code,
            loader,
          };
        } catch (error) {
          return {
            errors: [
              {
                text: error instanceof Error ? error.message : String(error),
                location: null,
              },
            ],
          };
        }
      });
    },
  };
}
