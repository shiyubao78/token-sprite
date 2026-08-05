import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function verifyReleaseVersion(tag, packageVersion) {
  if (typeof tag !== 'string' || !tag.startsWith('v') || !VERSION_PATTERN.test(tag.slice(1))) {
    throw new Error(`发布标签格式错误：${tag || '(空)'}，应为 v1.2.3`);
  }
  const tagVersion = tag.slice(1);
  if (tagVersion !== packageVersion) {
    throw new Error(`发布标签 ${tag} 与 package.json 版本 ${packageVersion} 不一致`);
  }
  return tagVersion;
}

async function run() {
  const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const version = verifyReleaseVersion(process.env.GITHUB_REF_NAME, packageJson.version);
  console.log(`发布版本校验通过：${version}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
