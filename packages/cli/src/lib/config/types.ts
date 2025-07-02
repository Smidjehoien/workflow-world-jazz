export const validBuildTargets = [
  'vercel-static',
  'vercel-build-output-api',
] as const;
export type BuildTarget = (typeof validBuildTargets)[number];

export interface WorkflowConfig {
  dirs: string[];
  workingDir: string;
  buildTarget: BuildTarget;
  stepsBundlePath: string;
  workflowBundle: string;
  clientBundlePath: string;
  buildOutputDir: string;
}

export interface InputEntrypoints {
  include: string[];
  exclude: string[];
}

export function isValidBuildTarget(
  target: string | undefined
): target is BuildTarget {
  return target === 'vercel-static' || target === 'vercel-build-output-api';
}
