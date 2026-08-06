import { formatTokens } from '../domain/format.js';
import { formatYuan } from '../domain/cost.js';
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
        <div class="chip" style="color:${vm.egg.color}">${esc(vm.egg.speciesName)} · 第${vm.egg.stageNo}段 ${esc(vm.egg.stageName)}</div>
        <div class="bar"><span style="width:${vm.egg.percent}%;background:${vm.egg.color}"></span></div>
        <div class="subline">${vm.egg.percent}% · 距化形还差 ${vm.egg.toHatchText}</div>
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
    ${vm.bond.active ? `<div class="bond-badge nodrag" id="bondBadge" title="羁绊">💞 Lv.${vm.bond.level} ${esc(vm.bond.name)}${vm.bond.isMax ? '' : ` · ${vm.bond.pct}%`}</div>` : ''}
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
      <button class="nodrag hub-btn" id="usageBtn">📊 用量洞察</button>
    </div>
    <div class="field" style="margin-top:12px">
      <label>给它起个名字</label>
      <input id="nameInput" type="text" maxlength="12" value="${esc(vm.petName)}" placeholder="小苗" />
    </div>
    <div class="menu-actions">
      <button class="nodrag" id="saveBtn">保存</button>
      <button class="nodrag danger" id="quitBtn">退出</button>
    </div>
    ${vm.canAutoLaunch ? `<div class="toggle-row nodrag"><span>开机自启</span><button class="toggle" id="autoBtn">…</button></div>` : ''}
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
    <div class="source-note" style="margin-top:10px">大概率开出对应稀有度，小概率惊喜升一档（不跳档、不降档）。</div>`;
}

export function incubatorHTML(vm) {
  if (!vm.eggs.length) {
    return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>孵化器</h2>
      <div class="empty">还没有蛋 · 去抽卡开一颗吧</div>`;
  }
  const rows = vm.eggs.map((e) => `
    <div class="egg-row ${e.active ? 'active' : ''} nodrag" data-egg="${e.id}">
      <img class="egg-thumb" src="${e.thumbUrl}" alt="${esc(e.speciesName)}" />
      <div class="egg-info"><div class="en">${esc(e.speciesName)} · <span style="color:${RARITY[e.rarity].color}">${RARITY[e.rarity].name}</span></div><div class="es">${e.active ? '在养 · ' : ''}第${e.stageNo}段·${esc(e.stageName)} · ${e.percent}%</div></div>
    </div>`).join('');
  const mergeBtn = vm.mergeable > 0
    ? `<button class="merge-btn nodrag" id="mergeBtn">🔗 合并同类精灵 · ${vm.mergeable} 组可合并</button>`
    : '';
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>孵化器 · 点蛋看详情</h2>${mergeBtn}${rows}
    <div class="source-note" style="margin-top:8px">同品种的多颗蛋可以合并成一颗，喂养进度全累加、还额外送 token（越稀有送越多）。在养的蛋吃你的 token 一路进化到化形，换着养也不清零。</div>`;
}

export function usageHTML(vm) {
  const u = vm.usage;
  const fmt = (n) => formatTokens(n);
  const trend = u.trendPct == null ? ''
    : u.trendPct >= 0 ? ` <span class="up">↑${u.trendPct}%</span>` : ` <span class="down">↓${Math.abs(u.trendPct)}%</span>`;
  const tools = u.byTool.length
    ? u.byTool.map((t) => `<div class="u-tool"><span>${esc(t.label)}</span><b>今日 ${fmt(t.today)} · 周 ${fmt(t.week)}</b></div>`).join('')
    : '<div class="u-tool"><span>暂无本地可读的用量</span><b>—</b></div>';
  const bars = u.bars.map((h, i) => `<div class="u-bar" style="height:${Math.max(3, h)}%" title="${i}:00"></div>`).join('');
  const peak = u.peakHour == null ? '还没数据' : `${String(u.peakHour).padStart(2, '0')}:00 前后`;
  const c = u.cost || { todayCost: 0, weekCost: 0, yuanPerMillion: 8, budget: { hasBudget: false } };
  const b = c.budget || { hasBudget: false };
  const budgetLabel = { over: '⚠️ 今天超预算了', near: '快到今天的预算啦', ok: '今日预算' }[b.level] || '今日预算';
  const budgetBlock = b.hasBudget
    ? `<div class="u-bud ${b.level}">
        <div class="u-bud-top"><span>${budgetLabel}</span><b>${formatYuan(b.cost)} / ${formatYuan(b.budget)}</b></div>
        <div class="u-bud-bar"><span style="width:${b.pct}%"></span></div>
       </div>`
    : '';
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button>
    <h2>📊 用量洞察</h2>
    <div class="u-stat-row">
      <div class="u-stat"><div class="u-n">${fmt(u.today)}</div><div class="u-l">今日${trend}</div></div>
      <div class="u-stat"><div class="u-n">${fmt(u.week)}</div><div class="u-l">最近 7 天</div></div>
    </div>
    <div class="u-stat-row">
      <div class="u-stat"><div class="u-n">${formatYuan(c.todayCost)}</div><div class="u-l">今日花费 · 约</div></div>
      <div class="u-stat"><div class="u-n">${formatYuan(c.weekCost)}</div><div class="u-l">最近 7 天 · 约</div></div>
    </div>
    ${budgetBlock}
    <div class="u-sec">按工具</div>
    ${tools}
    <div class="u-sec">活跃时段 · 最近 7 天你几点最能写</div>
    <div class="u-hist">${bars}</div>
    <div class="u-hint">🔥 最能写：<b>${peak}</b></div>
    <div class="u-sec">花费设置</div>
    <div class="u-set">
      <label>每百万 token ≈ ¥<input class="nodrag" id="rateInput" type="number" min="0" step="0.5" value="${c.yuanPerMillion}" /></label>
      <label>每日预算 ¥<input class="nodrag" id="budgetInput" type="number" min="0" step="1" placeholder="不填=不提醒" value="${b.hasBudget ? b.budget : ''}" /></label>
    </div>
    <div class="source-note" style="margin-top:10px">花费=用量×单价的<b>粗略估算</b>（输入/输出/缓存按混合价折算，单价可自己调）。只读本机日志，不联网、不上传。</div>`;
}

