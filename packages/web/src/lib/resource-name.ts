/**
 * Takes a run/step name and returns a human readable name.
 * For now, while we're figuring out build manifest implementation,
 * this is just the name of the function (not unique to file/folder).
 */

export function getResourceName(name: string) {
  return name.split('-').pop() ?? name;
}
