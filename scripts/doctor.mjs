#!/usr/bin/env node
// 用量统计自查：看看小精灵到底能读到哪些工具、读到多少。
// 用户反馈「我的 xxx 没统计到」时，让他跑这条命令把结果贴回来，
// 比来回猜快得多：npx token-sprite doctor（或 npm run doctor）
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { READERS, computeLocalUsage } from './usage.mjs';

const B = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' B' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' M' : String(n));

// Codex 允许用 CODEX_HOME 改数据目录；GUI 启动的 app 拿不到 shell 环境变量，
// 所以这里特意打印出来——用户设过的话，这就是没统计到的原因。
const CANDIDATES = [
  { label: 'Claude Code', dir: join(homedir(), '.claude', 'projects'), pattern: '.jsonl' },
  { label: 'Codex', dir: process.env.CODEX_HOME || join(homedir(), '.codex'), pattern: 'rollout-*.jsonl' },
  { label: 'Gemini CLI', dir: join(homedir(), '.gemini'), pattern: '.json / .jsonl' },
];

async function countFiles(dir, filter) {
  let n = 0, bytes = 0;
  async function walk(d) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (filter(e.name)) { n += 1; try { bytes += (await stat(full)).size; } catch {} }
    }
  }
  await walk(dir);
  return { n, bytes };
}

console.log('\n🌱 Token 小精灵 · 用量自查\n');

if (process.env.CODEX_HOME) {
  console.log(`⚠️  你设置了 CODEX_HOME=${process.env.CODEX_HOME}`);
  console.log('   桌宠是图形界面启动的，读不到终端里的环境变量，所以它只会去看 ~/.codex。');
  console.log('   如果你的 Codex 数据在别处，这就是没统计到的原因。\n');
}

for (const c of CANDIDATES) {
  const exists = await stat(c.dir).then(() => true).catch(() => false);
  if (!exists) { console.log(`—  ${c.label.padEnd(12)} 没找到目录 ${c.dir}`); continue; }
  const isCodex = c.label === 'Codex';
  const all = await countFiles(c.dir, (n) => n.endsWith('.jsonl') || n.endsWith('.json'));
  const matched = await countFiles(c.dir, (n) => (isCodex ? n.includes('rollout-') && n.endsWith('.jsonl') : n.endsWith('.jsonl') || n.endsWith('.json')));
  const mb = (b) => (b / 1048576).toFixed(0) + ' MB';
  console.log(`✅ ${c.label.padEnd(12)} ${c.dir}`);
  console.log(`   能识别的文件 ${matched.n} 个（${mb(matched.bytes)}）${all.n !== matched.n ? `，目录里另有 ${all.n - matched.n} 个不符合命名规则被跳过` : ''}`);
}

console.log('\n⏳ 正在统计（日志多的话要十几秒）…\n');
const usage = await computeLocalUsage();
if (!usage.breakdown.length) {
  console.log('❌ 一个工具都没读到用量。请把上面的目录信息贴给我们。');
} else {
  for (const b of usage.breakdown) {
    console.log(`   ${b.label.padEnd(14)} 累计 ${B(b.total).padStart(9)}   今日 ${B(b.todayTokens)}`);
  }
  console.log(`   ${'合计'.padEnd(13)} 累计 ${B(usage.total).padStart(9)}   今日 ${B(usage.todayTokens)}`);
}
const missing = READERS.filter((r) => !usage.breakdown.some((b) => b.source === r.source));
if (missing.length) {
  console.log(`\n   没读到的工具：${missing.map((m) => m.label).join('、')}（没装、或者数据不在默认位置）`);
}
console.log('\n💡 注意：桌宠里精灵的成长只算「装上之后」新产生的用量，装之前的历史不计入。');
console.log('   所以这里的累计数字会比精灵的成长进度大——那是正常的。\n');
