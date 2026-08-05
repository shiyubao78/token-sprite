import './style.css';
import { computeMood, pickBubble, ACTIVE_MS, RETURN_IDLE_MS, BURST_TOKENS } from './domain/mood.js';
import { incubation, incubationStage, evolution, STAGE_NAMES } from './domain/incubation.js';
import { drawFromTicket, ensureStarter, setActiveEgg, settleHatch } from './domain/incubator.js';
import { evaluateAchievements, computeStreak, todayStr } from './domain/achievements.js';
import { loadPet, savePet } from './services/pet-store.js';
import { LocalUsageSource } from './services/token-source.js';
import { stageUrl, adultUrl } from './services/sprites.js';
import { RARITY } from './config/rarities.js';
import { SPECIES, speciesByKey } from './config/species.js';
import { ACHIEVEMENTS } from './config/achievements.js';
import {
  mainHTML, peekHTML, menuHTML, gachaHTML, incubatorHTML, collectionHTML, achievementsHTML, evolutionHTML,
} from './ui/views.js';

const app = document.getElementById('app');
const source = new LocalUsageSource();

let state = loadPet();
let usage = { total: 0, recentTokens: 0, todayTokens: 0, lastActivityAt: Date.now(), breakdown: [] };
let collapsed = false;

let activeSince = 0;
let prevIdleMs = Infinity;
let sessionMinutesNow = 0;
const mem = { greetDate: state.greetDate || null, restSession: 0, nightSession: 0, lastBubbleAt: 0 };
const LINES = ['码力充沛，继续冲！', '今天也在悄悄长大～', '多写点，快孵出来啦', '陪你写代码最开心', '你敲的每个 token 我都收到啦'];

function growthTotal() {
  const base = state.baseline ? state.baseline.total : usage.total;
  return Math.max(0, usage.total - base);
}
function ticketTotal() {
  const t = state.tickets || {};
  return (t.common || 0) + (t.rare || 0) + (t.epic || 0) + (t.legendary || 0);
}
function addDate(arr, d) {
  if (!arr.includes(d)) { arr.push(d); if (arr.length > 200) arr.shift(); return true; }
  return false;
}
function setBubble(text) {
  const b = document.getElementById('bubble');
  if (!b) return;
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), 2600);
}

function deriveVm() {
  const growth = growthTotal();
  const idleMs = Date.now() - (usage.lastActivityAt || Date.now());
  const mood = computeMood({ idleMs, hour: new Date().getHours(), sessionMinutes: sessionMinutesNow, recentTokens: usage.recentTokens || 0, decayed: false });

  const eggsVm = (state.eggs || []).map((e) => {
    const sp = speciesByKey(e.species) || SPECIES[0];
    const active = e.id === state.activeEggId;
    // 稀有度以品种为准（修旧存档存歪的 rarity）；进度用这只自己的累积喂养，非在养也保留
    const inc = incubation(e.fed, sp.rarity);
    const stageNo = incubationStage(inc.fraction);
    return { id: e.id, rarity: sp.rarity, active, percent: pct(inc.fraction), stageNo, stageName: STAGE_NAMES[stageNo - 1], speciesName: sp.name, seedUrl: stageUrl(sp.folder, 1) };
  });

  let mode, egg = null, pet = null;
  const activeEgg = (state.eggs || []).find((e) => e.id === state.activeEggId);
  if (activeEgg) {
    const sp = speciesByKey(activeEgg.species) || SPECIES[0];
    const inc = incubation(activeEgg.fed, sp.rarity);
    const stageNo = incubationStage(inc.fraction);
    mode = 'incubating';
    egg = {
      rarity: sp.rarity,
      rarityName: RARITY[sp.rarity].name,
      color: RARITY[sp.rarity].color,
      percent: pct(inc.fraction),
      needText: formatNeed(inc.need),
      toHatchText: formatNeed(Math.max(0, inc.need - inc.fed)),
      speciesName: sp.name,
      stageNo,
      stageName: STAGE_NAMES[stageNo - 1],
      stageUrl: stageUrl(sp.folder, stageNo),
    };
  } else {
    mode = 'pet';
    const sp = speciesByKey(state.activePetSpecies) || SPECIES[0];
    pet = { name: sp.name, spriteUrl: adultUrl(sp.folder), mood };
  }

  return {
    petName: state.petName,
    isDesktop: !!(globalThis.tokenSprite && globalThis.tokenSprite.getAutoLaunch),
    canAutoLaunch: !!(globalThis.tokenSprite && globalThis.tokenSprite.getAutoLaunch) && globalThis.tokenSprite.platform !== 'linux',
    mode, egg, pet,
    ticketTotal: ticketTotal(),
    tickets: state.tickets || { common: 0, rare: 0, epic: 0, legendary: 0 },
    eggs: eggsVm,
    eggsCount: (state.eggs || []).length,
    collection: state.collection || {},
    ownedCount: Object.keys(state.collection || {}).length,
    achievements: state.achievements || {},
    achDone: Object.keys(state.achievements || {}).length,
    activePetSpecies: state.activePetSpecies,
  };
}
// 孵化进度百分比：保留两位小数（精确到 0.01%），并去掉多余的 0。
// 刚喂一点点也能看到数字在动，不会误以为「没喂进去」。
function pct(fraction) {
  const p = Math.min(100, Math.max(0, (fraction || 0) * 100));
  return parseFloat(p.toFixed(2));
}
function formatNeed(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 ? 1 : 0).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return Math.round(n / 1e6) + 'M';
  return String(n);
}

