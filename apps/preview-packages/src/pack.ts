import cp from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(cp.exec);

interface TurboDryRun {
  packages: Array<string>;
  tasks: Array<Task>;
}

interface Task {
  taskId: string;
  task: string;
  package: string;
  hash: string;
  command: string;
  outputs: Array<string>;
  logFile: string;
  directory: string;
  dependencies: Array<string>;
  dependents: Array<string>;
}

const rootDir = fileURLToPath(new URL('../../../', import.meta.url));
const outDir = fileURLToPath(new URL('../public', import.meta.url));

async function main() {
  const sha = await getSha();

  const { stdout: turboStdout } = await exec('turbo run build --dry-run=json', {
    cwd: new URL('../', import.meta.url),
  });
  const turboJson: TurboDryRun = JSON.parse(turboStdout);
  for (const task of turboJson.tasks) {
    const dir = path.join(rootDir, task.directory);
    const packageJsonPath = path.join(dir, 'package.json');
    const originalPackageJson = await fs.readFile(packageJsonPath, 'utf8');
    const originalPackageObj = JSON.parse(originalPackageJson);
    if (originalPackageObj.private) continue;
    const packageObj = await fs
      .readFile(packageJsonPath, 'utf8')
      .then((x) => JSON.parse(x));
    packageObj.version += `-${sha.trim()}`;

    if (task.dependencies.length > 0) {
      for (const dependency of task.dependencies) {
        const name = dependency.split('#')[0];
        const escapedName = name.replace(/^@(.+)\//, '$1-');
        const tarballUrl = `https://${process.env.VERCEL_URL}/${escapedName}.tgz`;
        if (packageObj.dependencies && name in packageObj.dependencies) {
          packageObj.dependencies[name] = tarballUrl;
        }
        if (packageObj.devDependencies && name in packageObj.devDependencies) {
          packageObj.devDependencies[name] = tarballUrl;
        }
      }
    }
    await fs.writeFile(packageJsonPath, JSON.stringify(packageObj, null, 2));

    await exec(`pnpm pack --out="${outDir}/%s.tgz"`, {
      cwd: dir,
    });
    await fs.writeFile(packageJsonPath, originalPackageJson);
  }
}

async function getSha(): Promise<string> {
  try {
    const { stdout } = await exec('git rev-parse --short HEAD', {
      cwd: rootDir,
    });
    return stdout;
  } catch (error) {
    console.error(error);

    console.log('Assuming this is not a git repo. Using "local" as the SHA.');
    return 'local';
  }
}

main().catch((err) => {
  console.log('error running pack:', err);
  process.exit(1);
});
