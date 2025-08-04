import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transformSync } from '@swc/core';
import type { Plugin } from 'esbuild';

const require = createRequire(import.meta.url);

export interface SwcPluginOptions {
  mode: 'step' | 'workflow' | 'client';
}

export function createSwcPlugin(options: SwcPluginOptions): Plugin {
  return {
    name: 'swc-workflow-plugin',
    setup(build) {
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
