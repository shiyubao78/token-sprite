import { drawEgg } from './gacha.js';
import { incubation } from './incubation.js';

let eggSeq = 0;
export function makeEgg(rarity, species) {
  return { id: 'e' + Date.now().toString(36) + '-' + eggSeq++, rarity, species, at: Date.now() };
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
export function ensureStarter(state, growthTotal, rng = Math.random) {
  const has = state.eggs.length || state.activeEggId || Object.keys(state.collection || {}).length;
  if (has) return false;
  const res = drawEgg('common', rng);
  const egg = makeEgg(res.rarity, res.species);
  state.eggs.push(egg);
  state.activeEggId = egg.id;
  state.incubationStart = growthTotal;
  return true;
}

export function setActiveEgg(state, eggId, growthTotal) {
  if (!state.eggs.find((e) => e.id === eggId)) return false;
  state.activeEggId = eggId;
  state.incubationStart = growthTotal;
  return true;
}

// 结算孵化：在孵蛋喂够 → 破壳进图鉴。返回 { rarity, species } 或 null。
export function settleHatch(state, growthTotal) {
  if (!state.activeEggId) return null;
  const egg = state.eggs.find((e) => e.id === state.activeEggId);
  if (!egg) { state.activeEggId = null; return null; }
  const inc = incubation(growthTotal, state.incubationStart, egg.rarity);
  if (!inc.done) return null;
  const c = state.collection[egg.species] || { count: 0, firstAt: Date.now() };
  c.count += 1;
  state.collection[egg.species] = c;
  state.eggs = state.eggs.filter((e) => e.id !== egg.id);
  state.activeEggId = null;
  if (!state.activePetSpecies) state.activePetSpecies = egg.species;
  return { rarity: egg.rarity, species: egg.species };
}
