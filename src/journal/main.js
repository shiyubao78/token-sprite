import './journal.css';
import { L, setLocale, detectLocale } from '../config/i18n.js';

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

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let store = { days: {}, todos: [], memory: [] };
let genMsg = '';

function save() { try { api?.journalSaveLists?.({ todos: store.todos, memory: store.memory }); } catch {} }

function errMsg(reason) {
  const m = {
    no_prompts: L({ zh: '今天还没有和 AI 的对话记录，先去写会儿代码吧～', en: 'No AI chats yet today — go write some code first ~' }),
    no_ai: L({ zh: '没检测到 Claude Code / Codex 命令。装了其中一个才能生成。', en: 'No Claude Code / Codex command found. Install one to use this.' }),
    timeout: L({ zh: 'AI 想太久超时了，稍后再试～', en: 'The AI took too long. Try again later.' }),
  };
  return m[reason] || L({ zh: '生成失败了，稍后再试～', en: 'Something went wrong. Try again later.' });
}

function todosHtml() {
  const items = store.todos.map((t) => `
    <div class="jr-todo ${t.done ? 'done' : ''}">
      <span class="jr-check" data-toggle="${t.id}">${t.done ? '☑' : '☐'}</span>
      <span class="jr-todo-text">${esc(t.text)}</span>
      <span class="jr-del" data-deltodo="${t.id}" title="${L({ zh: '删除', en: 'Delete' })}">✕</span>
    </div>`).join('');
  return `<section class="jr-block">
    <div class="jr-sec-h">✅ ${L({ zh: '待办', en: 'To-do' })}</div>
    ${items || `<div class="jr-muted">${L({ zh: '还没有待办。写代码时说过要做的事，生成后会自动收进来。', en: 'No to-dos yet. Things you say you’ll do get collected here after you generate.' })}</div>`}
    <div class="jr-add"><input id="todoAdd" maxlength="120" placeholder="${L({ zh: '加一条待办…回车', en: 'Add a to-do… Enter' })}" /><button id="todoAddBtn">${L({ zh: '添加', en: 'Add' })}</button></div>
  </section>`;
}

function memoryHtml() {
  const items = store.memory.map((m) => `
    <div class="jr-mem">
      <span class="jr-dot">•</span>
      <span class="jr-mem-text">${esc(m.text)}</span>
      <span class="jr-del" data-delmem="${m.id}" title="${L({ zh: '删除', en: 'Delete' })}">✕</span>
    </div>`).join('');
  return `<section class="jr-block">
    <div class="jr-sec-h">📌 ${L({ zh: '记忆', en: 'Memory' })} <span class="jr-sec-hint">${L({ zh: '值得长期保留的', en: 'worth keeping long-term' })}</span></div>
    ${items || `<div class="jr-muted">${L({ zh: '还没有长期记忆。偏好、关键决定这类会攒在这。', en: 'No long-term memory yet. Preferences and key decisions collect here.' })}</div>`}
    <div class="jr-add"><input id="memAdd" maxlength="160" placeholder="${L({ zh: '记一条…回车', en: 'Add a note… Enter' })}" /><button id="memAddBtn">${L({ zh: '添加', en: 'Add' })}</button></div>
  </section>`;
}

function dayHtml(date, d) {
  const tools = (d.tools || []).join(' / ');
  const meta = d.count ? L({ zh: `汇总 ${tools} 共 ${d.count} 条`, en: `${d.count} prompts · ${tools}` }) : '';
  const know = asArr(d.knowledge).map((k) => `<div class="jr-know"><b>${esc(k.term)}</b>${k.term && k.explain ? '：' : ''}${esc(k.explain)}</div>`).join('');
  const legacy = !d.summary && !know && d.text ? `<div class="jr-summary">${esc(d.text)}</div>` : '';
  return `<article class="jr-entry">
    <div class="jr-date">${esc(date)}${meta ? ` <span class="jr-meta">· ${esc(meta)}</span>` : ''}</div>
    ${d.summary ? `<div class="jr-summary">${esc(d.summary)}</div>` : ''}
    ${know ? `<div class="jr-know-h">🧠 ${L({ zh: '知识点', en: 'What to learn' })}</div>${know}` : ''}
    ${legacy}
  </article>`;
}

