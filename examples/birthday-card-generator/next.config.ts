import { withWorkflow } from '@vercel/workflow/next';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default withWorkflow(nextConfig);
