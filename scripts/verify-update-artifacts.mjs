import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
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

// 解析 files: 下每一条的 url / sha512 / size，用来核对产物和描述是不是同一次构建的。
export function parseUpdateEntries(yamlText) {
  const entries = [];
  let cur = null;
  for (const line of yamlText.split('\n')) {
    const url = line.match(/^\s*-\s+url:\s+(.+?)\s*$/);
    if (url) {
      cur = { name: path.basename(decodeURIComponent(url[1].replace(/^['"]|['"]$/g, ''))) };
      entries.push(cur);
      continue;
    }
    if (!cur) continue;
    const sha = line.match(/^\s+sha512:\s+(.+?)\s*$/);
    if (sha) { cur.sha512 = sha[1].replace(/^['"]|['"]$/g, ''); continue; }
    const size = line.match(/^\s+size:\s+(\d+)\s*$/);
    if (size) { cur.size = Number(size[1]); continue; }
    if (/^\S/.test(line)) cur = null; // 回到顶层 key，files 段结束
  }
  return entries;
}

function realDigest(file) {
  return {
    sha512: createHash('sha512').update(readFileSync(file)).digest('base64'),
    size: statSync(file).size,
  };
}

export function verifyUpdateArtifacts(
  releaseDir,
  yamlText,
  artifactExists = (name) => existsSync(path.join(releaseDir, name)),
  digestOf = (name) => realDigest(path.join(releaseDir, name)),
) {
  const names = listedArtifactNames(yamlText);
  if (names.length === 0) throw new Error('latest-mac.yml 没有列出任何更新产物');
  const missing = names.filter((name) => !artifactExists(name));
  if (missing.length) throw new Error(`更新描述引用了不存在的产物：${missing.join(', ')}`);

  // 描述里的校验和必须和真实文件对得上，否则客户端下载完会校验失败、更新装不上。
  for (const entry of parseUpdateEntries(yamlText)) {
    if (!entry.sha512 && entry.size == null) continue;
    const real = digestOf(entry.name);
    if (entry.size != null && real.size !== entry.size) {
      throw new Error(`${entry.name} 大小对不上：描述写 ${entry.size}，实际 ${real.size}（描述和安装包不是同一次构建）`);
    }
    if (entry.sha512 && real.sha512 !== entry.sha512) {
      throw new Error(`${entry.name} 校验和对不上（描述和安装包不是同一次构建，客户端会更新失败）`);
    }
  }
  return names;
}

function run() {
  const releaseDir = path.resolve(process.argv[2] || 'release');
  const yamlText = readFileSync(path.join(releaseDir, 'latest-mac.yml'), 'utf8');
  const names = verifyUpdateArtifacts(releaseDir, yamlText);
  console.log(`更新产物校验通过（含校验和）：${names.join(', ')}`);
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
