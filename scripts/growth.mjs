// 「成长小结」：汇总你今天在**所有 AI 工具**（Claude Code / Codex …）里发出的提问
// → 交给你本机的 AI 分析 → 返回一份温暖的"该长脑子的地方"最终小结。
// 全在本地跑，数据只去你已经在用的那个 AI，不上传第三方。
import { readdir, readFile, stat, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

// ---------- 纯函数（可测） ----------

// Claude Code：抽用户提问 / 助手回复文本。工具结果/系统注入的不算。
export function extractUserText(obj) { return pickText(obj && obj.message, 'user'); }
export function extractAssistantText(obj) { return pickText(obj && obj.message, 'assistant'); }

// Codex：rollout jsonl，role 可能在 payload 或 payload.message 上。best-effort。
function codexNode(obj) {
  const p = obj && obj.payload;
  if (!p) return null;
  return p.role ? p : (p.message && p.message.role ? p.message : null);
}
export function extractCodexUserText(obj) { return pickText(codexNode(obj), 'user'); }
export function extractCodexAssistantText(obj) { return pickText(codexNode(obj), 'assistant'); }

// 通用：从一个 {role, content} 节点按角色抽文本（content 支持字符串 / 文本块数组）。
function pickText(node, role) {
  if (!node || node.role !== role) return null;
  let text = null;
  if (typeof node.content === 'string') text = node.content;
  else if (Array.isArray(node.content)) {
    const parts = node.content
      .filter((b) => b && (b.type === 'text' || b.type === 'input_text' || b.type === 'output_text') && typeof b.text === 'string')
      .map((b) => b.text);
    text = parts.length ? parts.join('\n') : null;
  }
  if (!text) return null;
  text = text.trim();
  if (role === 'user') return isRealUserPrompt(text) ? text : null;
  return text.length >= 2 ? text : null;
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

// 拼给 AI 的分析指令：把今天的交互分成四类，只输出一个 JSON 对象。带上已知长期记忆当背景。双语。
export function buildPrompt(items, locale = 'zh', memory = [], openTodos = [], done = [], fed = []) {
  const joined = items.map((it, i) => `${i + 1}. [${it.source}] ${it.text.replace(/\n+/g, ' ')}`).join('\n');
  const tools = [...new Set(items.map((it) => it.source))].join(' / ') || 'AI';
  const mem = asArr(memory).map((m) => String(m).trim()).filter(Boolean);
  const tdo = asArr(openTodos).map((t) => String(t).trim()).filter(Boolean);
  const dn = asArr(done).map((d) => String(d).trim().replace(/\n+/g, ' ')).filter(Boolean);
  if (locale === 'en') {
    const memBlock = mem.length ? `Here's what you already know about me long-term — take it into account (personalize, don't re-ask, and don't repeat these as new memory):\n${mem.map((m) => '- ' + m).join('\n')}\n\n` : '';
    const todoBlock = tdo.length ? `I'm already tracking these to-dos — do NOT list them again (even reworded); only surface genuinely NEW ones from today:\n${tdo.map((t) => '- ' + t).join('\n')}\n\n` : '';
    const doneBlock = dn.length ? `Here's what the AI assistant DID / said today — use it to judge what's already finished. Do NOT list finished work as an open to-do. If a batch of changes is done but not committed/shipped yet, collapse it into ONE forward to-do (e.g. "commit & release today's changes"):\n${dn.map((d) => '· ' + d).join('\n')}\n\n` : '';
    return `You are my coding buddy — the little sprite I'm raising. You want me to not just USE AI, but get stronger myself, remember what I said I'd do, and keep what matters long-term.
${memBlock}${todoBlock}${doneBlock}Below are the prompts I sent across all my AI coding tools today (${tools}). Read them and reply with ONE JSON object ONLY — no markdown code fences, no extra text — with exactly these keys:
{
  "summary": "one or two sentences: what I mainly worked on / talked about today",
  "knowledge": [{"term": "the concept name", "explain": "2-3 sentences that actually teach this concept so I learn it right here"}],
  "todos": ["ONLY NEW things I said I need to do that aren't already tracked above; MERGE several small items about the same thing into ONE higher-level to-do (e.g. 'commit & release these changes' rather than listing each change), one short line each (e.g. 'add tests for X', 'book a flight')"],
  "memory": ["ONLY NEW things worth keeping long-term that aren't already known above: my preferences, key project decisions, important facts, one short line each"]
}
Pick at most 3 knowledge items. Use [] for any empty category. Base it only on the prompts below. Values in English.

--- my prompts today (tagged by tool) ---
${joined}${fed.length ? `

--- pasted in by hand (from web-based AI or other tools; treat these the same as the prompts above) ---
${fed.map((f) => '· ' + f).join('\n')}` : ''}`;
  }
  const memBlock = mem.length ? `你已经知道我这些长期背景，生成时请考虑它们（据此个性化、别重复问，也别把它们当成今天新增的记忆）：\n${mem.map((m) => '- ' + m).join('\n')}\n\n` : '';
  const todoBlock = tdo.length ? `我已经在追踪下面这些待办，**别再列出来了（哪怕换个说法也不行）**，只从今天挑真正新出现的待办：\n${tdo.map((t) => '- ' + t).join('\n')}\n\n` : '';
  const doneBlock = dn.length ? `下面是今天 AI 助手**做过 / 回复过**的事，用来判断什么**已经完成**。**已经做完的别当成待办**；如果一堆改动做完了但还没提交 / 发版，就把它们收成**一条向前的待办**（比如"把今天这些改动发个版"）：\n${dn.map((d) => '· ' + d).join('\n')}\n\n` : '';
  return `你是我的编程搭子，也是我养的那只小精灵。你希望我不只"会用 AI"、也越来越强，会帮我记住要做的事、也帮我留住值得长期保留的东西。
${memBlock}${todoBlock}${doneBlock}下面是我今天在所有 AI 编程工具（${tools}）里发出的提问。读完后，**只输出一个 JSON 对象**（不要 markdown 代码围栏、不要多余文字），严格用下面这些键，把内容分成四类：
{
  "summary": "一两句话：今天我主要在做什么、聊了什么",
  "knowledge": [{"term": "技术点名字", "explain": "用 2-3 句把这个知识点讲清楚，让我看完就学到（不是只点名）"}],
  "todos": ["只放今天新出现、且上面还没在追踪的待办；**关于同一件事的多个小项要合并成一条更概括的**（比如'把这些改动 git 发版'，别逐条列每个改动），一条一句（如'给 X 加测试'、'订机票'）"],
  "memory": ["只放上面还不知道的、今天新出现的值得长期记住的：我的偏好、项目关键决定、重要事实，一条一句"]
}
knowledge 最多挑 3 个。没有内容的类别给 []。只依据下面的提问。所有值用中文。

--- 我今天的提问（标了来自哪个工具）---
${joined}${fed.length ? `

--- 我手动喂进来的内容（来自网页版 AI 或别的工具，和上面的提问同等对待）---
${fed.map((f) => '· ' + f).join('\n')}` : ''}`;
}

// 从 AI 输出里稳健解析出结构化四类（容忍代码围栏/多余文字；解析失败则退化为 summary）。
// 给别的 AI 用的可移植指令：本机没装 Claude/Codex CLI 的人（只用网页版豆包/ChatGPT 的），
// 把这段粘进他正在聊的那个对话框即可——对方的上下文里本来就有今天聊的内容，
// 所以不需要用户复制任何原始对话，拿回它吐的 JSON 粘回来就行。
export function buildPortablePrompt(locale = 'zh') {
  if (locale === 'en') {
    return `Look back over everything we talked about today, then reply with ONE JSON object ONLY — no markdown code fences, no extra text:
{
  "summary": "one or two sentences: what I mainly worked on / talked about today",
  "knowledge": [{"term": "the concept name", "explain": "2-3 sentences that actually teach it, so I learn it right here"}],
  "todos": ["things I said I'd do but haven't, one short line each"],
  "memory": ["worth remembering long-term: my preferences, key decisions, important facts"]
}
Pick at most 3 knowledge items. Use [] for any empty category.`;
  }
  return `请回顾我们今天聊过的全部内容，然后**只输出一个 JSON 对象**（不要 markdown 代码围栏、不要多余文字）：
{
  "summary": "一两句话：我今天主要在做什么、聊了什么",
  "knowledge": [{"term": "知识点名字", "explain": "用 2-3 句把它讲清楚，让我看完就真学到（不是只点个名）"}],
  "todos": ["我说过要做但还没做的事，一条一句"],
  "memory": ["值得长期记住的：我的偏好、关键决定、重要事实，一条一句"]
}
knowledge 最多挑 3 个。没有内容的类别给 []。所有值用中文。`;
}

// 粘回来的到底是「AI 分析结果」还是「原始素材」？
// 不能靠 parseGeneration 判断——它解析失败时会把整段塞进 summary 当兜底，永远"成功"。
export function looksLikeGeneration(text) {
  if (!text) return false;
  let s = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i < 0 || j <= i) return false;
  try {
    const obj = JSON.parse(s.slice(i, j + 1));
    if (!obj || typeof obj !== 'object') return false;
    // 认准我们要的键，别把用户随手粘的普通 JSON 当成小结
    return ('summary' in obj) || ('knowledge' in obj && Array.isArray(obj.knowledge));
  } catch { return false; }
}

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
  if (raw && typeof raw === 'object' && (raw.days || raw.todos || raw.memory || raw.fed)) {
    return {
      days: raw.days && typeof raw.days === 'object' ? raw.days : {},
      todos: asArr(raw.todos), memory: asArr(raw.memory), fed: asArr(raw.fed),
    };
  }
  const days = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (v && typeof v === 'object') days[k] = v;
  return { days, todos: [], memory: [], fed: [] };
}

