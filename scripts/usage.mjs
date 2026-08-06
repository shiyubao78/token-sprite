import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// 自动检测：装了哪些 agent、且本地有可解析的 token 用量，就统计哪些。
// 加新工具 = 往 READERS 里加一个读取器（detect 判断有没有装、read 解析用量）。
// 前提：该工具把 token 写在本地并可解析。app/网页类(豆包/DeepSeek/Kimi 等)用量在服务端，本地无数据、无法统计。

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function walk(dir, endsWith) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, endsWith)));
    else if (e.isFile() && e.name.endsWith(endsWith)) out.push(full);
  }
  return out;
}

function eachLine(text, fn) {
  for (const line of text.split('\n')) {
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    fn(obj);
  }
}

const RECENT_MS = 15 * 60 * 1000; // 最近 15 分钟算“正在敲”
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_DAYS = 14;  // 保留最近多少天的日序列
const HIST_DAYS = 7;   // 活跃时段直方图的统计窗口
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 共享累加器：把每次调用的 (时间戳, token) 累进 总量/最近/今日/按天/按小时。
function makeAcc() {
  const now = Date.now();
  const cutoff = now - RECENT_MS;
  const dayCutoff = startOfToday();
  const keepCutoff = now - KEEP_DAYS * DAY_MS;
  const histCutoff = now - HIST_DAYS * DAY_MS;
  let total = 0, recentTokens = 0, todayTokens = 0, lastActivityAt = 0;
  const daily = {};
  const hourly = new Array(24).fill(0);
  return {
    add(ts, t) {
      if (!t) return;
      total += t;
      if (!Number.isFinite(ts)) return;
      if (ts > lastActivityAt) lastActivityAt = ts;
      if (ts >= cutoff) recentTokens += t;
      if (ts >= dayCutoff) todayTokens += t;
      if (ts >= keepCutoff) { const k = dateKey(ts); daily[k] = (daily[k] || 0) + t; }
      if (ts >= histCutoff) hourly[new Date(ts).getHours()] += t;
    },
    result() { return { total, recentTokens, todayTokens, lastActivityAt, daily, hourly }; },
  };
}

// ---- Claude Code：~/.claude/projects/**/*.jsonl，assistant 消息的 usage ----
async function readClaudeCode() {
  const root = join(homedir(), '.claude', 'projects');
  if (!(await exists(root))) return null;
  const files = await walk(root, '.jsonl');
  if (!files.length) return null;
  const seen = new Set();
  const acc = makeAcc();
  for (const f of files) {
    let text; try { text = await readFile(f, 'utf8'); } catch { continue; }
    eachLine(text, (obj) => {
      const msg = obj && obj.message;
      if (!msg || typeof msg !== 'object' || !msg.usage) return;
      if (msg.id) { if (seen.has(msg.id)) return; seen.add(msg.id); }
      const u = msg.usage;
      const t = (u.input_tokens || 0) + (u.output_tokens || 0) +
                (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      acc.add(ts, t);
    });
  }
  return acc.result();
}

// ---- Codex：~/.codex/**/rollout-*.jsonl，token_count 事件的 last_token_usage ----
async function readCodex() {
  const root = join(homedir(), '.codex');
  if (!(await exists(root))) return null;
  const files = (await walk(root, '.jsonl')).filter((f) => f.includes('rollout-'));
  if (!files.length) return null;
  const acc = makeAcc();
  for (const f of files) {
    let text; try { text = await readFile(f, 'utf8'); } catch { continue; }
    eachLine(text, (obj) => {
      const p = obj && obj.payload;
      if (!p || p.type !== 'token_count') return;
      const last = (p.info && p.info.last_token_usage) || null;
      const t = last && Number.isFinite(last.total_tokens) ? last.total_tokens : 0;
      const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      acc.add(ts, t);
    });
  }
  return acc.result();
}

// ---- Gemini CLI（best-effort，待真机验证）：~/.gemini 下 json/jsonl 里 usageMetadata.totalTokenCount ----
// 用 Gemini 真实字段名，找不到就返回 null，绝不误算。时间戳用文件修改时间近似。
function collectGeminiTokens(node, out) {
  if (Array.isArray(node)) { for (const x of node) collectGeminiTokens(x, out); return; }
  if (node && typeof node === 'object') {
    const um = node.usageMetadata;
    if (um && typeof um === 'object' && Number.isFinite(um.totalTokenCount)) out.push(um.totalTokenCount);
    for (const k in node) collectGeminiTokens(node[k], out);
  }
}
async function readGeminiCli() {
  const root = join(homedir(), '.gemini');
  if (!(await exists(root))) return null;
  const files = [...(await walk(root, '.json')), ...(await walk(root, '.jsonl'))];
  if (!files.length) return null;
  const acc = makeAcc();
  let found = false;
  for (const f of files) {
    let text, mtime;
    try { text = await readFile(f, 'utf8'); mtime = (await stat(f)).mtimeMs; } catch { continue; }
    const out = [];
    try { collectGeminiTokens(JSON.parse(text), out); }
    catch { eachLine(text, (obj) => collectGeminiTokens(obj, out)); }
    if (!out.length) continue;
    found = true;
    acc.add(mtime, out.reduce((s, n) => s + n, 0));
  }
  return found ? acc.result() : null;
}

// 读取器登记表。新增工具在这里加一行即可（read 返回 {total,lastActivityAt}，没装则返回 null）。
export const READERS = [
  { source: 'claude-code', label: 'Claude Code', read: readClaudeCode },
  { source: 'codex', label: 'Codex', read: readCodex },
  { source: 'gemini-cli', label: 'Gemini CLI', read: readGeminiCli },
];

function weekTokens(daily = {}) {
  const cutoff = startOfToday() - 6 * DAY_MS; // 含今天在内最近 7 天
  return Object.entries(daily).reduce((s, [k, v]) => (Date.parse(k) >= cutoff ? s + v : s), 0);
}

export async function computeLocalUsage() {
  const results = await Promise.all(
    READERS.map(async (r) => {
      try {
        const d = await r.read();
        if (!d || !d.total) return null;
        return {
          source: r.source, label: r.label,
          total: d.total || 0, recentTokens: d.recentTokens || 0, todayTokens: d.todayTokens || 0,
          weekTokens: weekTokens(d.daily), lastActivityAt: d.lastActivityAt || 0,
          daily: d.daily || {}, hourly: d.hourly || new Array(24).fill(0),
        };
      } catch { return null; }
    })
  );
  const breakdown = results.filter(Boolean);
  const total = breakdown.reduce((s, b) => s + b.total, 0);
  const recentTokens = breakdown.reduce((s, b) => s + b.recentTokens, 0);
  const todayTokens = breakdown.reduce((s, b) => s + b.todayTokens, 0);
  const lastActivityAt = breakdown.reduce((m, b) => Math.max(m, b.lastActivityAt), 0);
  // 聚合按天与按小时
  const daily = {};
  const hourly = new Array(24).fill(0);
  for (const b of breakdown) {
    for (const [k, v] of Object.entries(b.daily)) daily[k] = (daily[k] || 0) + v;
    for (let h = 0; h < 24; h++) hourly[h] += b.hourly[h] || 0;
  }
  // 对外的 breakdown 不带大块 daily/hourly（面板用聚合的即可，省 IPC）
  const slimBreakdown = breakdown.map(({ daily: _d, hourly: _h, ...rest }) => rest);
  return { total, recentTokens, todayTokens, lastActivityAt, breakdown: slimBreakdown, daily, hourly };
}
