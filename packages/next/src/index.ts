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
  // biome-ignore lint/suspicious/noExplicitAny: we need to ignore deprecated type or handle it
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

    return existingWebpackModify
      ? existingWebpackModify(...args)
      : webpackConfig;
  };

  return async function buildConfig(phase: string) {
    const workflowBuilder = new NextBuilder({
      dirs: ['workflows'],
      workingDir: process.cwd(),
      buildTarget: 'next',
      workflowsBundlePath: '',
      stepsBundlePath: '',
    });

    await workflowBuilder.build();

    if (phase === 'phase-development-server') {
      // handle watching
    }

    return nextConfig;
  };
}