function render() {
  const vm = deriveVm();
  document.body.classList.toggle('collapsed', collapsed);
  if (collapsed) {
    app.innerHTML = peekHTML(vm);
    document.getElementById('peek')?.addEventListener('click', () => setCollapsed(false));
    return;
  }
  app.innerHTML = mainHTML(vm);
  document.getElementById('menuBtn')?.addEventListener('click', openMenu);
  document.getElementById('collapseBtn')?.addEventListener('click', () => setCollapsed(true));
  document.getElementById('tkBadge')?.addEventListener('click', openGacha);
}

let collapsedInit = false;
function setCollapsed(next) {
  collapsed = next;
  globalThis.tokenSprite?.setCollapsed?.(next);
  render();
}

function interact() {
  const sprite = document.querySelector('.sprite, .egg');
  const fx = document.getElementById('fx');
  if (sprite) { sprite.classList.remove('eating'); void sprite.offsetWidth; sprite.classList.add('eating'); }
  if (fx) {
    ['✨', '💚', '✨'].forEach((c, i) => {
      const el = document.createElement('div'); el.className = 'spark-fx'; el.textContent = c;
      el.style.left = 30 + i * 20 + '%'; fx.appendChild(el);
      requestAnimationFrame(() => el.classList.add('go')); setTimeout(() => el.remove(), 900);
    });
  }
  setBubble(LINES[Math.floor(Math.random() * LINES.length)]);
}

