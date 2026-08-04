import { formatTokens } from '../domain/format.js';
import { RARITY } from '../config/rarities.js';
import { SPECIES, speciesByKey } from '../config/species.js';
import { ACHIEVEMENTS } from '../config/achievements.js';
import { adultUrl } from '../services/sprites.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function mainHTML(vm) {
  let stage, info;
  if (vm.mode === 'incubating') {
    stage = `
      <div class="petstage nodrag" id="petStage">
        <div class="sprite-ground"></div>
        <img class="sprite" id="sprite" src="${vm.egg.stageUrl}" alt="孵化中" draggable="false" />
        <div class="fx" id="fx"></div>
        <div class="bubble" id="bubble"></div>
      </div>`;
    info = `
      <div class="petinfo">
        <div class="chip" style="color:${vm.egg.color}">${esc(vm.egg.speciesName)} · 孵化中</div>
        <div class="bar"><span style="width:${vm.egg.percent}%;background:${vm.egg.color}"></span></div>
        <div class="subline">${vm.egg.percent}% · 喂它 ${vm.egg.needText} 化形</div>
      </div>`;
  } else {
    stage = `
      <div class="petstage nodrag" id="petStage">
        <div class="sprite-ground"></div>
        ${vm.pet.spriteUrl ? `<img class="sprite mood-${vm.pet.mood}" id="sprite" src="${vm.pet.spriteUrl}" alt="${esc(vm.pet.name)}" draggable="false" />` : ''}
        <div class="fx" id="fx"></div>
        <div class="bubble" id="bubble"></div>
      </div>`;
    info = `
      <div class="petinfo">
        <div class="chip">${esc(vm.pet.name)}</div>
        <div class="subline">${vm.eggsCount > 0 ? '孵化器有蛋 · 去挑一颗养' : '陪着你 · 攒券抽新蛋'}</div>
      </div>`;
  }
  const badge = vm.ticketTotal > 0 ? `<span class="tk-badge" id="tkBadge">🎴 ${vm.ticketTotal}</span>` : '';
  return `
    <div class="dragbar">
      <span class="pet-name">${esc(vm.petName)}</span>
      <div class="bar-btns">
        ${badge}
        <button class="menu-btn nodrag" id="collapseBtn" aria-label="收起到边上">»</button>
        <button class="menu-btn nodrag" id="menuBtn" aria-label="菜单">⋯</button>
      </div>
    </div>
    ${stage}
    ${info}
  `;
}

export function peekHTML(vm) {
  const url = vm.mode === 'incubating' ? vm.egg.stageUrl : vm.pet.spriteUrl;
  const inner = url ? `<img class="peek-sprite ${vm.mode === 'pet' ? 'mood-' + vm.pet.mood : ''}" src="${url}" alt="宠物" draggable="false" />` : '';
  return `<div class="peek" id="peek" title="点我展开">${inner}</div>`;
}

export function menuHTML(vm) {
  return `
    <button class="close nodrag" data-close aria-label="关闭">✕</button>
    <h2>${esc(vm.petName)}</h2>
    <div class="hub">
      <button class="nodrag hub-btn" id="gachaBtn">🎴 抽卡${vm.ticketTotal ? ` · ${vm.ticketTotal}` : ''}</button>
      <button class="nodrag hub-btn" id="incubatorBtn">🥚 孵化器${vm.eggsCount ? ` · ${vm.eggsCount}` : ''}</button>
      <button class="nodrag hub-btn" id="dexBtn">📖 图鉴 · ${vm.ownedCount}/${SPECIES.length}</button>
      <button class="nodrag hub-btn" id="achBtn">🏆 成就 · ${vm.achDone}/${ACHIEVEMENTS.length}</button>
    </div>
    <div class="field" style="margin-top:12px">
      <label>给它起个名字</label>
      <input id="nameInput" type="text" maxlength="12" value="${esc(vm.petName)}" placeholder="小苗" />
    </div>
    <div class="menu-actions">
      <button class="nodrag" id="saveBtn">保存</button>
      <button class="nodrag danger" id="quitBtn">退出</button>
    </div>
    ${vm.isDesktop ? `<div class="toggle-row nodrag"><span>开机自启</span><button class="toggle" id="autoBtn">…</button></div>` : ''}
    <div class="source-note" style="margin-top:12px">自动检测本地 AI 工具用量，token 用来孵蛋养成、集齐图鉴。</div>
  `;
}

