import './style.css';
import { computeMood, pickBubble, ACTIVE_MS, RETURN_IDLE_MS, BURST_TOKENS } from './domain/mood.js';
import { incubation, incubationStage, evolution, stageName } from './domain/incubation.js';
import { drawFromTicket, ensureStarter, setActiveEgg, settleHatch, mergeDuplicates, mergeableGroups, normalizeSpecies } from './domain/incubator.js';
import { evaluateAchievements, computeStreak, todayStr } from './domain/achievements.js';
import { petInteract, settleBondLevel, bondView, activateBond, BOND_LEVELS } from './domain/bond.js';
import { usageStats } from './domain/usageStats.js';
import { estimateCost, DEFAULT_USD_PER_MILLION } from './domain/cost.js';
import { loadPet, savePet } from './services/pet-store.js';
import { LocalUsageSource } from './services/token-source.js';
import { stageUrl, adultUrl } from './services/sprites.js';
import { RARITY } from './config/rarities.js';
import { SPECIES, speciesByKey, DEFAULT_NICKS } from './config/species.js';
import { ACHIEVEMENTS } from './config/achievements.js';
import { L, setLocale, getLocale, detectLocale } from './config/i18n.js';
import {
  mainHTML, peekHTML, menuHTML, gachaHTML, incubatorHTML, collectionHTML, achievementsHTML, evolutionHTML, bondHTML, usageHTML,
} from './ui/views.js';

const app = document.getElementById('app');
const source = new LocalUsageSource();

let state = loadPet();
if (normalizeSpecies(state)) savePet(state); // 迁移旧存档里已废弃的品种键
// 语言：存档里有手动选择就用它，否则跟随系统语言（zh* → 中文，其余 → 英文）。
setLocale((state.settings && state.settings.locale) || detectLocale(globalThis.tokenSprite?.locale || globalThis.navigator?.language));
let usage = { total: 0, recentTokens: 0, todayTokens: 0, lastActivityAt: Date.now(), breakdown: [] };
let collapsed = false;

let activeSince = 0;
let prevIdleMs = Infinity;
let sessionMinutesNow = 0;
const mem = { greetDate: state.greetDate || null, restSession: 0, nightSession: 0, lastBubbleAt: 0 };
// 逗它的台词按羁绊等级变暖：越亲越黏人。双语，按当前语言取。
const INTERACT_LINES = {
  1: { zh: ['你好呀～', '嘿，戳我干嘛😳', '码力充沛，继续冲！'], en: ['Hi there~', 'Hey, why the poke 😳', 'Full of code-energy, keep going!'] },
  2: { zh: ['又见面啦！', '今天也在悄悄长大～', '陪你写代码最开心'], en: ['We meet again!', 'Quietly growing today~', 'Love coding alongside you'] },
  3: { zh: ['你来啦～我一直在', '就喜欢你戳我 💚', '有你在真好'], en: ['You’re here~ I’ve been waiting', 'I like it when you poke me 💚', 'So glad you’re around'] },
  4: { zh: ['宝子，别太累哦', '我最粘你啦～', '你敲的每个 token 我都收到啦'], en: ['Don’t overwork, buddy', 'I’m so clingy with you~', 'I feel every token you type'] },
  5: { zh: ['最好的搭子就是你 💞', '一直一直陪着你', '有你这一路，值了'], en: ['You’re the best partner 💞', 'Always, always by your side', 'This whole journey with you — worth it'] },
};

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
    return { id: e.id, rarity: sp.rarity, active, percent: pct(inc.fraction), stageNo, stageName: stageName(stageNo), speciesName: sp.name, nick: sp.nick, thumbUrl: stageUrl(sp.folder, stageNo) };
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
      nick: sp.nick,
      stageNo,
      stageName: stageName(stageNo),
      stageUrl: stageUrl(sp.folder, stageNo),
    };
  } else {
    mode = 'pet';
    const sp = speciesByKey(state.activePetSpecies) || SPECIES[0];
    pet = { name: sp.name, nick: sp.nick, spriteUrl: adultUrl(sp.folder), mood };
  }

  // 名字跟着当前这只走：默认用它的昵称；若用户手动改过名（不是任何品种默认昵称）则用自定义名。
  // 用双语默认昵称集合判断，切语言后旧的默认昵称也能识别、不会被误当自定义名。
  const creatureNick = mode === 'incubating' ? egg.nick : pet.nick;
  const displayName = (state.petName && !DEFAULT_NICKS.includes(state.petName)) ? state.petName : creatureNick;

  return {
    petName: displayName,
    isDesktop: !!(globalThis.tokenSprite && globalThis.tokenSprite.getAutoLaunch),
    canAutoLaunch: !!(globalThis.tokenSprite && globalThis.tokenSprite.getAutoLaunch) && globalThis.tokenSprite.platform !== 'linux',
    mode, egg, pet,
    ticketTotal: ticketTotal(),
    tickets: state.tickets || { common: 0, rare: 0, epic: 0, legendary: 0 },
    eggs: eggsVm,
    eggsCount: (state.eggs || []).length,
    mergeable: mergeableGroups(state),
    collection: state.collection || {},
    ownedCount: Object.keys(state.collection || {}).length,
    achievements: state.achievements || {},
    achDone: Object.keys(state.achievements || {}).length,
    activePetSpecies: state.activePetSpecies,
    bond: bondView(state, growth),
    daysTogether: Math.floor((Date.now() - (state.createdAt || Date.now())) / 86400000) + 1,
    bondLevels: BOND_LEVELS,
    usage: usageVm(),
  };
}

