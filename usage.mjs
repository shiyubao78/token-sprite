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

// ---- Claude Code：~/.claude/projects/**/*.jsonl，assistant 消息的 usage ----
async function readClaudeCode() {
  const root = join(homedir(), '.claude', 'projects');
  if (!(await exists(root))) return null;
  const files = await walk(root, '.jsonl');
  if (!files.length) return null;
  const seen = new Set();
  const cutoff = Date.now() - RECENT_MS;
  let total = 0, recentTokens = 0, lastActivityAt = 0;
  for (const f of files) {
    let text; try { text = await readFile(f, 'utf8'); } catch { continue; }
    eachLine(text, (obj) => {
      const msg = obj && obj.message;
      if (!msg || typeof msg !== 'object' || !msg.usage) return;
      if (msg.id) { if (seen.has(msg.id)) return; seen.add(msg.id); }
      const u = msg.usage;
      const t = (u.input_tokens || 0) + (u.output_tokens || 0) +
                (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      total += t;
      const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isFinite(ts)) {
        if (ts > lastActivityAt) lastActivityAt = ts;
        if (ts >= cutoff) recentTokens += t;
      }
    });
  }
  return { total, recentTokens, lastActivityAt };
}

// ---- Codex：~/.codex/**/rollout-*.jsonl，token_count 事件的 last_token_usage ----
async function readCodex() {
  const root = join(homedir(), '.codex');
  if (!(await exists(root))) return null;
  const files = (await walk(root, '.jsonl')).filter((f) => f.includes('rollout-'));
  if (!files.length) return null;
  const cutoff = Date.now() - RECENT_MS;
  let total = 0, recentTokens = 0, lastActivityAt = 0;
  for (const f of files) {
    let text; try { text = await readFile(f, 'utf8'); } catch { continue; }
    eachLine(text, (obj) => {
      const p = obj && obj.payload;
      if (!p || p.type !== 'token_count') return;
      const last = (p.info && p.info.last_token_usage) || null;
      const t = last && Number.isFinite(last.total_tokens) ? last.total_tokens : 0;
      total += t;
      const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isFinite(ts)) {
        if (ts > lastActivityAt) lastActivityAt = ts;
        if (ts >= cutoff) recentTokens += t;
      }
    });
  }
  return { total, recentTokens, lastActivityAt };
}

// 读取器登记表。新增工具在这里加一行即可（read 返回 {total,lastActivityAt}，没装则返回 null）。
export const READERS = [
  { source: 'claude-code', label: 'Claude Code', read: readClaudeCode },
  { source: 'codex', label: 'Codex', read: readCodex },
];

export async function computeLocalUsage() {
  const results = await Promise.all(
    READERS.map(async (r) => {
      try {
        const d = await r.read();
        return d ? { source: r.source, label: r.label, total: d.total || 0, recentTokens: d.recentTokens || 0, lastActivityAt: d.lastActivityAt || 0 } : null;
      } catch { return null; }
    })
  );
  const breakdown = results.filter((b) => b && b.total > 0);
  const total = breakdown.reduce((s, b) => s + b.total, 0);
  const recentTokens = breakdown.reduce((s, b) => s + b.recentTokens, 0);
  const lastActivityAt = breakdown.reduce((m, b) => Math.max(m, b.lastActivityAt), 0);
  return { total, recentTokens, lastActivityAt, breakdown };
}