export function gachaHTML(vm) {
  const rows = ['common', 'rare', 'epic', 'legendary'].map((r) => {
    const n = vm.tickets[r] || 0;
    return `<div class="tk-row">
      <span class="tk-dot" style="background:${RARITY[r].color}"></span>
      <span class="tk-name">${RARITY[r].name}券</span>
      <span class="tk-n">×${n}</span>
      <button class="tk-draw nodrag" data-draw="${r}" ${n ? '' : 'disabled'}>抽</button>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>抽卡</h2>
    <div class="gacha-result" id="gachaResult">达成成就攒券，抽卡开出不同稀有度的蛋</div>
    ${rows}
    <div class="source-note" style="margin-top:10px">大概率开出对应稀有度，小概率有惊喜（升/降档）。</div>`;
}

export function incubatorHTML(vm) {
  if (!vm.eggs.length) {
    return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>孵化器</h2>
      <div class="empty">还没有蛋 · 去抽卡开一颗吧</div>`;
  }
  const rows = vm.eggs.map((e) => `
    <div class="egg-row ${e.active ? 'active' : ''} nodrag" data-egg="${e.id}">
      <img class="egg-thumb" src="${e.seedUrl}" alt="${esc(e.speciesName)}" />
      <div class="egg-info"><div class="en">${esc(e.speciesName)} · <span style="color:${RARITY[e.rarity].color}">${RARITY[e.rarity].name}</span></div><div class="es">${e.active ? `孵化中 · ${e.percent}%` : '点我开始养'}</div></div>
      ${e.active ? '<span class="egg-badge">在养</span>' : ''}
    </div>`).join('');
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>孵化器 · 选一颗养</h2>${rows}
    <div class="source-note" style="margin-top:8px">在养的蛋会吃你的 token，一路进化到化形。换一颗养，进度从头算。</div>`;
}

export function collectionHTML(vm) {
  const cells = SPECIES.map((s) => {
    const owned = vm.collection[s.key];
    return `<div class="dex-cell ${owned ? 'owned nodrag' : 'locked'}" ${owned ? `data-battle="${s.key}"` : ''}>
      <div class="dex-pic" style="--rc:${RARITY[s.rarity].color}">
        ${owned ? `<img src="${adultUrl(s.folder)}" alt="${esc(s.name)}" />` : '<span class="qm">?</span>'}
        ${owned && owned.count > 1 ? `<span class="cnt">×${owned.count}</span>` : ''}
        ${vm.activePetSpecies === s.key ? '<span class="battle">陪伴中</span>' : ''}
      </div>
      <div class="dex-nm">${owned ? esc(s.name) : '？？？'}</div>
      <div class="dex-rr" style="color:${RARITY[s.rarity].color}">${RARITY[s.rarity].name}</div>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>图鉴 · ${vm.ownedCount}/${SPECIES.length}</h2>
    <div class="dex-grid">${cells}</div>
    <div class="source-note" style="margin-top:8px">点已获得的品种，让它陪你。</div>`;
}

export function achievementsHTML(vm) {
  const rows = ACHIEVEMENTS.map((a) => {
    const done = !!vm.achievements[a.id];
    return `<div class="ach-row ${done ? 'done' : ''}">
      <span class="ach-ck">${done ? '✅' : '⬜'}</span>
      <div class="ach-info"><div class="an">${esc(a.name)}</div><div class="ad">${esc(a.desc)}</div></div>
      <span class="ach-tk" style="color:${RARITY[a.ticket].color}">${RARITY[a.ticket].name}券</span>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>成就 · ${vm.achDone}/${ACHIEVEMENTS.length}</h2>${rows}
    <div class="source-note" style="margin-top:8px">达成成就得券，用券抽蛋。全用你的真实用量判定。</div>`;
}

export { speciesByKey };
