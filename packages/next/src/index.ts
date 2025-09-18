import { NextBuilder } from '@vercel/workflow-cli/dist/lib/builders/next-build';
import type { NextConfig } from 'next';

export function withWorkflow({
  workflows,
  ...nextConfig
}: NextConfig & {
  workflows?: {
    embedded?: {
      port?: number;
      dataDir?: string;
    };
  };
}) {
  workflows ||= {};
  workflows.embedded ||= {};
  workflows.embedded.dataDir = '.next/workflow-data';
  if (
    // don't use embedded if deploying on Vercel
    !process.env.VERCEL_DEPLOYMENT_ID
  ) {
    process.env.WORKFLOW_USE_EMBEDDED_WORLD = '1';
    process.env.WORKFLOW_EMBEDDED_WORLD_CONFIG = JSON.stringify(
      workflows.embedded
    );
  }

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
    // only run this in the main process so it only runs once
    // as Next.js uses child processes for different builds
    if (
      typeof process.send !== 'function' &&
      phase !== 'phase-production-server'
    ) {
      const shouldWatch = process.env.NODE_ENV === 'development';
      const workflowBuilder = new NextBuilder({
        watch: shouldWatch,
        // discover workflows from pages/app entries
        dirs: ['pages', 'app', 'src/pages', 'src/app'],
        workingDir: process.cwd(),
        buildTarget: 'next',
        workflowsBundlePath: '',
        stepsBundlePath: '',
        externalPackages: [
          ...require('next/dist/lib/server-external-packages.json'),
          ...(nextConfig.serverExternalPackages || []),
        ],
        runtimeImportPath: '@vercel/workflow-next/runtime',
      });

      await workflowBuilder.build();
    }

    // If we are doing a production build unset the embedded env
    // since we don't want to trigger port detection which will fail
    // during a build since no server is running
    if (phase === 'phase-production-build') {
      delete process.env.WORKFLOW_USE_EMBEDDED_WORLD;
      delete process.env.WORKFLOW_EMBEDDED_WORLD_CONFIG;
    }

    return nextConfig;
  };
}