// ---- 投喂：拖到桌宠身上的文本先存起来，等下次生成小结时一起消化 ----
// 为什么不当场分析：那要等十几秒调 AI，喂个东西卡一下体验就毁了。
export const FED_MAX_CHARS = 4000;  // 单条太长会撑爆 prompt，截断
export const FED_MAX_ITEMS = 50;    // 攒太多也没意义，留最近的

export function appendFed(store, text, source = 'drop', now = Date.now()) {
  const clean = String(text || '').trim();
  if (!clean) return store;                       // 空的不收
  const s = normalizeStore(store);
  const item = {
    id: 'f' + now.toString(36) + Math.random().toString(36).slice(2, 6),
    text: clean.slice(0, FED_MAX_CHARS),
    source, at: now,
  };
  return { ...s, fed: [...s.fed, item].slice(-FED_MAX_ITEMS) };
}

// 待消化的文本（生成小结时喂给 AI）
export function pendingFedTexts(store) {
  return normalizeStore(store).fed.map((f) => f.text).filter(Boolean);
}

// 消化完就清掉，避免重复分析
export function clearFed(store) {
  return { ...normalizeStore(store), fed: [] };
}

export async function readStore(filePath) {
  try { return normalizeStore(JSON.parse(await readFile(filePath, 'utf8'))); }
  catch { return { days: {}, todos: [], memory: [] }; }
}

