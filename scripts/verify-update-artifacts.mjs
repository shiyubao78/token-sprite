import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function listedArtifactNames(yamlText) {
  const names = [];
  for (const match of yamlText.matchAll(/^\s*(?:-\s+url|path):\s+(.+?)\s*$/gm)) {
    const value = match[1].replace(/^['"]|['"]$/g, '');
    const name = path.basename(decodeURIComponent(value));
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function verifyUpdateArtifacts(
  releaseDir,
  yamlText,
  artifactExists = (name) => existsSync(path.join(releaseDir, name)),
) {
  const names = listedArtifactNames(yamlText);
  if (names.length === 0) throw new Error('latest-mac.yml 没有列出任何更新产物');
  const missing = names.filter((name) => !artifactExists(name));
  if (missing.length) throw new Error(`更新描述引用了不存在的产物：${missing.join(', ')}`);
  return names;
}

function run() {
  const releaseDir = path.resolve(process.argv[2] || 'release');
  const yamlText = readFileSync(path.join(releaseDir, 'latest-mac.yml'), 'utf8');
  const names = verifyUpdateArtifacts(releaseDir, yamlText);
  console.log(`更新产物校验通过：${names.join(', ')}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
