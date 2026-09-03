import { formatTokens } from '../domain/format.js';
import { formatMoney } from '../domain/cost.js';
import { RARITY } from '../config/rarities.js';
import { SPECIES, speciesByKey } from '../config/species.js';
import { ACHIEVEMENTS } from '../config/achievements.js';
import { adultUrl } from '../services/sprites.js';
import { L, getLocale } from '../config/i18n.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 「第 n 段」/「Stage n」段位标签，随语言切换。
const seg = (no) => L({ zh: `第${no}段`, en: `Stage ${no}` });
// 稀有度券后缀：普通券 / Common ticket。
const tk = () => L({ zh: '券', en: ' ticket' });

export function mainHTML(vm) {
  let stage, info;
  if (vm.mode === 'incubating') {
    stage = `
      <div class="petstage nodrag" id="petStage">
        <div class="sprite-ground"></div>
        <img class="sprite" id="sprite" src="${vm.egg.stageUrl}" alt="${L({ zh: '孵化中', en: 'Incubating' })}" draggable="false" />
        <div class="fx" id="fx"></div>
        <div class="bubble" id="bubble"></div>
      </div>`;
    info = `
      <div class="petinfo">
        <div class="chip" style="color:${vm.egg.color}">${esc(vm.egg.speciesName)} · ${seg(vm.egg.stageNo)} ${esc(vm.egg.stageName)}</div>
        <div class="bar"><span style="width:${vm.egg.percent}%;background:${vm.egg.color}"></span></div>
        <div class="subline">${vm.egg.percent}% · ${L({ zh: `距化形还差 ${vm.egg.toHatchText}`, en: `${vm.egg.toHatchText} to awaken` })}</div>
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
        <div class="subline">${vm.eggsCount > 0 ? L({ zh: '孵化器有蛋 · 去挑一颗养', en: 'Eggs waiting · pick one to raise' }) : L({ zh: '陪着你 · 攒券抽新蛋', en: 'Here with you · save tickets for new eggs' })}</div>
      </div>`;
  }
  const badge = vm.ticketTotal > 0 ? `<span class="tk-badge" id="tkBadge">🎴 ${vm.ticketTotal}</span>` : '';
  return `
    <div class="dragbar">
      <span class="pet-name">${esc(vm.petName)}</span>
      <div class="bar-btns">
        ${badge}
        <button class="menu-btn nodrag" id="collapseBtn" aria-label="${L({ zh: '收起到边上', en: 'Collapse' })}">»</button>
        <button class="menu-btn nodrag" id="menuBtn" aria-label="${L({ zh: '菜单', en: 'Menu' })}">⋯</button>
      </div>
    </div>
    ${stage}
    ${info}
    ${vm.bond.active ? `<div class="bond-badge nodrag" id="bondBadge" title="${L({ zh: '羁绊', en: 'Bond' })}">💞 Lv.${vm.bond.level} ${esc(vm.bond.name)}${vm.bond.isMax ? '' : ` · ${vm.bond.pct}%`}</div>` : ''}
  `;
}

export function peekHTML(vm) {
  const url = vm.mode === 'incubating' ? vm.egg.stageUrl : vm.pet.spriteUrl;
  const inner = url ? `<img class="peek-sprite ${vm.mode === 'pet' ? 'mood-' + vm.pet.mood : ''}" src="${url}" alt="${L({ zh: '宠物', en: 'Pet' })}" draggable="false" />` : '';
  return `<div class="peek" id="peek" title="${L({ zh: '点我展开', en: 'Tap to open' })}">${inner}</div>`;
}

