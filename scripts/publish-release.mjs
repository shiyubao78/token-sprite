#!/usr/bin/env node
// 发布 macOS 版本：把这一版该传的文件一次传齐，少一个都不让发。
//
// 起因：v0.4.2 手动发布时漏传了 latest-mac.yml，老用户的自动更新整整断了一周。
// 所以这里把「哪些文件必须传」写死，并核对校验和，靠脚本记，不靠人记。
//
// 看要传什么（不会真发）：npm run release:mac
// 真的发布：              npm run release:mac -- --yes
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyUpdateArtifacts } from './verify-update-artifacts.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE = path.join(ROOT, 'release');
const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const tag = `v${version}`;
const go = process.argv.includes('--yes');

// 本机代理转 github.com 会断，一律绕过
function gh(args, quiet = false) {
  const env = { ...process.env };
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];
  return execFileSync('gh', args, { env, cwd: ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
}

const base = `token-sprite-${version}-universal-mac`;
const required = [
  `${base}.dmg`,
  `${base}.zip`,
  `${base}.dmg.blockmap`,
  `${base}.zip.blockmap`,
  'latest-mac.yml',   // ← 少了它，所有老用户都收不到这一版
];

const missing = required.filter((f) => !existsSync(path.join(RELEASE, f)));
if (missing.length) {
  console.error(`❌ release/ 里缺这些文件：\n   ${missing.join('\n   ')}\n\n   先跑：npm run pack:mac:release`);
  process.exit(1);
}

// 描述和安装包必须是同一次构建，否则客户端下完校验失败、更新装不上
try {
  verifyUpdateArtifacts(RELEASE, readFileSync(path.join(RELEASE, 'latest-mac.yml'), 'utf8'));
} catch (e) {
  console.error(`❌ 更新描述和安装包对不上：${e.message}\n   重新跑一次 npm run pack:mac:release 让两者同源。`);
  process.exit(1);
}

let exists = true;
try { gh(['release', 'view', tag], true); } catch { exists = false; }

console.log(`\n📦 ${tag}${exists ? '（已存在，补传/覆盖同名文件）' : '（新建 Release）'}`);
for (const f of required) console.log(`   ✓ ${f}`);

if (!go) {
  console.log(`\n👀 这只是预演，没有真发。确认没问题就跑：\n   npm run release:mac -- --yes\n`);
  process.exit(0);
}

const files = required.map((f) => path.join(RELEASE, f));
if (exists) {
  gh(['release', 'upload', tag, ...files, '--clobber']);
} else {
  gh(['release', 'create', tag, ...files, '--title', `Token 小精灵 / Token Sprite ${tag}`, '--generate-notes']);
}

// 发完立刻按客户端的方式回验一次，确认更新链路真的通了
const url = `https://github.com/shiyubao78/token-sprite/releases/download/${tag}/latest-mac.yml`;
const got = execFileSync('curl', ['-sL', '--noproxy', '*', '--max-time', '60', url], { encoding: 'utf8' });
if (!got.includes(`version: ${version}`)) {
  console.error(`\n⚠️  发布完成，但按客户端的地址拉 latest-mac.yml 没拿到 ${version}。手动确认一下：\n   ${url}`);
  process.exit(1);
}
console.log(`\n✅ ${tag} 发布完成，自动更新链路已回验通过（客户端能拉到 latest-mac.yml）`);
