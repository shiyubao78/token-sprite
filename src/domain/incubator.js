import { drawEgg } from './gacha.js';
import { incubation } from './incubation.js';
import { speciesByKey } from '../config/species.js';

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
  return true;
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
