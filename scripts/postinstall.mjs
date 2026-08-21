#!/usr/bin/env node
// npm install 跑完后自动把桌宠重装一遍（仅限「已经装过、这次是更新」的情况）。
// 判断逻辑在 auto-install.mjs，这里只负责执行。
// 无论如何都以 0 退出——自动安装失败不该让 npm install 整个失败。
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldAutoInstall, messageFor } from './auto-install.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = '/Applications/Token小精灵.app';

const { run, reason } = shouldAutoInstall({
  platform: process.platform,
  env: process.env,
  appInstalled: existsSync(APP),
});

const msg = messageFor(reason);
if (msg) console.log(msg);
if (!run) process.exit(0);

try {
  execFileSync('npm', ['run', 'install:local'], { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.log('\n⚠️  自动重装没成。手动跑一下就行：npm run install:local');
  console.log('   （依赖已经装好了，不影响开发）\n');
}
process.exit(0);