function daysHtml() {
  const dates = Object.keys(store.days).sort().reverse();
  if (!dates.length) return `<div class="jr-empty">${L({ zh: '点上面「生成今日小结」，开始记录你的成长轨迹 🌱', en: 'Tap “Generate today’s recap” to start your growth trail 🌱' })}</div>`;
  return dates.map((d) => dayHtml(d, store.days[d])).join('');
}

function mount() {
  root.innerHTML = `
    <header class="jr-head">
      <div class="jr-title">${L({ zh: '🧠 成长日记', en: '🧠 Growth Journal' })}</div>
      <div class="jr-sub">${L({ zh: '借 AI 的力，长自己的筋骨', en: 'Borrow the AI’s strength. Grow your own.' })}</div>
    </header>
    <button class="jr-gen" id="genBtn">${L({ zh: '生成今日小结 🌱', en: 'Generate today’s recap 🌱' })}</button>
    <div class="jr-msg" id="genMsg">${esc(genMsg)}</div>
    ${todosHtml()}
    ${memoryHtml()}
    <section class="jr-block">
      <div class="jr-sec-h">📖 ${L({ zh: '日记', en: 'Journal' })}</div>
      <div class="jr-entries">${daysHtml()}</div>
    </section>
    <footer class="jr-foot">${L({ zh: '会花一点点 token（用你已在用的那个 AI）。全程本地，数据只去你本来就在用的 AI，不上传第三方。', en: 'Uses a little token (via the AI you already use). Fully local; data only goes to the AI you already use, never a third party.' })}</footer>`;
  wire();
}

function wire() {
  const $ = (s) => root.querySelector(s);
  const btn = $('#genBtn');
  btn.addEventListener('click', async () => {
    if (!api?.journalGenerate) { genMsg = L({ zh: '桌面版才能生成（要调用你本机的 AI）。', en: 'Desktop app only — it calls your local AI.' }); mount(); return; }
    btn.disabled = true;
    btn.textContent = L({ zh: '小精灵在帮你回顾今天… 🌱', en: 'Your sprite is reviewing your day… 🌱' });
    genMsg = '';
    try {
      const r = await api.journalGenerate();
      if (r && r.ok) { store = r.store; genMsg = ''; }
      else { genMsg = errMsg(r && r.reason); }
    } catch { genMsg = errMsg('ai_error'); }
    mount();
  });

  root.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('click', () => {
    const t = store.todos.find((x) => x.id === el.getAttribute('data-toggle'));
    if (t) { t.done = !t.done; save(); mount(); }
  }));
  root.querySelectorAll('[data-deltodo]').forEach((el) => el.addEventListener('click', () => {
    store.todos = store.todos.filter((x) => x.id !== el.getAttribute('data-deltodo')); save(); mount();
  }));
  root.querySelectorAll('[data-delmem]').forEach((el) => el.addEventListener('click', () => {
    store.memory = store.memory.filter((x) => x.id !== el.getAttribute('data-delmem')); save(); mount();
  }));

  const addTodo = () => {
    const inp = $('#todoAdd'); const v = inp.value.trim();
    if (!v) return; store.todos.push({ id: newId(), text: v, done: false, at: Date.now() }); save(); mount();
  };
  $('#todoAddBtn').addEventListener('click', addTodo);
  $('#todoAdd').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

  const addMem = () => {
    const inp = $('#memAdd'); const v = inp.value.trim();
    if (!v) return; store.memory.push({ id: newId(), text: v, at: Date.now() }); save(); mount();
  };
  $('#memAddBtn').addEventListener('click', addMem);
  $('#memAdd').addEventListener('keydown', (e) => { if (e.key === 'Enter') addMem(); });
}

mount();
if (api?.journalGet) {
  api.journalGet().then((s) => { if (s) store = s; mount(); }).catch(() => {});
}
