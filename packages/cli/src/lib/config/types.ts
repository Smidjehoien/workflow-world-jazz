export const validBuildTargets = [
  'vercel-static',
  'vercel-build-output-api',
  'next',
] as const;
export type BuildTarget = (typeof validBuildTargets)[number];

export interface WorkflowConfig {
  dirs: string[];
  workingDir: string;
  runtimeImportPath?: string;
  buildTarget: BuildTarget;
  stepsBundlePath: string;
  workflowsBundlePath: string;

  // Optionally generate a client library for workflow execution. The preferred
  // method of using workflow is to use a loader within a framework (like
  // NextJS) that resolves client bindings on the fly.
  clientBundlePath?: string;

  externalPackages?: string[];
}

export function isValidBuildTarget(
  target: string | undefined
): target is BuildTarget {
  return target === 'vercel-static' || target === 'vercel-build-output-api';
}
