#!/usr/bin/env node
import multi from '@rollup/plugin-multi-entry';
import swc from '@rollup/plugin-swc';
import { rollup } from 'rollup';
import { createEntryPointManager } from './entrypoints.js';
// TODO: resolve local config
const resolvedConfig = {
    dirs: ['./workflows'],
    workingDir: process.cwd(),
    outputPath: './api/generated/workflow.js',
};
// TODO: This entry point detection logic can probably move into a rollup plugin
const entryPointManager = await createEntryPointManager(resolvedConfig.dirs, resolvedConfig, 'vercel', // target
false, // watch
async (newEntryPoints) => {
    console.log('newEntryPoints', newEntryPoints);
    // Rebuild with new entry points
    // note: we can perhaps get rid of all this by moving it into a
    // rollup(/vite?) plugin and taking advantage of rollups built in watch
    // support?
});
if (entryPointManager.entryPoints.length === 0) {
    const errorMessageBody = `
    !! No workflow files found !!
    
    Looking for workflows in:
    ${resolvedConfig.dirs.join('\n- ')}

    Search patterns:
    ${entryPointManager.patterns.join('\n- ')}
  `.replace(/^ {6}/gm, '');
    console.error(errorMessageBody);
    process.exit(1);
}
console.log('Creating Vercel API route at', resolvedConfig.outputPath);
const bundle = await rollup({
    input: entryPointManager.entryPoints,
    // TODO: use typescript plugin to support user tsconfig
    plugins: [
        // @ts-expect-error - default export is a function
        multi(),
        // @ts-expect-error - default export is a function
        swc({
            swc: {
                jsc: {
                    experimental: {
                        plugins: [['swc-plugin-workflow', {}]],
                    },
                },
            },
        }),
    ],
});
// Or use `bundle.generate` to keep the bundle in memory for use in a vite
// plugin/nextjs plugin for instance
await bundle.write({
    file: resolvedConfig.outputPath,
    format: 'esm',
});
//# sourceMappingURL=index.js.map