async function sync() {
  usage = await source.getUsage();
  if (!state.baseline) {
    state.baseline = {
      total: usage.total,
      bySource: Object.fromEntries((usage.breakdown || []).map((b) => [b.source, b.total])),
      at: Date.now(),
    };
    savePet(state);
  }
  const growth = growthTotal();
  const now = Date.now();
  const idleMs = now - (usage.lastActivityAt || now);
  const active = idleMs < ACTIVE_MS;
  if (active) { if (!activeSince) activeSince = usage.lastActivityAt || now; } else { activeSince = 0; }
  sessionMinutesNow = active && activeSince ? (now - activeSince) / 60000 : 0;
  const justReturned = active && prevIdleMs > RETURN_IDLE_MS;
  prevIdleMs = idleMs;

  // 活跃日 / 深夜日
  let dirty = false;
  const today = todayStr();
  const hour = new Date().getHours();
  if (active) {
    if (addDate(state.activeDates, today)) dirty = true;
    if (hour >= 0 && hour < 6 && addDate(state.nightDates, today)) dirty = true;
  }
  const streakDays = computeStreak(state.activeDates, today);

  // 成就结算发券
  const ctx = { growthTotal: growth, breakdown: usage.breakdown || [], todayTokens: usage.todayTokens || 0, streakDays, nightDays: (state.nightDates || []).length };
  const ach = evaluateAchievements(ctx, state.achievements);
  for (const a of ach.newly) {
    state.achievements[a.id] = { at: now };
    state.tickets[a.ticket] = (state.tickets[a.ticket] || 0) + 1;
    dirty = true;
  }

  // 首次兜底启动蛋
  if (ensureStarter(state, growth)) dirty = true;
  // 结算孵化
  const hatched = settleHatch(state, growth);
  if (hatched) dirty = true;
  if (dirty) savePet(state);

  // 台词
  const bubble = pickBubble(
    { active, hour, sessionMinutes: sessionMinutesNow, burst: (usage.recentTokens || 0) > BURST_TOKENS, justReturned, today, sessionId: activeSince || 0 },
    mem, now
  );

  render();

  if (hatched && !collapsed) {
    showHatch(hatched);
  } else if (ach.newly.length) {
    setTimeout(() => setBubble('🏆 达成成就：' + ach.newly[0].name), 300);
  } else if (bubble) {
    mem.lastBubbleAt = now;
    if (bubble.set) { Object.assign(mem, bubble.set); if (bubble.set.greetDate) { state.greetDate = bubble.set.greetDate; savePet(state); } }
    setTimeout(() => setBubble(bubble.text), 300);
  }
}

function showHatch(h) {
  const sp = speciesByKey(h.species);
  const mask = document.createElement('div');
  mask.className = 'evolve-mask nodrag';
  const url = sp ? adultUrl(sp.folder) : null;
  mask.innerHTML = `
    <div class="spark">✨ 破壳！</div>
    <div class="cap" style="color:${RARITY[h.rarity].color}">${RARITY[h.rarity].name}</div>
    ${url ? `<img src="${url}" alt="${sp.name}" />` : ''}
    <div class="name">${sp ? sp.name : '新伙伴'}</div>
    <div class="tip">已收进图鉴 · 轻触继续</div>`;
  mask.addEventListener('click', () => { mask.remove(); render(); });
  document.body.appendChild(mask);
}

function openSheet(html, bind) {
  const mask = document.createElement('div');
  mask.className = 'sheet-mask nodrag';
  mask.innerHTML = `<div class="sheet">${html}</div>`;
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => { if (e.target === mask || e.target.hasAttribute('data-close')) close(); });
  document.body.appendChild(mask);
  bind?.(mask, close);
  return { mask, close };
}

function openMenu() {
  openSheet(menuHTML(deriveVm()), (mask, close) => {
    mask.querySelector('#gachaBtn')?.addEventListener('click', () => { close(); openGacha(); });
    mask.querySelector('#incubatorBtn')?.addEventListener('click', () => { close(); openIncubator(); });
    mask.querySelector('#dexBtn')?.addEventListener('click', () => { close(); openCollection(); });
    mask.querySelector('#achBtn')?.addEventListener('click', () => { close(); openAchievements(); });
    mask.querySelector('#saveBtn')?.addEventListener('click', () => {
      const name = mask.querySelector('#nameInput').value.trim();
      state.petName = name || '小苗'; savePet(state); close(); render();
    });
    mask.querySelector('#quitBtn')?.addEventListener('click', () => { if (globalThis.tokenSprite?.quit) globalThis.tokenSprite.quit(); else close(); });
    const autoBtn = mask.querySelector('#autoBtn');
    if (autoBtn && globalThis.tokenSprite?.getAutoLaunch) {
      const paint = (on) => { autoBtn.textContent = on ? '已开启' : '已关闭'; autoBtn.classList.toggle('on', !!on); };
      globalThis.tokenSprite.getAutoLaunch().then(paint);
      autoBtn.addEventListener('click', async () => { paint(await globalThis.tokenSprite.setAutoLaunch(!autoBtn.classList.contains('on'))); });
    }
  });
}