// 花费/预算：把 token 用量套上单价折成人民币，塞进用量面板 vm。
function costSettings() {
  const s = state.settings || {};
  return {
    usdPerMillion: Number.isFinite(s.usdPerMillion) && s.usdPerMillion > 0 ? s.usdPerMillion : DEFAULT_USD_PER_MILLION,
  };
}
function usageVm() {
  const stats = usageStats(usage);
  const { usdPerMillion } = costSettings();
  const todayCost = estimateCost(stats.today, usdPerMillion);
  const weekCost = estimateCost(stats.week, usdPerMillion);
  return { ...stats, cost: { todayCost, weekCost, usdPerMillion } };
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
    // 展开交给统一的 mouseup 处理（区分轻点和拖动），这里不再单独绑 click——
    // 否则拖完松手也会当成点击，一拖就展开了。
    return;
  }
  app.innerHTML = mainHTML(vm);
  document.getElementById('menuBtn')?.addEventListener('click', openMenu);
  document.getElementById('collapseBtn')?.addEventListener('click', () => setCollapsed(true));
  document.getElementById('tkBadge')?.addEventListener('click', openGacha);
  document.getElementById('bondBadge')?.addEventListener('click', openBond);
}

function openBond() {
  openSheet(bondHTML(deriveVm()));
}

function openUsage() {
  openSheet(usageHTML(deriveVm()), (mask) => bindUsage(mask));
}
function bindUsage(mask) {
  const commit = (patch) => {
    state.settings = { ...state.settings, ...patch }; // 保留其它设置字段，只改传入的
    savePet(state);
    const sheet = mask.querySelector('.sheet');
    const top = sheet.scrollTop;
    sheet.innerHTML = usageHTML(deriveVm());
    sheet.scrollTop = top; // 改单价后保持滚动位置，别跳回顶部
    bindUsage(mask); // 重渲后重新绑定新的输入框
  };
  const rate = mask.querySelector('#rateInput');
  rate?.addEventListener('change', () => {
    const v = parseFloat(rate.value);
    commit({ usdPerMillion: Number.isFinite(v) && v > 0 ? v : DEFAULT_USD_PER_MILLION });
  });
}

let collapsedInit = false;
function setCollapsed(next) {
  collapsed = next;
  globalThis.tokenSprite?.setCollapsed?.(next);
  render();
}

