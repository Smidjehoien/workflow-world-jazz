import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chokidar from 'chokidar';
import { escapePath, glob, isDynamicPattern } from 'tinyglobby';

// This is the equivalent of __dirname in a node module
const sourceDir = fileURLToPath(new URL('.', import.meta.url));
const vercelEntryPoints = [join(sourceDir, 'entrypoints', 'vercelAPIRoute.js')];

type EntryPointManager = {
  entryPoints: string[];
  patterns: string[];
  ignorePatterns: string[];
  watcher?: chokidar.FSWatcher;
  stop: () => Promise<void>;
};

const DEFAULT_IGNORE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.mts',
  '**/*.test.cts',
  '**/*.test.js',
  '**/*.test.mjs',
  '**/*.test.cjs',
  '**/*.spec.ts',
  '**/*.spec.mts',
  '**/*.spec.cts',
  '**/*.spec.js',
  '**/*.spec.mjs',
  '**/*.spec.cjs',
];

export async function createEntryPointManager(
  dirs: string[],
  config: /* @trigger.dev/core/v3/build ResolvedConfig */ any,
  target: /* @trigger.dev/core/v3 BuildTarget */ any,
  watch: boolean,
  onEntryPointsChange?: (entryPoints: string[]) => Promise<void>
): Promise<EntryPointManager> {
  // Patterns to match files
  const patterns = dirs.flatMap((dir) => [
    `${
      isDynamicPattern(dir)
        ? `${dir}/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`
        : `${escapePath(dir)}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`
    }`,
  ]);

  // Patterns to ignore
  let ignorePatterns = config.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS;
  ignorePatterns = ignorePatterns.concat([
    '**/node_modules/**',
    '**/.git/**',
    '**/.next/**',
  ]);

  async function getEntryPoints() {
    // Get initial entry points
    const entryPoints = await glob(patterns, {
      ignore: ignorePatterns,
      absolute: false,
      cwd: config.workingDir,
    });

    if (entryPoints.length === 0) {
      return [];
    }

    // Add required entry points
    if (config.configFile) {
      entryPoints.push(config.configFile);
    }

    switch (target) {
      case 'vercel': {
        entryPoints.push(...vercelEntryPoints);
        break;
      }
      // Support other deploy targets (ex: build output API / nextjs / vite)
      default: {
        entryPoints.push(...vercelEntryPoints);
      }
    }

    // Sort to ensure consistent comparison
    return entryPoints.sort();
  }

  const initialEntryPoints = await getEntryPoints();

  console.debug('Initial entry points', {
    entryPoints: initialEntryPoints,
    patterns,
    cwd: config.workingDir,
  });

  let currentEntryPoints = initialEntryPoints;

  // Only setup watcher if watch is true
  let watcher: chokidar.FSWatcher | undefined;

  if (watch && onEntryPointsChange) {
    console.debug('Watching entry points for changes', {
      dirs,
      cwd: config.workingDir,
      patterns,
      ignorePatterns,
    });
    // Watch the parent directories
    watcher = chokidar.watch(patterns, {
      ignored: ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      // useFsEvents: false,
    });

    // Handle file changes
    const updateEntryPoints = async (event: string, path: string) => {
      console.debug('Entry point change detected', { event, path });

      const newEntryPoints = await getEntryPoints();

      // Compare arrays to see if they're different
      const hasChanged =
        newEntryPoints.length !== currentEntryPoints.length ||
        newEntryPoints.some(
          (entry, index) => entry !== currentEntryPoints[index]
        );

      if (hasChanged) {
        console.debug('Entry points changed', {
          old: currentEntryPoints,
          new: newEntryPoints,
        });
        currentEntryPoints = newEntryPoints;
        await onEntryPointsChange(newEntryPoints);
      }
    };

    watcher
      .on('add', (path) => updateEntryPoints('add', path))
      .on('addDir', (path) => updateEntryPoints('addDir', path))
      .on('unlink', (path) => updateEntryPoints('unlink', path))
      .on('unlinkDir', (path) => updateEntryPoints('unlinkDir', path))
      .on('error', (error) => console.error('Watcher error:', error));
  }

  return {
    entryPoints: initialEntryPoints,
    watcher,
    patterns,
    ignorePatterns,
    stop: async () => {
      await watcher?.close();
    },
  };
}