export function menuHTML(vm) {
  return `
    <button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button>
    <h2>${esc(vm.petName)}</h2>
    <div class="hub">
      <button class="nodrag hub-btn" id="gachaBtn">${L({ zh: '🎴 抽卡', en: '🎴 Gacha' })}${vm.ticketTotal ? ` · ${vm.ticketTotal}` : ''}</button>
      <button class="nodrag hub-btn" id="incubatorBtn">${L({ zh: '🥚 孵化器', en: '🥚 Eggs' })}${vm.eggsCount ? ` · ${vm.eggsCount}` : ''}</button>
      <button class="nodrag hub-btn" id="dexBtn">${L({ zh: '📖 图鉴', en: '📖 Dex' })} · ${vm.ownedCount}/${SPECIES.length}</button>
      <button class="nodrag hub-btn" id="achBtn">${L({ zh: '🏆 成就', en: '🏆 Awards' })} · ${vm.achDone}/${ACHIEVEMENTS.length}</button>
      <button class="nodrag hub-btn" id="usageBtn">${L({ zh: '📊 用量洞察', en: '📊 Usage' })}</button>
      <button class="nodrag hub-btn" id="growthBtn">${L({ zh: '🧠 成长小结', en: '🧠 Growth' })}</button>
    </div>
    <div class="field" style="margin-top:12px">
      <label>${L({ zh: '给它起个名字', en: 'Give it a name' })}</label>
      <input id="nameInput" type="text" maxlength="12" value="${esc(vm.petName)}" placeholder="${L({ zh: '小苗', en: 'Sprout' })}" />
    </div>
    <div class="menu-actions">
      <button class="nodrag" id="saveBtn">${L({ zh: '保存', en: 'Save' })}</button>
      <button class="nodrag danger" id="quitBtn">${L({ zh: '退出', en: 'Quit' })}</button>
    </div>
    ${vm.canAutoLaunch ? `<div class="toggle-row nodrag"><span>${L({ zh: '开机自启', en: 'Launch at login' })}</span><button class="toggle" id="autoBtn">…</button></div>` : ''}
    <div class="toggle-row nodrag"><span>${L({ zh: '语言 / Language', en: 'Language / 语言' })}</span><button class="toggle on" id="langBtn">${getLocale() === 'en' ? 'English' : '中文'}</button></div>
    <div class="source-note" style="margin-top:12px">${L({ zh: '自动检测本地 AI 工具用量，token 用来孵蛋养成、集齐图鉴。', en: 'Reads your local AI-tool usage; tokens hatch, raise, and complete your collection.' })}</div>
  `;
}