export async function writeStore(filePath, store) {
  try { await writeFile(filePath, JSON.stringify(store, null, 2), 'utf8'); } catch { /* 存储不可用则静默 */ }
  return store;
}

// 把一次生成结果并进存档：当天 summary+knowledge 覆盖写；
// 待办 = 刷新「今天由 AI 生成、还没勾掉」的那批（重新生成就换成最新的），保留你手加的、已勾掉的、以及别的日子的；
// 记忆只追加「新」的（按归一化文本去重）。
export function mergeGeneration(store, date, parsed, meta = {}) {
  const at = meta.at || Date.now();
  const s = { days: { ...(store.days || {}) }, todos: [...asArr(store.todos)], memory: [...asArr(store.memory)], fed: asArr(store.fed) };
  s.days[date] = { summary: parsed.summary, knowledge: parsed.knowledge, tools: meta.tools || [], count: meta.count || 0, at };
  s.todos = s.todos.filter((t) => !(t.from === 'ai' && t.day === date && !t.done)); // 清掉今天旧的 AI 待办，换最新的
  const haveT = new Set(s.todos.map((t) => normText(t.text)));
  for (const t of parsed.todos) { const n = normText(t); if (n && !haveT.has(n)) { haveT.add(n); s.todos.push({ id: newId(), text: t, done: false, from: 'ai', day: date, at }); } }
  const haveM = new Set(s.memory.map((m) => normText(m.text)));
  for (const m of parsed.memory) { const n = normText(m); if (n && !haveM.has(n)) { haveM.add(n); s.memory.push({ id: newId(), text: m, at }); } }
  if (s.memory.length > 80) s.memory = s.memory.slice(-80); // 记忆有上限，别无限膨胀撑爆 prompt
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
  { source: 'Claude Code', root: () => join(homedir(), '.claude', 'projects'), fileFilter: null, user: extractUserText, done: extractAssistantText },
  { source: 'Codex', root: () => join(homedir(), '.codex'), fileFilter: (f) => f.includes('rollout-'), user: extractCodexUserText, done: extractCodexAssistantText },
];

// 汇总今天所有工具里的某类文本（which='user' 你的提问 / 'done' 助手做过/回复过的事），按时间返回 [{source, text}]。
async function collectToday(now, which) {
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
        const t = r[which](obj);
        if (t) all.push({ ts, source: r.source, text: t });
      }
    }
  }
  all.sort((a, b) => a.ts - b.ts);
  return all.map(({ source, text }) => ({ source, text }));
}
export const collectTodayPrompts = (now = Date.now()) => collectToday(now, 'user');
export const collectTodayDone = (now = Date.now()) => collectToday(now, 'done');

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
export async function generateGrowthSummary({ locale = 'zh', now = Date.now(), memory = [], openTodos = [], fed = [] } = {}) {
  const raw = await collectTodayPrompts(now);
  // 只用网页版 AI 的人本地没有任何 CLI 日志，喂进来的就是他们的全部输入——不能因为 raw 为空就拒绝
  if (!raw.length && !fed.length) return { ok: false, reason: 'no_prompts' };
  const items = condensePrompts(raw);
  const done = condensePrompts(await collectTodayDone(now), { maxCount: 50, maxChars: 180 }).map((d) => `[${d.source}] ${d.text}`);
  const tools = [...new Set(raw.map((r) => r.source))];
  const res = await runViaLocalAI(buildPrompt(items, locale, memory, openTodos, done, fed));
  if (!res.ok) return res;
  return { ok: true, parsed: parseGeneration(res.text), count: raw.length, tools };
}
