#!/usr/bin/env node
// 重新生成「界面一览」中英两张图（README / 宣传用）。
// 改了界面文案（比如 bond.js 的等级说明）之后跑一次，图就跟上了。
//
// 前提：dev server 在跑（另开一个终端 npm run dev）
// 用法：npm run shots:overview
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'http://localhost:5173';

try {
  execFileSync('curl', ['-sf', '--noproxy', '*', '--max-time', '5', '-o', '/dev/null', URL]);
} catch {
  console.error(`❌ ${URL} 没响应。先在另一个终端跑：npm run dev`);
  process.exit(1);
}

const run = (args) => execFileSync('npx', ['electron', ...args], { cwd: ROOT, stdio: 'inherit' });

for (const [locale, out] of [['zh', 'interface-overview.png'], ['en', 'interface-overview-en.png']]) {
  const shots = mkdtempSync(path.join(tmpdir(), `ts-shots-${locale}-`));
  console.log(`\n📸 ${locale}：截面板…`);
  run([path.join(ROOT, 'scripts/capture-overview.cjs'), shots, locale]);
  console.log(`🧩 ${locale}：拼图…`);
  run([path.join(ROOT, 'scripts/compose-overview.cjs'), shots, path.join(ROOT, 'assets/readme', out), locale]);
}
console.log('\n✅ 两张界面一览已更新到 assets/readme/');
