import { transform } from '@swc/core';
import { createRequire } from 'module';

const require = createRequire(import.meta.filename);

export async function applySwcTransform(
  filename: string,
  source: string,
  mode: 'workflow' | 'step' | 'client' | false,
  jscConfig?: {
    paths?: Record<string, string[]>;
    // this must be absolute path
    baseUrl?: string;
  }
): Promise<string> {
  // Determine if this is a TypeScript file
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const isTsx = filename.endsWith('.tsx');

  // Transform with SWC to support syntax esbuild doesn't
  const result = await transform(source, {
    filename,
    swcrc: false,
    jsc: {
      parser: {
        syntax: isTypeScript ? 'typescript' : 'ecmascript',
        tsx: isTsx,
      },
      target: 'es2022',
      experimental: mode
        ? {
            plugins: [
              [require.resolve('@vercel/swc-plugin-workflow'), { mode }],
            ],
          }
        : undefined,
      ...jscConfig,
    },
    // TODO: investigate proper source map support as they
    // won't even be used in Node.js by default unless we
    // intercept errors and apply them ourselves
    sourceMaps: false,
    minify: false,
  });

  return result.code;
}
