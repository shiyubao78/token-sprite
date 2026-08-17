#!/usr/bin/env node
// 每天自动抓一次运营数据（macOS launchd）。
// 装：npm run ops:auto        卸：npm run ops:auto -- off        看状态：npm run ops:auto -- status
//
// 为什么需要它：GitHub 的浏览/clone 数据只保留 14 天，不定期抓就永久丢了。
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LABEL = 'com.tokensprite.ops';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const HOUR = Number(process.env.OPS_HOUR ?? 12); // 每天几点抓

const mode = process.argv[2] || 'on';

async function which(cmd) {
  try { return (await exec('which', [cmd])).stdout.trim(); } catch { return ''; }
}

async function buildPlist() {
  const ghPath = await which('gh');
  if (!ghPath) throw new Error('没找到 gh 命令，先装 GitHub CLI：brew install gh');

  // launchd 的 PATH 很干净，得把 node 和 gh 所在目录显式喂给它
  const dirs = [...new Set([path.dirname(process.execPath), path.dirname(ghPath), '/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'])];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${path.join(ROOT, 'scripts', 'ops-dashboard.mjs')}</string>
    <string>--no-open</string>
  </array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>${dirs.join(':')}</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>${HOUR}</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>${path.join(ROOT, 'ops-data', 'autorun.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(ROOT, 'ops-data', 'autorun.log')}</string>
  <key>RunAtLoad</key><false/>
</dict></plist>
`;
}

async function unload() {
  await exec('launchctl', ['bootout', `gui/${process.getuid()}/${LABEL}`]).catch(() => {});
  await exec('launchctl', ['unload', PLIST]).catch(() => {});
}

async function on() {
  await fs.mkdir(path.join(ROOT, 'ops-data'), { recursive: true });
  await fs.mkdir(path.dirname(PLIST), { recursive: true });
  await fs.writeFile(PLIST, await buildPlist());
  await unload();
  await exec('launchctl', ['bootstrap', `gui/${process.getuid()}`, PLIST]);
  console.log(`✅ 已开启自动抓数：每天 ${HOUR}:00 后台跑一次（电脑睡着就等醒来补跑）`);
  console.log(`   任务文件：${PLIST}`);
  console.log(`   运行日志：ops-data/autorun.log`);
  console.log(`   关掉它：npm run ops:auto -- off`);
}

async function off() {
  await unload();
  await fs.rm(PLIST, { force: true });
  console.log('✅ 已关闭自动抓数，任务文件已删除。手动跑还是 npm run ops');
}

async function status() {
  const exists = await fs.access(PLIST).then(() => true).catch(() => false);
  if (!exists) return console.log('⚪️ 自动抓数：未开启（npm run ops:auto 开启）');
  const { stdout } = await exec('launchctl', ['list']).catch(() => ({ stdout: '' }));
  const running = stdout.split('\n').find((l) => l.includes(LABEL));
  console.log(running ? `🟢 自动抓数：已开启，每天 ${HOUR}:00\n   ${running.trim()}` : '🟡 任务文件在，但没被 launchd 加载。重装一下：npm run ops:auto');
}

const actions = { on, off, status };
(actions[mode] || on)().catch((e) => {
  console.error('❌ ' + (e.message || e));
  process.exit(1);
});
