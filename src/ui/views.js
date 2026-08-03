import { formatTokens } from '../domain/format.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SRC_NAME = { 'claude-code': 'Claude Code', codex: 'Codex' };

export function petHTML(vm) {
  const chip = `Lv.${vm.stage.level} ${esc(vm.stage.name)}`;
  const barClass = vm.decayed ? 'bar wilt-bar' : 'bar';
  const barText = vm.decayed
    ? `蔫着 · 有新消耗立刻长回 ${esc(vm.base.name)}`
    : vm.isMax
      ? '已是最终形态 · 化形·小精灵'
      : `距离 ${esc(vm.next.name)} · ${vm.percent}%`;
  return `
    <div class="dragbar">
      <span class="pet-name">${esc(vm.petName)}</span>
      <button class="menu-btn nodrag" id="menuBtn" aria-label="菜单">⋯</button>
    </div>
    <div class="petstage nodrag" id="petStage">
      <div class="sprite-ground"></div>
      ${vm.spriteUrl
        ? `<img class="sprite ${vm.decayed ? 'wilted' : ''}" id="sprite" src="${vm.spriteUrl}" alt="${esc(vm.stage.name)}" draggable="false" />`
        : `<div class="sprite" id="sprite" style="width:120px;height:120px;border-radius:50%;background:#e9dcc0"></div>`}
      <div class="fx" id="fx"></div>
      <div class="bubble" id="bubble"></div>
    </div>
    <div class="petinfo">
      <div class="chip">${chip}</div>
      <div class="${barClass}"><span style="width:${vm.isMax ? 100 : vm.percent}%"></span></div>
      <div class="subline">${barText} · 累计 ${formatTokens(vm.total)}</div>
    </div>
  `;
}

export function dexHTML(vm) {
  const rows = vm.dex.map((s) => `
    <div class="dex-row ${s.current ? 'current' : ''} ${s.unlocked ? '' : 'locked'}">
      <div class="dex-thumb ${s.unlocked ? '' : 'locked'}">${s.url ? `<img src="${s.url}" alt="${esc(s.name)}" />` : ''}</div>
      <div class="dex-info">
        <div class="n">${esc(s.name)}${s.current ? '<span class="cur">当前</span>' : ''}</div>
        <div class="t">累计 ${formatTokens(s.threshold)} token · ${esc(s.note)}</div>
      </div>
      <div class="dex-state">${s.unlocked ? '✅' : '🔒'}</div>
    </div>`).join('');
  return `<button class="close nodrag" data-close aria-label="关闭">✕</button><h2>进化图鉴</h2>${rows}
    <div class="source-note" style="margin-top:6px">🌗 token 累计成长、不清零；超过 24 小时没有新消耗会蔫一级，一写代码就长回来。</div>`;
}

export function menuHTML(vm) {
  const parts = vm.breakdown.length
    ? vm.breakdown.map((b) => `<div class="src-row"><span>${esc(SRC_NAME[b.source] || b.source)}</span><b>${formatTokens(b.total)}</b></div>`).join('')
    : '<div class="src-row"><span>暂无本地用量</span><b>0</b></div>';
  return `
    <button class="close nodrag" data-close aria-label="关闭">✕</button>
    <h2>${esc(vm.petName)} · Lv.${vm.stage.level} ${esc(vm.stage.name)}</h2>
    <div class="src-box">
      <div class="src-total"><span>累计消耗</span><b>${formatTokens(vm.total)} token</b></div>
      ${parts}
    </div>
    <div class="field" style="margin-top:14px">
      <label>给小精灵起个名字</label>
      <input id="nameInput" type="text" maxlength="12" value="${esc(vm.petName)}" placeholder="小苗" />
    </div>
    <div class="menu-actions">
      <button class="nodrag" id="saveBtn">保存</button>
      <button class="nodrag" id="dexBtn">进化图鉴</button>
      <button class="nodrag danger" id="quitBtn">退出</button>
    </div>
    ${vm.isDesktop ? `<div class="toggle-row nodrag"><span>开机自启</span><button class="toggle" id="autoBtn">…</button></div>` : ''}
    <div class="source-note" style="margin-top:12px">正在读本地 <b>Claude Code + Codex</b> 的真实用量，自动成长，不用喂。</div>
  `;
}
