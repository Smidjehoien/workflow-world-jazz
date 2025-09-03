import { transform } from '@swc/core';
import { createRequire } from 'module';

const require = createRequire(import.meta.filename);

export async function applySwcTransform(
  filename: string,
  source: string,
  mode: 'workflow' | 'step' | 'client' | false
): Promise<string> {
  // Determine if this is a TypeScript file
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const isTsx = filename.endsWith('.tsx');

  // Transform with SWC to support syntax esbuild doesn't
  const result = await transform(source, {
    filename,
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
    },
    sourceMaps: 'inline',
    minify: false,
  });

  return result.code;
}
