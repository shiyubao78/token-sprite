import { drawEgg } from './gacha.js';
import { incubation } from './incubation.js';
import { speciesByKey } from '../config/species.js';
import { MERGE_BONUS } from '../config/rarities.js';

let eggSeq = 0;
export function makeEgg(rarity, species) {
  return { id: 'e' + Date.now().toString(36) + '-' + eggSeq++, rarity, species, at: Date.now(), fed: 0 };
}

// 这颗蛋真正的稀有度以「品种」为准（品种与稀有度一一对应）；旧存档里存歪的 rarity 不再作数。
export function eggRarity(egg) {
  const sp = speciesByKey(egg.species);
  return (sp && sp.rarity) || egg.rarity;
}

function activeEgg(state) {
  return state.activeEggId ? state.eggs.find((e) => e.id === state.activeEggId) || null : null;
}

// 记账：把「距上次记账以来新增的 token」喂给当前放在桌面上（在养）的那一只。
// 每只蛋各记各的 fed，切换在养对象只是换谁吃后续增量，谁的进度都不清零。
// lastGrowth 为 null 时视为首次/迁移：初始化每只 fed，并把旧存档在孵进度换算过来，然后只记基准、不发放。
export function accrue(state, growth) {
  const g = Math.max(0, growth || 0);
  if (state.lastGrowth == null) {
    for (const e of state.eggs) if (e.fed == null) e.fed = 0;
    const cur = activeEgg(state);
    if (cur && state.incubationStart != null) {
      cur.fed = Math.max(cur.fed || 0, g - (state.incubationStart || 0));
    }
    state.lastGrowth = g;
    return;
  }
  const delta = g - state.lastGrowth;
  state.lastGrowth = g;
  if (delta > 0) {
    const cur = activeEgg(state);
    if (cur) cur.fed = (cur.fed || 0) + delta;
  }
}

// 抽卡：消耗一张 ticketRarity 券 → 得一颗蛋放进 eggs。返回 {egg} 或 null(没券)。
export function drawFromTicket(state, ticketRarity, rng = Math.random) {
  if (!state.tickets || !state.tickets[ticketRarity]) return null;
  const res = drawEgg(ticketRarity, rng);
  if (!res) return null;
  state.tickets[ticketRarity] -= 1;
  const egg = makeEgg(res.rarity, res.species);
  state.eggs.push(egg);
  return { egg };
}

// 首次兜底：没蛋、没在孵、没图鉴 → 送一颗普通启动蛋并设为在孵。返回是否触发。
export function ensureStarter(state, _growth, rng = Math.random) {
  const has = state.eggs.length || state.activeEggId || Object.keys(state.collection || {}).length;
  if (has) return false;
  const res = drawEgg('common', rng);
  const egg = makeEgg(res.rarity, res.species);
  state.eggs.push(egg);
  state.activeEggId = egg.id;
  // 首个精灵的默认名跟随启动的这只（贝壳→小贝、萌芽→小苗…）；用户随时可改名。
  const sp = speciesByKey(res.species);
  if (sp && sp.nick && (!state.petName || state.petName === '小苗')) state.petName = sp.nick;
  return true;
}

// 可合并的品种组数（同一品种有 ≥2 颗蛋才算一组）。给 UI 判断要不要显示合并按钮。
export function mergeableGroups(state) {
  const count = {};
  for (const e of state.eggs || []) count[e.species] = (count[e.species] || 0) + 1;
  return Object.values(count).filter((n) => n >= 2).length;
}

// 合并同类蛋：每个品种的多颗蛋并成一颗，fed 全累加 + 每多合并一颗送 MERGE_BONUS[稀有度]。
// 保留在养的那颗（在组里的话），否则保留第一颗。返回 { merged:[{species,count,gained}], totalGained } 或 null（无可合并）。
export function mergeDuplicates(state) {
  const eggs = state.eggs || [];
  const bySpecies = {};
  for (const e of eggs) (bySpecies[e.species] = bySpecies[e.species] || []).push(e);
  const keep = [];
  const merged = [];
  for (const group of Object.values(bySpecies)) {
    if (group.length < 2) { keep.push(...group); continue; }
    const rarity = eggRarity(group[0]);
    const gained = (MERGE_BONUS[rarity] || 0) * (group.length - 1);
    const fedSum = group.reduce((s, e) => s + (e.fed || 0), 0);
    const survivor = group.find((e) => e.id === state.activeEggId) || group[0];
    survivor.fed = fedSum + gained;
    keep.push(survivor);
    merged.push({ species: group[0].species, count: group.length, gained });
  }
  if (!merged.length) return null;
  state.eggs = keep;
  return { merged, totalGained: merged.reduce((s, m) => s + m.gained, 0) };
}

// 切换在养对象：先把到目前为止的增量结算给当前这只，再换人；两边进度都保留。
export function setActiveEgg(state, eggId, growth) {
  if (!state.eggs.find((e) => e.id === eggId)) return false;
  accrue(state, growth);
  state.activeEggId = eggId;
  return true;
}

// 结算孵化：在养蛋的自身累积喂养喂够门槛 → 破壳进图鉴。返回 { rarity, species } 或 null。
export function settleHatch(state, growth) {
  accrue(state, growth);
  const egg = activeEgg(state);
  if (!egg) { state.activeEggId = null; return null; }
  const rarity = eggRarity(egg);
  const inc = incubation(egg.fed, rarity);
  if (!inc.done) return null;
  const c = state.collection[egg.species] || { count: 0, firstAt: Date.now() };
  c.count += 1;
  state.collection[egg.species] = c;
  state.eggs = state.eggs.filter((e) => e.id !== egg.id);
  state.activeEggId = null;
  if (!state.activePetSpecies) state.activePetSpecies = egg.species;
  return { rarity, species: egg.species };
}
