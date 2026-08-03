import './style.css';
import { STAGES } from './config/stages.js';
import { progressFor, effectiveStage } from './domain/growth.js';
import { loadPet, savePet } from './services/pet-store.js';
import { LocalUsageSource } from './services/token-source.js';
import { spriteUrl } from './services/sprites.js';
import { petHTML, dexHTML, menuHTML } from './ui/views.js';

const app = document.getElementById('app');
const source = new LocalUsageSource();

let state = loadPet();
let usage = { total: 0, lastActivityAt: Date.now(), breakdown: [] };
let displayedLevel = 1;

const LINES = [
  '码力充沛，继续冲！', '今天也在悄悄长大～', '多写点，我就更亮啦',
  '陪你写代码最开心', '再来一段，快进化了！', '你敲的每个 token 我都收到啦',
];

// 安装以来的新增 token（首次运行记录的历史累计为基准，从 0 开始长）
function growthTotal() {
  const base = state.baseline ? state.baseline.total : usage.total;
  return Math.max(0, usage.total - base);
}

function deriveVm() {
  const grown = growthTotal();
  const idleMs = Date.now() - (usage.lastActivityAt || Date.now());
  const eff = effectiveStage(grown, idleMs);
  const p = progressFor(grown);
  const baseBy = (state.baseline && state.baseline.bySource) || {};
  return {
    petName: state.petName,
    stage: eff.stage,
    base: eff.base,
    decayed: eff.decayed,
    dropped: eff.dropped,
    idleHours: Math.max(0, Math.floor(idleMs / 3600000)),
    next: p.next,
    isMax: !p.next,
    percent: Math.round(p.fraction * 100),
    total: grown,
    breakdown: (usage.breakdown || []).map((b) => ({
      source: b.source,
      label: b.label,
      total: Math.max(0, b.total - (baseBy[b.source] || 0)),
    })),
    isDesktop: !!(globalThis.tokenSprite && globalThis.tokenSprite.getAutoLaunch),
    spriteUrl: spriteUrl(eff.stage.art),
    dex: STAGES.map((s) => ({
      ...s,
      unlocked: grown >= s.threshold,
      current: s.level === eff.stage.level,
      url: spriteUrl(s.art),
    })),
  };
}

function render() {
  const vm = deriveVm();
  displayedLevel = vm.stage.level;
  app.innerHTML = petHTML(vm);
  document.getElementById('menuBtn')?.addEventListener('click', openMenu);
}

async function sync({ celebrate = true } = {}) {
  const prev = displayedLevel;
  usage = await source.getUsage();
  // 首次运行：把当下历史累计设为基准，之后从 0 开始长
  if (!state.baseline) {
    state.baseline = {
      total: usage.total,
      bySource: Object.fromEntries((usage.breakdown || []).map((b) => [b.source, b.total])),
      at: Date.now(),
    };
    savePet(state);
  }
  const vm = deriveVm();
  if (vm.stage.level > state.bestLevel) {
    state.bestLevel = vm.stage.level;
    savePet(state);
  }
  if (celebrate && vm.stage.level > prev) {
    render();
    showEvolve(vm.stage);
  } else {
    render();
  }
}

function interact() {
  const sprite = document.getElementById('sprite');
  const fx = document.getElementById('fx');
  const bubble = document.getElementById('bubble');
  if (sprite) {
    sprite.classList.remove('eating');
    void sprite.offsetWidth;
    sprite.classList.add('eating');
  }
  if (fx) {
    ['✨', '💚', '✨'].forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'spark-fx';
      el.textContent = c;
      el.style.left = 30 + i * 20 + '%';
      fx.appendChild(el);
      requestAnimationFrame(() => el.classList.add('go'));
      setTimeout(() => el.remove(), 900);
    });
  }
  if (bubble) {
    bubble.textContent = LINES[Math.floor(Math.random() * LINES.length)];
    bubble.classList.add('show');
    clearTimeout(bubble._t);
    bubble._t = setTimeout(() => bubble.classList.remove('show'), 1800);
  }
}

function showEvolve(stage) {
  const mask = document.createElement('div');
  mask.className = 'evolve-mask nodrag';
  const url = spriteUrl(stage.art);
  mask.innerHTML = `
    <div class="spark">✨</div>
    <div class="cap">进化了！</div>
    ${url ? `<img src="${url}" alt="${stage.name}" />` : ''}
    <div class="name">${stage.name}</div>
    <div class="tip">轻触继续</div>`;
  mask.addEventListener('click', () => { mask.remove(); render(); });
  document.body.appendChild(mask);
}

function openSheet(html, bind) {
  const mask = document.createElement('div');
  mask.className = 'sheet-mask nodrag';
  mask.innerHTML = `<div class="sheet">${html}</div>`;
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => {
    if (e.target === mask || e.target.hasAttribute('data-close')) close();
  });
  document.body.appendChild(mask);
  bind?.(mask, close);
}

function openDex() {
  openSheet(dexHTML(deriveVm()));
}

function openMenu() {
  openSheet(menuHTML(deriveVm()), (mask, close) => {
    mask.querySelector('#saveBtn')?.addEventListener('click', () => {
      const name = mask.querySelector('#nameInput').value.trim();
      state.petName = name || '小苗';
      savePet(state);
      close();
      render();
    });
    mask.querySelector('#dexBtn')?.addEventListener('click', () => { close(); openDex(); });
    mask.querySelector('#quitBtn')?.addEventListener('click', () => {
      if (globalThis.tokenSprite?.quit) globalThis.tokenSprite.quit();
      else close();
    });
    const autoBtn = mask.querySelector('#autoBtn');
    if (autoBtn && globalThis.tokenSprite?.getAutoLaunch) {
      const paint = (on) => {
        autoBtn.textContent = on ? '已开启' : '已关闭';
        autoBtn.classList.toggle('on', !!on);
      };
      globalThis.tokenSprite.getAutoLaunch().then(paint);
      autoBtn.addEventListener('click', async () => {
        const cur = autoBtn.classList.contains('on');
        paint(await globalThis.tokenSprite.setAutoLaunch(!cur));
      });
    }
  });
}

// 拖拽：按住小精灵/顶栏拖动整只窗口；几乎没移动就当作轻点→互动
let drag = null;
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('button, input, .sheet-mask, .evolve-mask')) return;
  const onPet = !!e.target.closest('.petstage, .dragbar');
  if (!onPet) return;
  drag = { mx: e.screenX, my: e.screenY, wx: 0, wy: 0, ready: false, moved: false };
  if (globalThis.tokenSprite?.getWindowPos) {
    globalThis.tokenSprite.getWindowPos().then(([x, y]) => {
      if (drag) { drag.wx = x; drag.wy = y; drag.ready = true; }
    });
  }
});
document.addEventListener('mousemove', (e) => {
  if (!drag) return;
  const dx = e.screenX - drag.mx;
  const dy = e.screenY - drag.my;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
  if (drag.moved && drag.ready && globalThis.tokenSprite?.setWindowPos) {
    globalThis.tokenSprite.setWindowPos(drag.wx + dx, drag.wy + dy);
  }
});
document.addEventListener('mouseup', () => {
  if (!drag) return;
  const wasTap = !drag.moved;
  drag = null;
  if (wasTap) interact();
});

render();
sync({ celebrate: false });
setInterval(() => sync(), 45000);
window.addEventListener('focus', () => sync());