export function bondHTML(vm) {
  const b = vm.bond;
  const ladder = vm.bondLevels.map((l) => {
    const reached = b.level >= l.level;
    const current = b.level === l.level;
    return `<div class="bond-row ${current ? 'current' : ''} ${reached ? '' : 'locked'}">
      <span class="bond-lv">Lv.${l.level}</span>
      <div class="bond-info"><div class="bn">${esc(l.name)}${current ? '<span class="cur">当前</span>' : ''}</div><div class="bd">${esc(l.unlock)}</div></div>
      <span class="bond-ck">${reached ? '✅' : '🔒'}</span>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button>
    <h2>💞 羁绊 · Lv.${b.level} ${esc(b.name)}</h2>
    <div class="sub-h"><span class="evo-chip">陪伴 ${vm.daysTogether} 天 · 亲密度 ${b.points}</span></div>
    <div class="bond-bar"><span style="width:${b.pct}%"></span></div>
    <div class="bond-next">${b.isMax ? '已是最高羁绊 💞' : `距 ${esc(b.nextName)} 还差 ${b.toNext} 亲密度`}</div>
    ${ladder}
    <div class="source-note" style="margin-top:10px">写代码 + 逗它都会加深羁绊（只涨不掉）。越亲，它越黏你、台词越暖。</div>`;
}

export function evolutionHTML(vm) {
  const rows = vm.stages.map((s) => {
    const thumb = s.state === 'mystery'
      ? '<div class="evo-thumb mystery">?</div>'
      : `<div class="evo-thumb ${s.state === 'locked' ? 'locked' : ''}">${s.url ? `<img src="${s.url}" alt="${esc(s.name)}" draggable="false" />` : ''}</div>`;
    let info, state;
    if (s.state === 'current') {
      info = `<div class="evo-name"><span class="seg">第${s.no}段</span>${esc(s.name)}<span class="cur">当前</span></div>
        <div class="evo-prog-wrap"><div class="evo-prog"><span style="width:${s.withinPct}%"></span></div>
        <div class="evo-prog-txt">距${esc(s.nextName)}还差 <b>${s.toNextText}</b></div></div>`;
      state = '';
    } else if (s.state === 'done') {
      info = `<div class="evo-name"><span class="seg">第${s.no}段</span>${esc(s.name)}</div><div class="evo-desc">已解锁</div>`;
      state = '✅';
    } else if (s.state === 'mystery') {
      info = `<div class="evo-name"><span class="seg">第${s.no}段</span>化形 · ？？？</div><div class="evo-desc">养满 ${vm.needText} 破壳揭晓</div>`;
      state = '<span class="lock">🔒</span>';
    } else {
      info = `<div class="evo-name"><span class="seg">第${s.no}段</span>${esc(s.name)}</div><div class="evo-desc">养到 ${s.thresholdText} 解锁</div>`;
      state = '<span class="lock">🔒</span>';
    }
    return `<div class="evo-row ${s.state}">${thumb}<div class="evo-info">${info}</div><div class="evo-state">${state}</div></div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button>
    <h2>${esc(vm.nick)} · 进化</h2>
    <div class="sub-h"><span class="evo-chip" style="color:${vm.color}">${esc(vm.speciesName)} · ${esc(vm.rarityName)} · 第${vm.current}/5段</span></div>
    ${rows}
    <div class="evo-total"><span>累计已喂 <b>${vm.fedText}</b></span><span>距化形还差 <b>${vm.toHatchText}</b></span></div>
    ${vm.active
      ? '<button class="evo-btn nodrag" disabled>在养中 🌱</button>'
      : '<button class="evo-btn nodrag" id="evoActivate">设为在养 🌱</button>'}
    <div class="source-note" style="margin-top:12px">养满一段解锁一段，进度不清零。最终「化形」保持神秘，破壳才揭晓 🎉</div>`;
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
