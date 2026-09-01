import './journal.css';
import { L, setLocale, detectLocale } from '../config/i18n.js';
import { bootWaitMs } from '../domain/bootDelay.js';

// 语言：跟随桌宠存档里的选择（同源 localStorage 共享），否则跟随系统。
try {
  const raw = localStorage.getItem('token-sprite:pet:v1');
  const loc = raw && JSON.parse(raw)?.settings?.locale;
  setLocale(loc || detectLocale(globalThis.navigator?.language));
} catch { setLocale(detectLocale(globalThis.navigator?.language)); }

const root = document.getElementById('journal');
const api = globalThis.tokenSprite;
const asArr = (x) => (Array.isArray(x) ? x : []);
const newId = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const TODAY = todayKey();

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let store = { days: {}, todos: [], memory: [] };
let busy = false;
let genMsg = '';
let editing = null; // 正在编辑文字的待办 id
let showPast = false;
let portableMsg = ''; // 复制指令后的提示文案

// 只存待办（记忆不对用户开放、由生成在后台维护，别覆盖）。
function save() { try { api?.journalSaveLists?.({ todos: store.todos }); } catch {} }

function errMsg(reason) {
  const m = {
    no_prompts: L({ zh: '今天还没有和 AI 的对话记录，先去写会儿代码吧～', en: 'No AI chats yet today — go write some code first ~' }),
    no_ai: L({ zh: '没检测到 Claude Code / Codex 命令。装了其中一个才能生成。', en: 'No Claude Code / Codex command found. Install one to use this.' }),
    timeout: L({ zh: 'AI 想太久超时了，稍后再试～', en: 'The AI took too long. Try again later.' }),
  };
  return m[reason] || L({ zh: '生成失败了，稍后再试～', en: 'Something went wrong. Try again later.' });
}

function todaySection() {
  const d = store.days[TODAY];
  const know = d ? asArr(d.knowledge) : [];
  let body;
  if (busy) body = `<div class="jr-loading"><b>${L({ zh: '正在生成今日摘要… 🌱', en: 'Generating today’s recap… 🌱' })}</b><div class="jr-loading-hint">${L({ zh: '小精灵在读今天的对话、交给你本机的 AI 分析，大概 20–40 秒，先别关窗～', en: 'Reading today’s chats and asking your local AI — about 20–40s, keep this window open ~' })}</div></div>`;
  else if (know.length) body = know.map((k) => `<div class="jr-know"><b>${esc(k.term)}</b>${k.term && k.explain ? '：' : ''}${esc(k.explain)}</div>`).join('');
  else body = `<div class="jr-muted">${genMsg ? esc(genMsg) : L({ zh: '还没生成今天的小结。', en: 'Today’s recap not generated yet.' })}</div>`;
  const label = busy ? L({ zh: '生成中…', en: 'Generating…' }) : (d ? L({ zh: '🔄 重新生成今日', en: '🔄 Regenerate today' }) : L({ zh: '生成今日小结 🌱', en: 'Generate today 🌱' }));
  // 本机没装 Claude/Codex CLI 的人（只用网页版豆包/ChatGPT），走"借别的 AI"这条路
  const borrow = `<div class="jr-borrow">
    <span>${portableMsg || L({ zh: '本机没有 Claude / Codex？让你正在用的 AI 帮你总结', en: 'No Claude / Codex on this machine? Let the AI you already use do it' })}</span>
    <button class="jr-borrow-btn" id="portableBtn">${L({ zh: '复制指令', en: 'Copy prompt' })}</button>
  </div>`;
  return `<section class="jr-block">
    <div class="jr-sec-h">💡 ${L({ zh: '今日知识点', en: 'Today’s takeaways' })}</div>
    ${body}
    <button class="jr-regen ${busy ? 'busy' : ''}" id="genBtn" ${busy ? 'disabled' : ''}>${label}</button>
    ${borrow}
  </section>`;
}

