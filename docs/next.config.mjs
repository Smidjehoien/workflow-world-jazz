import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    '@vercel/geist',
    '@vercel/geist-test-utils',
    '@vercel/trace-viewer',
    '@vercel/next-themes',
  ],
  modularizeImports: {
    '@vercel/geist/components': {
      transform: '@vercel/geist/components/{{ kebabCase member }}',
      skipDefaultConversion: true,
    },
    '@vercel/geist/icons': {
      transform: '@vercel/geist/icons/{{ kebabCase member }}',
      skipDefaultConversion: true,
    },
    '@vercel/geist/logos': {
      transform: '@vercel/geist/logos/{{ kebabCase member }}',
      skipDefaultConversion: true,
    },
    'geist/core': {
      transform: '@vercel/geist/core',
      skipDefaultConversion: true,
    },
    'geist/icons': {
      transform: '@vercel/geist/icons/{{ kebabCase member }}',
      skipDefaultConversion: true,
    },
  },
  experimental: {
    optimizePackageImports: ['@vercel/geist', '@vercel/geist-test-utils'],
  },
  redirects: () => {
    return [
      {
        source: '/docs',
        destination: '/docs/introduction',
        permanent: true,
      },
      {
        source: '/err/:slug',
        destination: '/docs/troubleshooting/errors/:slug',
        permanent: true,
      },
    ];
  },
};

export default withMDX(config);
