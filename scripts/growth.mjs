// 「成长小结」：汇总你今天在**所有 AI 工具**（Claude Code / Codex …）里发出的提问
// → 交给你本机的 AI 分析 → 返回一份温暖的"该长脑子的地方"最终小结。
// 全在本地跑，数据只去你已经在用的那个 AI，不上传第三方。
import { readdir, readFile, stat, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

// ---------- 纯函数（可测） ----------

// Claude Code：从一条 jsonl 记录抽"用户真正打的字"。工具结果/系统注入的不算。
export function extractUserText(obj) {
  return pickUserText(obj && obj.message);
}

// Codex：rollout jsonl 里的用户消息（role 可能在 payload 或 payload.message 上）。best-effort。
export function extractCodexUserText(obj) {
  const p = obj && obj.payload;
  if (!p) return null;
  const node = p.role ? p : (p.message && p.message.role ? p.message : null);
  return pickUserText(node);
}

// 通用：从一个 {role, content} 节点抽用户文本（content 支持字符串 / 文本块数组）。
function pickUserText(node) {
  if (!node || node.role !== 'user') return null;
  let text = null;
  if (typeof node.content === 'string') text = node.content;
  else if (Array.isArray(node.content)) {
    const parts = node.content
      .filter((b) => b && (b.type === 'text' || b.type === 'input_text') && typeof b.text === 'string')
      .map((b) => b.text);
    text = parts.length ? parts.join('\n') : null;
  }
  if (!text) return null;
  text = text.trim();
  return isRealUserPrompt(text) ? text : null;
}

// 过滤掉工具注入的非用户内容（命令回显、系统提醒、中断提示、注意事项等）。
export function isRealUserPrompt(text) {
  if (!text || text.length < 2) return false;
  const noise = ['Caveat:', '<command-name>', '<command-message>', '<local-command-stdout>',
    '<system-reminder>', '[Request interrupted', '<user-'];
  return !noise.some((n) => text.includes(n));
}

export function isToday(ts, now = Date.now()) {
  if (!Number.isFinite(ts)) return false;
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  return ts >= d.getTime();
}

// 收敛体量：跨所有工具只留最近 maxCount 条，每条截断到 maxChars。items = [{source,text}]。
export function condensePrompts(items, { maxCount = 60, maxChars = 400 } = {}) {
  return items.slice(-maxCount).map((it) => ({
    source: it.source,
    text: it.text.length > maxChars ? it.text.slice(0, maxChars) + '…' : it.text,
  }));
}

// 拼给 AI 的分析指令：温暖的成长教练口吻，先夸一句、再轻提醒、最后一个成长点。双语。
export function buildPrompt(items, locale = 'zh') {
  const joined = items.map((it, i) => `${i + 1}. [${it.source}] ${it.text.replace(/\n+/g, ' ')}`).join('\n');
  const tools = [...new Set(items.map((it) => it.source))].join(' / ') || 'AI';
  if (locale === 'en') {
    return `You are my coding buddy — the little sprite I'm raising. You genuinely want me to not just USE AI, but to keep getting stronger myself. 💚
Below are the prompts I sent across all my AI coding tools today (${tools}). In a warm, encouraging, non-preachy voice, under 170 words, talk to me like a friend:
1) First, one specific bit of praise for today's effort or progress (no clichés).
2) Where I leaned on AI a bit today (things I kept asking) — nudge me gently.
3) Pick ONE thing today most worth understanding myself, and why it'll make me faster.
Be warm, specific, positive. Base it only on the prompts below.

--- my prompts today (tagged by tool) ---
${joined}`;
  }
  return `你是我的编程搭子，也是我养的那只小精灵。你真心希望我不只是"会用 AI"，而是自己也越来越强 💚
下面是我今天在所有 AI 编程工具（${tools}）里发出的提问。请用**温暖、鼓励、不说教**的语气，在 170 字内，像朋友一样跟我说：
1）先具体夸一句我今天的努力或进展（别客套）；
2）我今天在哪些地方有点依赖 AI（反复问的），轻轻提醒我；
3）挑今天最值得我自己搞懂的**一个**点，说说学会它以后能怎么更省力。
温柔、具体、正向，只依据下面这些提问判断。

--- 我今天的提问（标了来自哪个工具）---
${joined}`;
}

// ---------- IO ----------

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
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

// 各 AI 工具的"今日提问"读取器。加新工具 = 加一行（root / 文件过滤 / 抽取函数）。
const READERS = [
  { source: 'Claude Code', root: () => join(homedir(), '.claude', 'projects'), fileFilter: null, extract: extractUserText },
  { source: 'Codex', root: () => join(homedir(), '.codex'), fileFilter: (f) => f.includes('rollout-'), extract: extractCodexUserText },
];

// 汇总今天你发给"所有工具"的提问，按时间返回 [{source, text}]。
export async function collectTodayPrompts(now = Date.now()) {
  const all = [];
  for (const r of READERS) {
    const root = r.root();
    if (!(await exists(root))) continue;
    let files = await walk(root, '.jsonl');
    if (r.fileFilter) files = files.filter(r.fileFilter);
    for (const f of files) {
      let text; try { text = await readFile(f, 'utf8'); } catch { continue; }
      for (const line of text.split('\n')) {
        if (!line) continue;
        let obj; try { obj = JSON.parse(line); } catch { continue; }
        const ts = obj.timestamp ? Date.parse(obj.timestamp) : NaN;
        if (!isToday(ts, now)) continue;
        const t = r.extract(obj);
        if (t) all.push({ ts, source: r.source, text: t });
      }
    }
  }
  all.sort((a, b) => a.ts - b.ts);
  return all.map(({ source, text }) => ({ source, text }));
}

// 调你本机的 AI（优先 claude，其次 codex）分析，返回它的输出。
// GUI app 拿不到终端 PATH：既走登录 shell、又手动补常见安装目录，双保险找命令。
function runViaLocalAI(promptText, timeoutMs = 180000) {
  return new Promise(async (resolve) => {
    const pf = join(tmpdir(), `ts-growth-${Date.now()}.txt`);
    try { await writeFile(pf, promptText, 'utf8'); }
    catch { return resolve({ ok: false, reason: 'io_error' }); }
    const cleanup = () => { rm(pf, { force: true }).catch(() => {}); };
    const shell = process.env.SHELL || '/bin/zsh';
    const q = JSON.stringify(pf);
    const script =
      `export PATH="$HOME/.claude/local:$HOME/.local/bin:$HOME/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:$PATH";` +
      `if command -v claude >/dev/null 2>&1; then claude -p < ${q};` +
      `elif command -v codex >/dev/null 2>&1; then codex exec --skip-git-repo-check "$(cat ${q})";` +
      `else echo __NO_AI__ >&2; exit 127; fi`;
    let out = '', err = '', done = false;
    const child = spawn(shell, ['-lc', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); cleanup(); resolve(r); };
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} finish({ ok: false, reason: 'timeout' }); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', () => finish({ ok: false, reason: 'spawn_error' }));
    child.on('close', () => {
      if (err.includes('__NO_AI__')) return finish({ ok: false, reason: 'no_ai' });
      const t = out.trim();
      if (!t) return finish({ ok: false, reason: 'ai_error', detail: err.slice(-300) });
      finish({ ok: true, text: t });
    });
  });
}

// 对外主入口：生成今日成长小结（汇总全部 agent）。返回 { ok, text, count, tools } 或 { ok:false, reason }。
// reason: no_prompts（今天还没对话）/ no_ai（没装 claude/codex）/ timeout / ai_error / spawn_error / io_error
export async function generateGrowthSummary({ locale = 'zh', now = Date.now() } = {}) {
  const raw = await collectTodayPrompts(now);
  if (!raw.length) return { ok: false, reason: 'no_prompts' };
  const items = condensePrompts(raw);
  const tools = [...new Set(raw.map((r) => r.source))];
  const res = await runViaLocalAI(buildPrompt(items, locale));
  return res.ok ? { ok: true, text: res.text, count: raw.length, tools } : res;
}
