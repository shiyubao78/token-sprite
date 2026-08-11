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

// 拼给 AI 的分析指令：把今天的交互分成四类，只输出一个 JSON 对象。双语。
export function buildPrompt(items, locale = 'zh') {
  const joined = items.map((it, i) => `${i + 1}. [${it.source}] ${it.text.replace(/\n+/g, ' ')}`).join('\n');
  const tools = [...new Set(items.map((it) => it.source))].join(' / ') || 'AI';
  if (locale === 'en') {
    return `You are my coding buddy — the little sprite I'm raising. You want me to not just USE AI, but get stronger myself, remember what I said I'd do, and keep what matters long-term.
Below are the prompts I sent across all my AI coding tools today (${tools}). Read them and reply with ONE JSON object ONLY — no markdown code fences, no extra text — with exactly these keys:
{
  "summary": "one or two sentences: what I mainly worked on / talked about today",
  "knowledge": [{"term": "the concept name", "explain": "2-3 sentences that actually teach this concept so I learn it right here"}],
  "todos": ["things I said I need to do or follow up on, one short line each (e.g. 'add tests for X', 'book a flight')"],
  "memory": ["things worth keeping long-term: my preferences, key project decisions, important facts, one short line each"]
}
Pick at most 3 knowledge items. Use [] for any empty category. Base it only on the prompts below. Values in English.

--- my prompts today (tagged by tool) ---
${joined}`;
  }
  return `你是我的编程搭子，也是我养的那只小精灵。你希望我不只"会用 AI"、也越来越强，会帮我记住要做的事、也帮我留住值得长期保留的东西。
下面是我今天在所有 AI 编程工具（${tools}）里发出的提问。读完后，**只输出一个 JSON 对象**（不要 markdown 代码围栏、不要多余文字），严格用下面这些键，把内容分成四类：
{
  "summary": "一两句话：今天我主要在做什么、聊了什么",
  "knowledge": [{"term": "技术点名字", "explain": "用 2-3 句把这个知识点讲清楚，让我看完就学到（不是只点名）"}],
  "todos": ["我说过要做/要跟进的事，一条一句（比如'给 X 加测试'、'订机票'）"],
  "memory": ["值得长期记住的：我的偏好、项目关键决定、重要事实，一条一句"]
}
knowledge 最多挑 3 个。没有内容的类别给 []。只依据下面的提问。所有值用中文。

--- 我今天的提问（标了来自哪个工具）---
${joined}`;
}

// 从 AI 输出里稳健解析出结构化四类（容忍代码围栏/多余文字；解析失败则退化为 summary）。
export function parseGeneration(text) {
  const empty = { summary: '', knowledge: [], todos: [], memory: [] };
  if (!text) return empty;
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) s = s.slice(i, j + 1);
  let obj;
  try { obj = JSON.parse(s); } catch { return { ...empty, summary: String(text).trim() }; }
  const arr = (x) => (Array.isArray(x) ? x : []);
  const str = (x) => (typeof x === 'string' ? x.trim() : '');
  return {
    summary: str(obj.summary),
    knowledge: arr(obj.knowledge).map((k) => ({ term: str(k && k.term), explain: str(k && k.explain) })).filter((k) => k.term || k.explain),
    todos: arr(obj.todos).map(str).filter(Boolean),
    memory: arr(obj.memory).map(str).filter(Boolean),
  };
}

// ---------- 成长日记留存（结构化四类，存在 app 数据目录，不上传） ----------
// 存档结构：{ days: { 'YYYY-MM-DD': { summary, knowledge:[{term,explain}], tools, count, at } },
//            todos: [{id,text,done,at}]（跨天 running），memory: [{id,text,at}]（跨天累积） }

// 本地日期键 YYYY-MM-DD（按本机时区）。
export function todayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function asArr(x) { return Array.isArray(x) ? x : []; }
function normText(s) { return String(s).toLowerCase().replace(/\s+/g, '').replace(/[。，、．.!?！？；;：:]/g, ''); }
function newId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// 兜正结构；兼容旧的扁平 {date:{text}} 存档（迁进 days）。
export function normalizeStore(raw) {
  if (raw && typeof raw === 'object' && (raw.days || raw.todos || raw.memory)) {
    return { days: raw.days && typeof raw.days === 'object' ? raw.days : {}, todos: asArr(raw.todos), memory: asArr(raw.memory) };
  }
  const days = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (v && typeof v === 'object') days[k] = v;
  return { days, todos: [], memory: [] };
}

export async function readStore(filePath) {
  try { return normalizeStore(JSON.parse(await readFile(filePath, 'utf8'))); }
  catch { return { days: {}, todos: [], memory: [] }; }
}

export async function writeStore(filePath, store) {
  try { await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8'); } catch { /* 存储不可用则静默 */ }
  return store;
}

// 把一次生成结果并进存档：当天的 summary+knowledge 覆盖写；todos/memory 只追加「新」的（按归一化文本去重）。
export function mergeGeneration(store, date, parsed, meta = {}) {
  const at = meta.at || Date.now();
  const s = { days: { ...(store.days || {}) }, todos: [...asArr(store.todos)], memory: [...asArr(store.memory)] };
  s.days[date] = { summary: parsed.summary, knowledge: parsed.knowledge, tools: meta.tools || [], count: meta.count || 0, at };
  const haveT = new Set(s.todos.map((t) => normText(t.text)));
  for (const t of parsed.todos) { const n = normText(t); if (n && !haveT.has(n)) { haveT.add(n); s.todos.push({ id: newId(), text: t, done: false, at }); } }
  const haveM = new Set(s.memory.map((m) => normText(m.text)));
  for (const m of parsed.memory) { const n = normText(m); if (n && !haveM.has(n)) { haveM.add(n); s.memory.push({ id: newId(), text: m, at }); } }
  return s;
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
  if (!res.ok) return res;
  return { ok: true, parsed: parseGeneration(res.text), count: raw.length, tools };
}
