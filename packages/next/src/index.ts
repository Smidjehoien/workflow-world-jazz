import path from 'node:path';
import { NextBuilder } from '@vercel/workflow-cli/dist/lib/builders/next-build';
import type { NextConfig } from 'next';

export function withWorkflow(nextConfig: NextConfig) {
  // configure the loader if turbopack is being used
  if (!nextConfig.turbopack) {
    nextConfig.turbopack = {};
  }
  if (!nextConfig.turbopack.rules) {
    nextConfig.turbopack.rules = {};
  }
  const existingRules = nextConfig.turbopack.rules as any;

  nextConfig.turbopack.rules = {
    ...existingRules,
    '*.tsx': {
      loaders: [
        ...(existingRules['*.tsx']?.loaders || []),
        '@vercel/workflow-next/loader',
      ],
    },
    '*.ts': {
      loaders: [
        ...(existingRules['*.ts']?.loaders || []),
        '@vercel/workflow-next/loader',
      ],
    },
    '*.jsx': {
      loaders: [
        ...(existingRules['*.jsx']?.loaders || []),
        '@vercel/workflow-next/loader',
      ],
    },
    '*.js': {
      loaders: [
        ...(existingRules['*.js']?.loaders || []),
        '@vercel/workflow-next/loader',
      ],
    },
  };

  return async function buildConfig(phase: string) {
    const workflowBuilder = new NextBuilder({
      // Support both workflows and src/workflows folders
      dirs: ['workflows', 'src/workflows'],
      workingDir: process.cwd(),
      buildTarget: 'next',
      workflowsBundlePath: '',
      stepsBundlePath: '',
    });

    const { nativeNodeModuleImporters } = await workflowBuilder.build();

    // configure the loader for webpack
    const existingWebpackModify = nextConfig.webpack;
    nextConfig.webpack = (...args) => {
      const [webpackConfig] = args;
      if (!webpackConfig.module) {
        webpackConfig.module = {};
      }
      if (!webpackConfig.module.rules) {
        webpackConfig.module.rules = [];
      }
      // loaders in webpack apply bottom->up so ensure
      // ours comes before the default swc transform
      webpackConfig.module.rules.push({
        test: /.*\.(mjs|cjs|cts|ts|tsx|js|jsx)$/,
        loader: '@vercel/workflow-next/loader',
      });

      const origExternals = webpackConfig.externals;
      const absoluteDistPath = path.posix.join(
        __dirname,
        nextConfig.distDir || '.next',
        'server',
        'app',
        'api',
        'generated'
      );

      // if we detected native node modules we need to
      // mark them as external for webpack (turbopack doesn't support this)
      if (nativeNodeModuleImporters.length > 0) {
        webpackConfig.externals = [
          async ({ context, request }: any) => {
            const absoluteImport = path.posix.join(context, request);
            if (
              nativeNodeModuleImporters.some((item) =>
                absoluteImport.startsWith(item)
              )
            ) {
              return `commonjs ${path.posix.relative(
                absoluteDistPath,
                absoluteImport
              )}`;
            }
          },
          ...(Array.isArray(origExternals) ? origExternals : [origExternals]),
        ];
      }

      return existingWebpackModify
        ? existingWebpackModify(...args)
        : webpackConfig;
    };

    if (phase === 'phase-development-server') {
      // handle watching
    }

    return nextConfig;
  };
}