function todosSection() {
  const clearable = store.todos.filter((t) => !t.done && t.from !== 'user').length;
  const items = store.todos.map((t) => {
    const body = editing === t.id
      ? `<input class="jr-edit" data-editid="${t.id}" value="${esc(t.text)}" maxlength="160" />`
      : `<span class="jr-todo-text" data-edit="${t.id}" title="${L({ zh: '点击编辑', en: 'Click to edit' })}">${esc(t.text)}</span>`;
    return `<div class="jr-todo ${t.done ? 'done' : ''}">
      <span class="jr-check" data-toggle="${t.id}">${t.done ? '☑' : '☐'}</span>
      ${body}
      <span class="jr-del" data-deltodo="${t.id}" title="${L({ zh: '删除', en: 'Delete' })}">✕</span>
    </div>`;
  }).join('');
  return `<section class="jr-block">
    <div class="jr-sec-h">✅ ${L({ zh: '待办', en: 'To-do' })}${clearable ? `<span class="jr-clear" id="todoClear">🧹 ${L({ zh: '清空自动', en: 'Clear auto' })}</span>` : ''}</div>
    ${items || `<div class="jr-muted">${L({ zh: '还没有待办。写代码时说过要做的事，生成后会自动收进来。', en: 'No to-dos yet. Things you say you’ll do get collected here after you generate.' })}</div>`}
    <div class="jr-add"><input id="todoAdd" maxlength="120" placeholder="${L({ zh: '加一条待办…回车', en: 'Add a to-do… Enter' })}" /><button id="todoAddBtn">${L({ zh: '添加', en: 'Add' })}</button></div>
  </section>`;
}

function pastDays() { return Object.keys(store.days).sort().reverse(); }
function pastSection() {
  const days = pastDays();
  if (!days.length) return '';
  if (!showPast) return `<div class="jr-pastlink" id="pastToggle">${L({ zh: `📖 看历史 · ${days.length} 天`, en: `📖 History · ${days.length}` })}</div>`;
  const list = days.map((d) => {
    const e = store.days[d] || {};
    const know = asArr(e.knowledge).map((k) => `<div class="jr-know"><b>${esc(k.term)}</b>${k.term && k.explain ? '：' : ''}${esc(k.explain)}</div>`).join('');
    return `<article class="jr-past">
      <div class="jr-date">${esc(d)}</div>
      ${e.summary ? `<div class="jr-summary">${esc(e.summary)}</div>` : ''}
      ${know}
    </article>`;
  }).join('');
  return `<section class="jr-block">
    <div class="jr-sec-h jr-pastlink" id="pastToggle">📖 ${L({ zh: '历史', en: 'History' })} <span class="jr-fold">${L({ zh: '收起', en: 'hide' })}</span></div>
    ${list}
  </section>`;
}

function mount() {
  root.innerHTML = `
    <header class="jr-head">
      <div class="jr-title">${L({ zh: '🧠 成长日记', en: '🧠 Growth Journal' })}</div>
      <div class="jr-sub">${L({ zh: '借 AI 的力，长自己的筋骨', en: 'Borrow the AI’s strength. Grow your own.' })}</div>
    </header>
    ${todaySection()}
    ${todosSection()}
    ${pastSection()}
    <footer class="jr-foot">${L({ zh: '会花一点点 token（用你已在用的那个 AI）。全程本地，数据只去你本来就在用的 AI，不上传第三方。', en: 'Uses a little token (via the AI you already use). Fully local; data only goes to the AI you already use, never a third party.' })}</footer>`;
  wire();
}

function generate() {
  if (!api?.journalGenerate || busy) return;
  busy = true; genMsg = ''; mount();
  api.journalGenerate().then((r) => {
    busy = false;
    if (r && r.ok) store = r.store; else genMsg = errMsg(r && r.reason);
    mount();
  }).catch(() => { busy = false; genMsg = errMsg('ai_error'); mount(); });
}

