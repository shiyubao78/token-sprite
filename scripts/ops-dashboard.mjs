#!/usr/bin/env node
// 运营看板：抓 GitHub 上的真实数据 → 存进本地历史 → 生成一张网页。
// GitHub 的流量数据（浏览/clone）只保留 14 天，所以每天跑一次才能攒出长期趋势。
// 用法：npm run ops        （抓数 + 生成 + 打开）
//       npm run ops -- --no-open
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDashboard } from './ops-render.mjs';

const exec = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'ops-data');
const HISTORY = path.join(DATA_DIR, 'history.json');
const OUT_HTML = path.join(DATA_DIR, 'dashboard.html');
const REPO = process.env.OPS_REPO || 'shiyubao78/token-sprite';

const today = () => new Date().toISOString().slice(0, 10);

// 本机代理转 github.com 会断，这里一律绕过代理（api.github.com 直连没问题）。
function cleanEnv() {
  const e = { ...process.env };
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete e[k];
  return e;
}

async function gh(endpoint, paginate = false) {
  const args = ['api', endpoint, ...(paginate ? ['--paginate'] : [])];
  const { stdout } = await exec('gh', args, { env: cleanEnv(), maxBuffer: 32 * 1024 * 1024 });
  // --paginate 会把多页 JSON 数组拼接输出，这里统一成一个数组
  if (paginate) {
    const parts = stdout.replace(/\]\s*\[/g, ',').trim();
    return JSON.parse(parts || '[]');
  }
  return JSON.parse(stdout);
}

async function readHistory() {
  try { return JSON.parse(await fs.readFile(HISTORY, 'utf8')); } catch { return { days: {}, snapshots: [] }; }
}

// 抓一轮数据。traffic 需要仓库 push 权限，没权限就降级（只少了浏览/clone）。
async function collect() {
  const repo = await gh(`repos/${REPO}`);
  const releases = await gh(`repos/${REPO}/releases?per_page=100`, true);

  let clones = null, views = null, referrers = [], paths = [];
  try {
    [clones, views, referrers, paths] = await Promise.all([
      gh(`repos/${REPO}/traffic/clones`),
      gh(`repos/${REPO}/traffic/views`),
      gh(`repos/${REPO}/traffic/popular/referrers`),
      gh(`repos/${REPO}/traffic/popular/paths`),
    ]);
  } catch {
    console.warn('⚠️  拿不到流量数据（需要仓库 push 权限），本次只统计下载和 star。');
  }

  return { repo, releases, clones, views, referrers, paths };
}

// 把这轮数据并进历史：按天覆盖（同一天以最新一次抓到的为准），老日子原样保留。
function merge(history, raw) {
  const h = { days: { ...history.days }, snapshots: [...(history.snapshots || [])] };

  for (const d of raw.clones?.clones || []) {
    const k = d.timestamp.slice(0, 10);
    h.days[k] = { ...h.days[k], clones: d.count, cloneUniques: d.uniques };
  }
  for (const d of raw.views?.views || []) {
    const k = d.timestamp.slice(0, 10);
    h.days[k] = { ...h.days[k], views: d.count, viewUniques: d.uniques };
  }

  const totalDownloads = raw.releases.reduce(
    (s, r) => s + (r.assets || []).reduce((a, x) => a + (x.download_count || 0), 0), 0);

  const snap = {
    date: today(),
    at: new Date().toISOString(),
    stars: raw.repo.stargazers_count,
    forks: raw.repo.forks_count,
    watchers: raw.repo.subscribers_count,
    issues: raw.repo.open_issues_count,
    totalDownloads,
  };
  h.snapshots = h.snapshots.filter((s) => s.date !== snap.date).concat(snap);
  h.snapshots.sort((a, b) => a.date.localeCompare(b.date));
  return h;
}

async function main() {
  const raw = await collect();
  const history = merge(await readHistory(), raw);

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(HISTORY, JSON.stringify(history, null, 2));
  await fs.writeFile(OUT_HTML, renderDashboard({ raw, history, repo: REPO }));

  const s = history.snapshots.at(-1);
  console.log(`✅ 看板已更新：${OUT_HTML}`);
  console.log(`   ⭐ ${s.stars} star · 📦 累计下载 ${s.totalDownloads} 次 · 📅 已攒 ${Object.keys(history.days).length} 天流量记录`);

  if (!process.argv.includes('--no-open') && process.platform === 'darwin') {
    await exec('open', [OUT_HTML]).catch(() => {});
  }
}

main().catch((err) => {
  const msg = String(err.stderr || err.message || err);
  if (/gh: command not found|ENOENT/.test(msg)) {
    console.error('❌ 没找到 gh 命令。先装 GitHub CLI：brew install gh，然后 gh auth login');
  } else if (/auth|401|403/i.test(msg)) {
    console.error('❌ GitHub 没登录或权限不足。跑一下：gh auth login');
  } else {
    console.error('❌ 抓数失败：', msg.slice(0, 500));
  }
  process.exit(1);
});
