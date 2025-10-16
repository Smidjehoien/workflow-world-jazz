/**
 * Parse a machine readable name.
 *
 * @see {@link ../../swc-plugin-workflow/transform/src/naming.rs} for the naming scheme.
 */
function parseName(
  tag: string,
  name: string
): null | { path: string; functionName: string } {
  const [prefix, path, ...functionNameParts] = name.split('//');
  if (prefix !== tag || !path || functionNameParts.length === 0) {
    return null;
  }

  return { path, functionName: functionNameParts.join('//') };
}

/**
 * Parse a workflow name into its components.
 *
 * @param name - The workflow name to parse.
 * @returns An object with `path` and `functionName` properties, or `null` if the name is invalid.
 */
export function parseWorkflowName(name: string) {
  return parseName('workflow', name);
}

/**
 * Parse a step name into its components.
 *
 * @param name - The step name to parse.
 * @returns An object with `path` and `functionName` properties, or `null` if the name is invalid.
 */
export function parseStepName(name: string) {
  return parseName('step', name);
}
