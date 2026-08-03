import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// 思路：直接读本地 AI 编程工具写下的用量记录，统计"我"的累计 token。
// 已覆盖 Claude Code 和 Codex；本机没有的工具(Cursor/Gemini 等)会自动跳过。

async function walk(dir, endsWith) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
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
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    fn(obj);
  }
}

// Claude Code：~/.claude/projects/**/*.jsonl，assistant 消息的 usage
async function readClaudeCode() {
  const root = join(homedir(), '.claude', 'projects');
  const files = await walk(root, '.jsonl');
  const seen = new Set();
  let total = 0;
  let lastActivityAt = 0;
  for (const file of files) {
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    eachLine(text, (obj) => {
      const msg = obj && obj.message;
      if (!msg || typeof msg !== 'object' || !msg.usage) return;
      if (msg.id) {
        if (seen.has(msg.id)) return;
        seen.add(msg.id);
      }
      const u = msg.usage;
      total +=
        (u.input_tokens || 0) +
        (u.output_tokens || 0) +
        (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0);
      const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isFinite(ts) && ts > lastActivityAt) lastActivityAt = ts;
    });
  }
  return { source: 'claude-code', total, lastActivityAt };
}

// Codex：~/.codex/**/rollout-*.jsonl，token_count 事件的 last_token_usage.total_tokens 累加
async function readCodex() {
  const root = join(homedir(), '.codex');
  const files = (await walk(root, '.jsonl')).filter((f) => f.includes('rollout-'));
  let total = 0;
  let lastActivityAt = 0;
  for (const file of files) {
    let text;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    eachLine(text, (obj) => {
      const p = obj && obj.payload;
      if (!p || p.type !== 'token_count') return;
      const last = (p.info && p.info.last_token_usage) || null;
      if (last && Number.isFinite(last.total_tokens)) total += last.total_tokens;
      const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
      if (Number.isFinite(ts) && ts > lastActivityAt) lastActivityAt = ts;
    });
  }
  return { source: 'codex', total, lastActivityAt };
}

export async function computeLocalUsage() {
  const readers = [readClaudeCode(), readCodex()];
  const breakdown = (await Promise.all(readers)).filter((r) => r.total > 0);
  const total = breakdown.reduce((s, r) => s + r.total, 0);
  const lastActivityAt = breakdown.reduce((m, r) => Math.max(m, r.lastActivityAt), 0);
  return { total, lastActivityAt, breakdown };
}