function wire() {
  const $ = (s) => root.querySelector(s);
  $('#genBtn')?.addEventListener('click', () => {
    if (!api?.journalGenerate) { genMsg = L({ zh: '桌面版才能生成（要调用你本机的 AI）。', en: 'Desktop app only — it calls your local AI.' }); mount(); return; }
    generate();
  });

  root.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('click', () => {
    const t = store.todos.find((x) => x.id === el.getAttribute('data-toggle'));
    if (t) { t.done = !t.done; save(); mount(); }
  }));
  root.querySelectorAll('[data-deltodo]').forEach((el) => el.addEventListener('click', () => {
    store.todos = store.todos.filter((x) => x.id !== el.getAttribute('data-deltodo')); save(); mount();
  }));

  // 编辑待办文字（编辑后标记为 user，重新生成不再覆盖）
  root.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => { editing = el.getAttribute('data-edit'); mount(); }));
  const commitEdit = (el) => {
    if (editing === null) return;
    const t = store.todos.find((x) => x.id === el.getAttribute('data-editid'));
    const v = el.value.trim();
    editing = null;
    if (t && v) { t.text = v; t.from = 'user'; save(); }
    mount();
  };
  root.querySelectorAll('[data-editid]').forEach((el) => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(el); } else if (e.key === 'Escape') { editing = null; mount(); } });
    el.addEventListener('blur', () => commitEdit(el));
  });
  // 清空自动待办（只清 AI 生成、没勾的；保留你手加的和已勾掉的）
  $('#todoClear')?.addEventListener('click', () => { store.todos = store.todos.filter((t) => t.done || t.from === 'user'); save(); mount(); });

  const addTodo = () => { const inp = $('#todoAdd'); const v = inp.value.trim(); if (!v) return; store.todos.push({ id: newId(), text: v, done: false, from: 'user', at: Date.now() }); save(); mount(); };
  $('#todoAddBtn')?.addEventListener('click', addTodo);
  $('#todoAdd')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

  $('#pastToggle')?.addEventListener('click', () => { showPast = !showPast; mount(); });

  // 复制一段通用指令，粘到任何 AI 里都能用——对方的上下文里本来就有今天聊的内容，
  // 所以不用复制任何原始对话，把它吐回的 JSON 收回来就行。
  $('#portableBtn')?.addEventListener('click', async () => {
    const text = await api?.journalPortablePrompt?.().catch(() => '');
    if (!text) { portableMsg = L({ zh: '拿不到指令，桌面版才有这个功能', en: 'Desktop app only' }); mount(); return; }
    try { await navigator.clipboard.writeText(text); }
    catch { portableMsg = L({ zh: '复制失败，请手动复制', en: 'Copy failed' }); mount(); return; }
    portableMsg = L({
      zh: '已复制 ✓ 粘到你正在聊的 AI 里，再把它的回答复制回来，按 ⌘⇧V 或拖到桌宠身上',
      en: 'Copied ✓ Paste it into the AI you\'re chatting with, then bring its answer back — press ⌘⇧V or drop it on the sprite',
    });
    mount();
  });

  if (editing) { const inp = root.querySelector('[data-editid]'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
}

// 进窗口：先拉存档铺上（待办/记忆），今天还没生成过就自动生成一次。
// 打包后的脚本几十毫秒就跑完，直接 mount 会把开窗加载态瞬间盖掉，所以先让它显示够久。
async function init() {
  if (api?.journalGet) { try { const s = await api.journalGet(); if (s) store = s; } catch {} }
  const wait = bootWaitMs(globalThis.__bootAt, Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  mount();
  if (api?.journalGenerate && !store.days[TODAY]) generate();
}
// 从别的 AI 粘回结果后，主进程会通知刷新
api?.onJournalUpdated?.(async () => {
  if (api?.journalGet) { try { const s = await api.journalGet(); if (s) store = s; } catch {} }
  portableMsg = '';
  mount();
});

init();