function openGacha() {
  const { mask } = openSheet(gachaHTML(deriveVm()));
  mask.querySelectorAll('[data-draw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.getAttribute('data-draw');
      const res = drawFromTicket(state, r);
      if (!res) return;
      savePet(state);
      const sp = speciesByKey(res.egg.species);
      const rc = RARITY[res.egg.rarity];
      const box = mask.querySelector('#gachaResult');
      if (box) { box.innerHTML = `🎉 开出 <b style="color:${rc.color}">${rc.name}</b> · ${sp ? sp.name : '神秘蛋'}！去孵化器养它化形`; box.classList.add('pop'); }
      // 刷新券数
      mask.querySelectorAll('[data-draw]').forEach((b2) => {
        const rr = b2.getAttribute('data-draw');
        const n = state.tickets[rr] || 0;
        b2.disabled = !n;
        b2.parentElement.querySelector('.tk-n').textContent = '×' + n;
      });
      render();
    });
  });
}

function openIncubator() {
  const { mask } = openSheet(incubatorHTML(deriveVm()));
  mask.querySelectorAll('[data-egg]').forEach((row) => {
    row.addEventListener('click', () => {
      const egg = (state.eggs || []).find((e) => e.id === row.getAttribute('data-egg'));
      if (egg) openEvolution(egg);
    });
  });
}

function evolutionVm(egg) {
  const sp = speciesByKey(egg.species) || SPECIES[0];
  const evo = evolution(egg.fed, sp.rarity);
  const stages = evo.stages.map((s) => ({
    no: s.no,
    name: s.name,
    state: s.state,
    url: s.state === 'mystery' ? null : stageUrl(sp.folder, s.no),
    thresholdText: formatNeed(s.threshold),
    withinPct: s.withinPct != null ? Math.round(s.withinPct * 100) : null,
    nextName: s.nextName,
    toNextText: s.toNext != null ? formatNeed(s.toNext) : null,
  }));
  return {
    speciesName: sp.name,
    rarityName: RARITY[sp.rarity].name,
    color: RARITY[sp.rarity].color,
    current: evo.current,
    fedText: formatNeed(evo.fed),
    toHatchText: formatNeed(evo.toHatch),
    needText: formatNeed(evo.need),
    active: egg.id === state.activeEggId,
    stages,
  };
}

function openEvolution(egg) {
  const { mask } = openSheet(evolutionHTML(evolutionVm(egg)));
  mask.querySelector('#evoActivate')?.addEventListener('click', () => {
    setActiveEgg(state, egg.id, growthTotal());
    savePet(state);
    document.querySelectorAll('.sheet-mask').forEach((m) => m.remove()); // 关掉详情+孵化器
    render();
  });
}

function openCollection() {
  const { mask, close } = openSheet(collectionHTML(deriveVm()));
  mask.querySelectorAll('[data-battle]').forEach((cell) => {
    cell.addEventListener('click', () => {
      state.activePetSpecies = cell.getAttribute('data-battle');
      savePet(state); close(); render();
    });
  });
}

function openAchievements() {
  openSheet(achievementsHTML(deriveVm()));
}

// 拖拽（按住蛋/宠物拖窗口，轻点=互动）
let drag = null;
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('button, input, .sheet-mask, .evolve-mask')) return;
  if (!e.target.closest('.petstage, .dragbar')) return;
  drag = { mx: e.screenX, my: e.screenY, wx: 0, wy: 0, ready: false, moved: false };
  if (globalThis.tokenSprite?.getWindowPos) {
    globalThis.tokenSprite.getWindowPos().then(([x, y]) => { if (drag) { drag.wx = x; drag.wy = y; drag.ready = true; } });
  }
});
document.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const dx = e.screenX - drag.mx, dy = e.screenY - drag.my;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
  if (drag.moved && drag.ready && globalThis.tokenSprite?.setWindowPos) globalThis.tokenSprite.setWindowPos(drag.wx + dx, drag.wy + dy);
});
document.addEventListener('mouseup', () => {
  if (!drag) return;
  const tap = !drag.moved; drag = null;
  if (tap) interact();
});

render();
sync();
setInterval(() => sync(), 45000);
window.addEventListener('focus', () => sync());
