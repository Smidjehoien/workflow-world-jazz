import { transformSync } from '@swc/core';

// This loader applies the "use workflow"/"use step"
// client transformation
export default function workflowLoader(
  this: {
    resourcePath: string;
  },
  source: string | Buffer,
  // biome-ignore lint/suspicious/noExplicitAny: sourcemap type
  sourceMap: any
): string {
  const filename = this.resourcePath;
  const normalizedSource = source.toString();

  // only apply the transform if file needs it
  if (!normalizedSource.match(/(use step|use workflow)/)) {
    return normalizedSource;
  }

  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  const isTsx = filename.endsWith('.tsx');

  // Transform with SWC
  const result = transformSync(normalizedSource, {
    filename,
    jsc: {
      parser: {
        syntax: isTypeScript ? 'typescript' : 'ecmascript',
        tsx: isTsx,
      },
      target: 'es2022',
      experimental: {
        plugins: [
          [require.resolve('@vercel/swc-plugin-workflow'), { mode: 'client' }],
        ],
      },
    },
    minify: false,
    inputSourceMap: sourceMap,
    sourceMaps: true,
    inlineSourcesContent: true,
  });

  return result.code;
}