globalThis.tokenSprite?.onRecall?.(() => {
  collapsed = false;
  render();
});

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
  if (petInteract(state, todayStr())) savePet(state); // 逗它 +亲密度（每日上限内）
  const lv = bondView(state, growthTotal()).level;
  const pool = L(INTERACT_LINES[lv] || INTERACT_LINES[1]);
  setBubble(pool[Math.floor(Math.random() * pool.length)]);
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
  const ctx = { growthTotal: growth, breakdown: usage.breakdown || [], todayTokens: usage.todayTokens || 0, streakDays, nightDays: (state.nightDates || []).length, ownedCount: Object.keys(state.collection || {}).length };
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
  // 首次化形后开启羁绊（化形 = 关系的开始）；之后写代码也在悄悄拉近关系
  const bondStarted = Object.keys(state.collection || {}).length > 0 && activateBond(state, growth);
  if (bondStarted) dirty = true;
  const bondUp = settleBondLevel(state, growth);
  if (bondUp) dirty = true;
  if (dirty) savePet(state);

  // 台词
  const bubble = pickBubble(
    { active, hour, sessionMinutes: sessionMinutesNow, burst: (usage.recentTokens || 0) > BURST_TOKENS, justReturned, today, sessionId: activeSince || 0 },
    mem, now
  );

  render();

  if (hatched && !collapsed) {
    showHatch(hatched);
  } else if (bondStarted) {
    setTimeout(() => setBubble(L({ zh: '💞 我们的关系，从今天开始记录～', en: '💞 Our story starts today~' })), 300);
  } else if (bondUp) {
    setTimeout(() => setBubble(L({ zh: `💞 羁绊升到 Lv.${bondUp.level} ${bondUp.name}！`, en: `💞 Bond up to Lv.${bondUp.level} ${bondUp.name}!` })), 300);
  } else if (ach.newly.length) {
    setTimeout(() => setBubble(L({ zh: '🏆 达成成就：', en: '🏆 Achievement: ' }) + ach.newly[0].name), 300);
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
    <div class="spark">${L({ zh: '✨ 破壳！', en: '✨ Hatched!' })}</div>
    <div class="cap" style="color:${RARITY[h.rarity].color}">${RARITY[h.rarity].name}</div>
    ${url ? `<img src="${url}" alt="${sp.name}" />` : ''}
    <div class="name">${sp ? sp.name : L({ zh: '新伙伴', en: 'New friend' })}</div>
    <div class="tip">${L({ zh: '已收进图鉴 · 轻触继续', en: 'Added to your collection · tap to continue' })}</div>`;
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
    mask.querySelector('#usageBtn')?.addEventListener('click', () => { close(); openUsage(); });
    mask.querySelector('#growthBtn')?.addEventListener('click', () => { close(); globalThis.tokenSprite?.openJournal?.(); });
    mask.querySelector('#saveBtn')?.addEventListener('click', () => {
      const name = mask.querySelector('#nameInput').value.trim();
      state.petName = name || '小苗'; savePet(state); close(); render();
    });
    mask.querySelector('#quitBtn')?.addEventListener('click', () => { if (globalThis.tokenSprite?.quit) globalThis.tokenSprite.quit(); else close(); });
    const autoBtn = mask.querySelector('#autoBtn');
    if (autoBtn && globalThis.tokenSprite?.getAutoLaunch) {
      const paint = (on) => { autoBtn.textContent = on ? L({ zh: '已开启', en: 'On' }) : L({ zh: '已关闭', en: 'Off' }); autoBtn.classList.toggle('on', !!on); };
      globalThis.tokenSprite.getAutoLaunch().then(paint);
      autoBtn.addEventListener('click', async () => { paint(await globalThis.tokenSprite.setAutoLaunch(!autoBtn.classList.contains('on'))); });
    }
    mask.querySelector('#langBtn')?.addEventListener('click', () => {
      const next = getLocale() === 'en' ? 'zh' : 'en';
      setLocale(next);
      state.settings = { ...state.settings, locale: next };
      savePet(state);
      close();
      render();
      openMenu(); // 用新语言重开菜单，即时看到切换效果
    });
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
      if (box) { box.innerHTML = L({ zh: `🎉 开出 <b style="color:${rc.color}">${rc.name}</b> · ${sp ? sp.name : '神秘蛋'}！去孵化器养它化形`, en: `🎉 Got a <b style="color:${rc.color}">${rc.name}</b> · ${sp ? sp.name : 'mystery egg'}! Raise it in the incubator` }); box.classList.add('pop'); }
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
  const { mask, close } = openSheet(incubatorHTML(deriveVm()));
  mask.querySelectorAll('[data-egg]').forEach((row) => {
    row.addEventListener('click', () => {
      const egg = (state.eggs || []).find((e) => e.id === row.getAttribute('data-egg'));
      if (egg) openEvolution(egg);
    });
  });
  mask.querySelectorAll('[data-set]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // 别触发行的"打开详情"
      setActiveEgg(state, btn.getAttribute('data-set'), growthTotal());
      savePet(state);
      close();
      render();
      openIncubator(); // 刷新列表，新在养的置顶高亮
    });
  });
  mask.querySelector('#mergeBtn')?.addEventListener('click', () => {
    const res = mergeDuplicates(state);
    if (!res) return;
    savePet(state);
    const total = res.merged.reduce((s, m) => s + m.count, 0);
    close();
    render();
    setBubble(L({ zh: `✨ 合并 ${total} 只 · 进度 +${formatNeed(res.totalGained)} token`, en: `✨ Merged ${total} · progress +${formatNeed(res.totalGained)} tokens` }));
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
    nick: sp.nick,
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

// 拖东西喂它：选中网页上的文字拖到桌宠身上，或者拖个文本文件进来。
// 网页版 AI（豆包/ChatGPT 等）的对话在服务端，本地读不到，只能靠这条路收进来。
// 收进来先攒着，等下次生成成长小结时一起消化——当场调 AI 要十几秒，喂个东西不该卡。
const FEED_MAX_FILE = 1 << 20; // 1MB，再大多半不是对话

async function textFromDrop(dt) {
  const plain = dt.getData('text/plain');
  if (plain && plain.trim()) return plain;
  const file = dt.files && dt.files[0];
  if (!file) return '';
  if (file.size > FEED_MAX_FILE) return '';
  // 只吃文本类；二进制读出来是乱码，喂给 AI 纯属浪费
  if (file.type && !/^text\/|json|markdown/.test(file.type)) return '';
  try { return await file.text(); } catch { return ''; }
}

function setFeedHint(on) {
  document.body.classList.toggle('feeding', on);
}

document.addEventListener('dragover', (e) => { e.preventDefault(); setFeedHint(true); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) setFeedHint(false); });
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  setFeedHint(false);
  if (!globalThis.tokenSprite?.journalIngest) return; // 浏览器里跑没有这个能力
  const text = await textFromDrop(e.dataTransfer);
  if (!text.trim()) { setBubble(L({ zh: '这个我嚼不动…', en: 'Can’t chew that…' })); return; }
  showFed(await globalThis.tokenSprite.journalIngest(text, 'drop').catch(() => null));
});

// 吃东西的动画 + 气泡：拖进来和按快捷键共用同一套反馈
function showFed(r) {
  const sprite = document.querySelector('.sprite, .egg');
  if (sprite) { sprite.classList.remove('eating'); void sprite.offsetWidth; sprite.classList.add('eating'); }
  if (r && r.ok) {
    setBubble(L({ zh: '吃到啦，记进成长日记 🌱', en: 'Yum — saved to your journal 🌱' }));
  } else if (r && r.reason === 'empty') {
    setBubble(L({ zh: '剪贴板是空的哦', en: 'Nothing on your clipboard' }));
  } else {
    setBubble(L({ zh: '没吃进去，再试一次？', en: 'Didn’t go down, try again?' }));
  }
}

// ⌘⇧V：复制一段话后按一下，直接喂给它（比选中再拖省事）
globalThis.tokenSprite?.onFed?.(showFed);

// 拖拽（按住蛋/宠物拖窗口，轻点=互动）
let drag = null;
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('button, input, .sheet-mask, .evolve-mask')) return;
  if (!e.target.closest('.petstage, .dragbar, .peek')) return;
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
  if (tap) {
    if (collapsed) setCollapsed(false); // 收起态轻点=展开
    else interact();                    // 展开态轻点=逗它
  } else if (collapsed) {
    globalThis.tokenSprite?.snapEdge?.(); // 拖完吸到最近的边
  }
});

render();
sync();
setInterval(() => sync(), 45000);
window.addEventListener('focus', () => sync());