export function gachaHTML(vm) {
  const rows = ['common', 'rare', 'epic', 'legendary'].map((r) => {
    const n = vm.tickets[r] || 0;
    return `<div class="tk-row">
      <span class="tk-dot" style="background:${RARITY[r].color}"></span>
      <span class="tk-name">${RARITY[r].name}${tk()}</span>
      <span class="tk-n">×${n}</span>
      <button class="tk-draw nodrag" data-draw="${r}" ${n ? '' : 'disabled'}>${L({ zh: '抽', en: 'Draw' })}</button>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button><h2>${L({ zh: '抽卡', en: 'Gacha' })}</h2>
    <div class="gacha-result" id="gachaResult">${L({ zh: '达成成就攒券，抽卡开出不同稀有度的蛋', en: 'Earn tickets from achievements; draw eggs of different rarities' })}</div>
    ${rows}
    <div class="source-note" style="margin-top:10px">${L({ zh: '大概率开出对应稀有度，小概率惊喜升一档（不跳档、不降档）。', en: 'Usually the matching rarity, with a small chance to bump up one tier (never skips or drops).' })}</div>`;
}

export function incubatorHTML(vm) {
  if (!vm.eggs.length) {
    return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button><h2>${L({ zh: '孵化器', en: 'Incubator' })}</h2>
      <div class="empty">${L({ zh: '还没有蛋 · 去抽卡开一颗吧', en: 'No eggs yet · go draw one' })}</div>`;
  }
  const rows = vm.eggs.map((e) => `
    <div class="egg-row ${e.active ? 'active' : ''} nodrag" data-egg="${e.id}">
      <img class="egg-thumb" src="${e.thumbUrl}" alt="${esc(e.speciesName)}" />
      <div class="egg-info"><div class="en">${esc(e.speciesName)} · <span style="color:${RARITY[e.rarity].color}">${RARITY[e.rarity].name}</span></div><div class="es">${e.active ? L({ zh: '在养 · ', en: 'Raising · ' }) : ''}${seg(e.stageNo)}·${esc(e.stageName)} · ${e.percent}%</div>${e.active ? '' : `<button class="egg-set nodrag" data-set="${e.id}">${L({ zh: '设为在养 🌱', en: 'Set active 🌱' })}</button>`}</div>
    </div>`).join('');
  const mergeBtn = vm.mergeable > 0
    ? `<button class="merge-btn nodrag" id="mergeBtn">${L({ zh: `🔗 合并同类精灵 · ${vm.mergeable} 组可合并`, en: `🔗 Merge duplicates · ${vm.mergeable} group(s)` })}</button>`
    : '';
  return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button><h2>${L({ zh: '孵化器 · 点蛋看详情', en: 'Incubator · tap an egg for details' })}</h2>${mergeBtn}${rows}
    <div class="source-note" style="margin-top:8px">${L({ zh: '同品种的多颗蛋可以合并成一颗，喂养进度全累加、还额外送 token（越稀有送越多）。在养的蛋吃你的 token 一路进化到化形，换着养也不清零。', en: 'Merge duplicate eggs into one — progress stacks and you get bonus tokens (rarer = more). The active egg eats your tokens toward awakening; switching never resets progress.' })}</div>`;
}

export function usageHTML(vm) {
  const u = vm.usage;
  const fmt = (n) => formatTokens(n);
  const trend = u.trendPct == null ? ''
    : u.trendPct >= 0 ? ` <span class="up">↑${u.trendPct}%</span>` : ` <span class="down">↓${Math.abs(u.trendPct)}%</span>`;
  const tools = u.byTool.length
    ? u.byTool.map((t) => `<div class="u-tool"><span>${esc(t.label)}</span><b>${L({ zh: `今日 ${fmt(t.today)} · 周 ${fmt(t.week)}`, en: `Today ${fmt(t.today)} · Week ${fmt(t.week)}` })}</b></div>`).join('')
    : `<div class="u-tool"><span>${L({ zh: '暂无本地可读的用量', en: 'No readable local usage yet' })}</span><b>—</b></div>`;
  const bars = u.bars.map((h, i) => `<div class="u-bar" style="height:${Math.max(3, h)}%" title="${i}:00"></div>`).join('');
  const peak = u.peakHour == null ? L({ zh: '还没数据', en: 'no data yet' }) : L({ zh: `${String(u.peakHour).padStart(2, '0')}:00 前后`, en: `around ${String(u.peakHour).padStart(2, '0')}:00` });
  const c = u.cost || { todayCost: 0, weekCost: 0, usdPerMillion: 1.3 };
  const approx = L({ zh: '约', en: '~' });
  return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button>
    <h2>${L({ zh: '📊 用量洞察', en: '📊 Usage Insights' })}</h2>
    <div class="u-stat-row">
      <div class="u-stat"><div class="u-n">${fmt(u.today)}</div><div class="u-l">${L({ zh: '今日', en: 'Today' })}${trend}</div></div>
      <div class="u-stat"><div class="u-n">${fmt(u.week)}</div><div class="u-l">${L({ zh: '最近 7 天', en: 'Last 7 days' })}</div></div>
    </div>
    <div class="u-stat-row">
      <div class="u-stat"><div class="u-n"><span class="approx">${approx}</span>${formatMoney(c.todayCost)}</div><div class="u-l">${L({ zh: '今日花费', en: 'Today’s cost' })}</div></div>
      <div class="u-stat"><div class="u-n"><span class="approx">${approx}</span>${formatMoney(c.weekCost)}</div><div class="u-l">${L({ zh: '近 7 天花费', en: 'Last 7 days' })}</div></div>
    </div>
    <div class="u-sec">${L({ zh: '按工具', en: 'By tool' })}</div>
    ${tools}
    <div class="u-sec">${L({ zh: '活跃时段 · 最近 7 天你几点最能写', en: 'Active hours · when you code most (last 7 days)' })}</div>
    <div class="u-hist">${bars}</div>
    <div class="u-hint">${L({ zh: '🔥 最能写：', en: '🔥 Peak: ' })}<b>${peak}</b></div>
    <div class="u-sec">${L({ zh: '花费设置', en: 'Cost settings' })}</div>
    <div class="u-set">
      <label><span class="u-set-k">${L({ zh: '每百万 token', en: 'Per million tokens' })}</span><span class="u-set-v">$<input class="nodrag" id="rateInput" type="number" min="0" step="0.1" value="${c.usdPerMillion}" /></span></label>
    </div>
    <div class="source-note" style="margin-top:10px">${L({ zh: '花费=用量×单价的<b>粗略估算</b>（输入/输出/缓存按混合价折算，单价可自己调），当作「你的用量值多少钱」的参考。金额为美元，只读本机日志，不联网、不上传。', en: 'Cost = usage × price, a <b>rough estimate</b> (input/output/cache blended; price is adjustable) — a sense of what your usage is worth. In USD. Reads local logs only; nothing is sent or uploaded.' })}</div>`;
}

export function bondHTML(vm) {
  const b = vm.bond;
  const ladder = vm.bondLevels.map((l) => {
    const reached = b.level >= l.level;
    const current = b.level === l.level;
    return `<div class="bond-row ${current ? 'current' : ''} ${reached ? '' : 'locked'}">
      <span class="bond-lv">Lv.${l.level}</span>
      <div class="bond-info"><div class="bn">${esc(l.name)}${current ? `<span class="cur">${L({ zh: '当前', en: 'now' })}</span>` : ''}</div><div class="bd">${esc(l.unlock)}</div></div>
      <span class="bond-ck">${reached ? '✅' : '🔒'}</span>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button>
    <h2>${L({ zh: '💞 羁绊', en: '💞 Bond' })} · Lv.${b.level} ${esc(b.name)}</h2>
    <div class="sub-h"><span class="evo-chip">${L({ zh: `陪伴 ${vm.daysTogether} 天 · 亲密度 ${b.points}`, en: `Together ${vm.daysTogether}d · ${b.points} pts` })}</span></div>
    <div class="bond-bar"><span style="width:${b.pct}%"></span></div>
    <div class="bond-next">${b.isMax ? L({ zh: '已是最高羁绊 💞', en: 'Max bond reached 💞' }) : L({ zh: `距 ${esc(b.nextName)} 还差 ${b.toNext} 亲密度`, en: `${b.toNext} pts to ${esc(b.nextName)}` })}</div>
    ${ladder}
    <div class="source-note" style="margin-top:10px">${L({ zh: '写代码 + 逗它都会加深羁绊（只涨不掉）。越亲，它越黏你、台词越暖。', en: 'Coding and playing with it both deepen the bond (it only grows). The closer you are, the clingier and warmer it gets.' })}</div>`;
}

export function evolutionHTML(vm) {
  const rows = vm.stages.map((s) => {
    const thumb = s.state === 'mystery'
      ? '<div class="evo-thumb mystery">?</div>'
      : `<div class="evo-thumb ${s.state === 'locked' ? 'locked' : ''}">${s.url ? `<img src="${s.url}" alt="${esc(s.name)}" draggable="false" />` : ''}</div>`;
    let info, state;
    if (s.state === 'current') {
      info = `<div class="evo-name"><span class="seg">${seg(s.no)}</span>${esc(s.name)}<span class="cur">${L({ zh: '当前', en: 'now' })}</span></div>
        <div class="evo-prog-wrap"><div class="evo-prog"><span style="width:${s.withinPct}%"></span></div>
        <div class="evo-prog-txt">${L({ zh: `距${esc(s.nextName)}还差 `, en: '' })}<b>${s.toNextText}</b>${L({ zh: '', en: ` to ${esc(s.nextName)}` })}</div></div>`;
      state = '';
    } else if (s.state === 'done') {
      info = `<div class="evo-name"><span class="seg">${seg(s.no)}</span>${esc(s.name)}</div><div class="evo-desc">${L({ zh: '已解锁', en: 'Unlocked' })}</div>`;
      state = '✅';
    } else if (s.state === 'mystery') {
      info = `<div class="evo-name"><span class="seg">${seg(s.no)}</span>${L({ zh: '化形 · ？？？', en: 'Awaken · ???' })}</div><div class="evo-desc">${L({ zh: `养满 ${vm.needText} 破壳揭晓`, en: `Reach ${vm.needText} to reveal` })}</div>`;
      state = '<span class="lock">🔒</span>';
    } else {
      info = `<div class="evo-name"><span class="seg">${seg(s.no)}</span>${esc(s.name)}</div><div class="evo-desc">${L({ zh: `养到 ${s.thresholdText} 解锁`, en: `Unlocks at ${s.thresholdText}` })}</div>`;
      state = '<span class="lock">🔒</span>';
    }
    return `<div class="evo-row ${s.state}">${thumb}<div class="evo-info">${info}</div><div class="evo-state">${state}</div></div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button>
    <h2>${esc(vm.nick)} · ${L({ zh: '进化', en: 'Evolution' })}</h2>
    <div class="sub-h"><span class="evo-chip" style="color:${vm.color}">${esc(vm.speciesName)} · ${esc(vm.rarityName)} · ${L({ zh: `第${vm.current}/5段`, en: `Stage ${vm.current}/5` })}</span></div>
    ${rows}
    <div class="evo-total"><span>${L({ zh: `累计已喂 `, en: 'Fed ' })}<b>${vm.fedText}</b>${L({ zh: '', en: ' total' })}</span><span>${L({ zh: `距化形还差 `, en: '' })}<b>${vm.toHatchText}</b>${L({ zh: '', en: ' to awaken' })}</span></div>
    ${vm.active
      ? `<button class="evo-btn nodrag" disabled>${L({ zh: '在养中 🌱', en: 'Raising 🌱' })}</button>`
      : `<button class="evo-btn nodrag" id="evoActivate">${L({ zh: '设为在养 🌱', en: 'Set active 🌱' })}</button>`}
    <div class="source-note" style="margin-top:12px">${L({ zh: '养满一段解锁一段，进度不清零。最终「化形」保持神秘，破壳才揭晓 🎉', en: 'Fill a stage to unlock the next; progress never resets. The final Awakened form stays a mystery until it hatches 🎉' })}</div>`;
}

export function collectionHTML(vm) {
  const cells = SPECIES.map((s) => {
    const owned = vm.collection[s.key];
    return `<div class="dex-cell ${owned ? 'owned nodrag' : 'locked'} nodrag" ${owned ? `data-battle="${s.key}"` : `data-locked="${s.rarity}"`}>
      <div class="dex-pic" style="--rc:${RARITY[s.rarity].color}">
        ${owned ? `<img src="${adultUrl(s.folder)}" alt="${esc(s.name)}" />` : '<span class="qm">?</span>'}
        ${owned && owned.count > 1 ? `<span class="cnt">×${owned.count}</span>` : ''}
        ${vm.activePetSpecies === s.key ? `<span class="battle">${L({ zh: '陪伴中', en: 'Companion' })}</span>` : ''}
      </div>
      <div class="dex-nm">${owned ? esc(s.name) : L({ zh: '？？？', en: '???' })}</div>
      <div class="dex-rr" style="color:${RARITY[s.rarity].color}">${RARITY[s.rarity].name}</div>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button><h2>${L({ zh: '图鉴', en: 'Collection' })} · ${vm.ownedCount}/${SPECIES.length}</h2>
    <div class="dex-grid">${cells}</div>
    <div class="source-note" id="dexNote" style="margin-top:8px">${L({ zh: '点已获得的品种，让它陪你。', en: 'Tap one you own to make it your companion.' })}</div>`;
}

export function achievementsHTML(vm) {
  const rows = ACHIEVEMENTS.map((a) => {
    const done = !!vm.achievements[a.id];
    return `<div class="ach-row ${done ? 'done' : ''}">
      <span class="ach-ck">${done ? '✅' : '⬜'}</span>
      <div class="ach-info"><div class="an">${esc(a.name)}</div><div class="ad">${esc(a.desc)}</div></div>
      <span class="ach-tk" style="color:${RARITY[a.ticket].color}">${RARITY[a.ticket].name}${tk()}</span>
    </div>`;
  }).join('');
  return `<button class="close nodrag" data-close aria-label="${L({ zh: '关闭', en: 'Close' })}">✕</button><h2>${L({ zh: '成就', en: 'Achievements' })} · ${vm.achDone}/${ACHIEVEMENTS.length}</h2>${rows}
    <div class="source-note" style="margin-top:8px">${L({ zh: '达成成就得券，用券抽蛋。全用你的真实用量判定。', en: 'Earn tickets from achievements and draw eggs. All judged on your real usage.' })}</div>`;
}

export { speciesByKey };
