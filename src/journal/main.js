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

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 极简 Markdown 渲染：## 小标题 / - [ ] 待办 / - 列表 / **加粗** / 段落。先转义再套结构，安全。
function renderMd(md) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lines = String(md || '').split('\n');
  let html = '', inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (let line of lines) {
    const t = line.trim();
    if (!t) { closeList(); continue; }
    let m;
    if ((m = t.match(/^#{1,6}\s+(.*)$/))) { closeList(); html += `<h3>${inline(m[1])}</h3>`; }
    else if ((m = t.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
      closeList(); const done = m[1].toLowerCase() === 'x';
      html += `<div class="jr-todo ${done ? 'done' : ''}"><span class="jr-box">${done ? '☑' : '☐'}</span><span>${inline(m[2])}</span></div>`;
    } else if ((m = t.match(/^[-*]\s+(.*)$/))) {
      if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(m[1])}</li>`;
    } else { closeList(); html += `<p>${inline(t)}</p>`; }
  }
  closeList();
  return html;
}

function entryCard(date, entry) {
  const tools = (entry.tools || []).join(' / ');
  const meta = L({ zh: `汇总 ${tools} 共 ${entry.count} 条`, en: `${entry.count} prompts across ${tools}` });
  return `<article class="jr-entry">
    <div class="jr-date">${esc(date)} <span class="jr-meta">· ${esc(meta)}</span></div>
    <div class="jr-body">${renderMd(entry.text)}</div>
  </article>`;
}

function errMsg(reason) {
  const m = {
    no_prompts: L({ zh: '今天还没有和 AI 的对话记录，先去写会儿代码吧～', en: 'No AI chats yet today — go write some code first ~' }),
    no_ai: L({ zh: '没检测到 Claude Code / Codex 命令。装了其中一个才能生成。', en: 'No Claude Code / Codex command found. Install one to use this.' }),
    timeout: L({ zh: 'AI 想太久超时了，稍后再试～', en: 'The AI took too long. Try again later.' }),
  };
  return m[reason] || L({ zh: '生成失败了，稍后再试～', en: 'Something went wrong. Try again later.' });
}

let journal = {};
function renderEntries() {
  const dates = Object.keys(journal).sort().reverse();
  const box = document.getElementById('entries');
  if (!dates.length) {
    box.innerHTML = `<div class="jr-empty">${L({ zh: '还没有日记。点上面「生成今日小结」，开始记录你的成长轨迹 🌱', en: 'No entries yet. Tap “Generate today’s recap” above to start your growth trail 🌱' })}</div>`;
    return;
  }
  box.innerHTML = dates.map((d) => entryCard(d, journal[d])).join('');
}

function view() {
  root.innerHTML = `
    <header class="jr-head">
      <div class="jr-title">${L({ zh: '🧠 成长日记', en: '🧠 Growth Journal' })}</div>
      <div class="jr-sub">${L({ zh: '别只烧 token——也让它帮你长本事、帮你记事', en: 'Don’t just burn tokens — grow from them, and remember what matters' })}</div>
    </header>
    <button class="jr-gen" id="genBtn">${L({ zh: '生成今日小结 🌱', en: 'Generate today’s recap 🌱' })}</button>
    <div class="jr-msg" id="genMsg"></div>
    <div class="jr-entries" id="entries"></div>
    <footer class="jr-foot">${L({ zh: '会花一点点 token（用你已在用的那个 AI）。全程本地，数据只去你本来就在用的 AI，不上传第三方。', en: 'Uses a little token (via the AI you already use). Fully local; data only goes to the AI you already use, never a third party.' })}</footer>`;

  const btn = document.getElementById('genBtn');
  const msg = document.getElementById('genMsg');
  btn.addEventListener('click', async () => {
    if (!api?.journalGenerate) { msg.textContent = L({ zh: '桌面版才能生成（要调用你本机的 AI）。', en: 'Desktop app only — it calls your local AI.' }); return; }
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = L({ zh: '小精灵在帮你回顾今天… 🌱', en: 'Your sprite is reviewing your day… 🌱' });
    msg.textContent = '';
    try {
      const r = await api.journalGenerate();
      if (r && r.ok) { journal[r.date] = r.entry; renderEntries(); }
      else { msg.textContent = errMsg(r && r.reason); }
    } catch { msg.textContent = errMsg('ai_error'); }
    btn.disabled = false; btn.textContent = orig;
  });
  renderEntries();
}

view();
if (api?.journalList) {
  api.journalList().then((j) => { journal = j || {}; renderEntries(); }).catch(() => {});
}
