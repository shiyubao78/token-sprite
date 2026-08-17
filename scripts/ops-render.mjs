// 看板渲染：把抓来的数据算成结论 + 画成一张自包含的网页（不联网、不依赖任何 CDN）。

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => (n ?? 0).toLocaleString('zh-CN');

// 取最近 n 天（按日期排序）的记录
export function recentDays(days, n) {
  return Object.keys(days).sort().slice(-n).map((d) => ({ date: d, ...days[d] }));
}

function sum(rows, key) { return rows.reduce((s, r) => s + (r[key] || 0), 0); }

// 两段时间对比，返回涨跌百分比（前一段为 0 时不给百分比）
function trend(cur, prev) {
  if (!prev) return { delta: cur, pct: null, up: cur > 0 };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { delta: cur - prev, pct, up: cur >= prev };
}

// 核心计算：所有卡片和结论都从这里出
export function summarize({ raw, history }) {
  const days = history.days || {};
  const last7 = recentDays(days, 7);
  const prev7 = recentDays(days, 14).slice(0, Math.max(0, recentDays(days, 14).length - 7));

  const assets = raw.releases.flatMap((r) => (r.assets || []).map((a) => ({
    tag: r.tag_name, published: r.published_at, name: a.name, count: a.download_count || 0,
  })));
  const totalDownloads = sum(assets, 'count');

  const latest = raw.releases.find((r) => !r.draft && !r.prerelease) || raw.releases[0];
  const latestDownloads = latest ? sum((latest.assets || []).map((a) => ({ count: a.download_count || 0 })), 'count') : 0;

  const cloneUniques14 = raw.clones?.uniques ?? sum(recentDays(days, 14), 'cloneUniques');
  const viewUniques14 = raw.views?.uniques ?? sum(recentDays(days, 14), 'viewUniques');

  const snaps = history.snapshots || [];
  const cur = snaps.at(-1) || {};
  const weekAgo = snaps.find((s) => s.date <= addDays(cur.date, -7)) || snaps[0] || {};

  return {
    stars: cur.stars ?? raw.repo.stargazers_count,
    starsDelta: (cur.stars ?? 0) - (weekAgo.stars ?? cur.stars ?? 0),
    forks: cur.forks ?? raw.repo.forks_count,
    totalDownloads,
    latestTag: latest?.tag_name || '—',
    latestDownloads,
    cloneUniques14,
    viewUniques14,
    clone7: sum(last7, 'cloneUniques'),
    clonePrev7: sum(prev7, 'cloneUniques'),
    cloneTrend: trend(sum(last7, 'cloneUniques'), sum(prev7, 'cloneUniques')),
    view7: sum(last7, 'viewUniques'),
    viewTrend: trend(sum(last7, 'viewUniques'), sum(prev7, 'viewUniques')),
    assets,
    daysTracked: Object.keys(days).length,
    snapshotCount: snaps.length,
  };
}

function addDays(dateStr, n) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 人话结论：看板最上面那几句，直接告诉你"现在到底怎么样"
export function insights(s) {
  const out = [];

  if (s.cloneUniques14 > 0 && s.totalDownloads * 5 < s.cloneUniques14) {
    out.push({
      tone: 'warn',
      text: `大家在拿源码跑，不是装应用：14 天有 <b>${num(s.cloneUniques14)} 人</b> clone 了代码，但安装包累计只被下载 <b>${num(s.totalDownloads)} 次</b>。想让普通用户用起来，得把「下载即用」这条路做顺（README 首屏放下载按钮 + 讲清 macOS 首次打开怎么绕过拦截）。`,
    });
  }

  if (s.latestDownloads === 0 && s.totalDownloads > 0) {
    out.push({ tone: 'warn', text: `最新版 <b>${esc(s.latestTag)}</b> 目前 0 下载——新版本发出去了，但没人取。` });
  }

  if (s.cloneTrend.pct !== null) {
    const w = s.cloneTrend.up ? '↑ 涨了' : '↓ 掉了';
    out.push({
      tone: s.cloneTrend.up ? 'good' : 'warn',
      text: `最近 7 天 <b>${num(s.clone7)} 人</b>拿走代码，比上个 7 天 ${w} <b>${Math.abs(s.cloneTrend.pct)}%</b>（上期 ${num(s.clonePrev7)} 人）。`,
    });
  } else if (s.clone7 > 0) {
    out.push({ tone: 'good', text: `最近 7 天 <b>${num(s.clone7)} 人</b>拿走了代码。` });
  }

  if (s.snapshotCount <= 1) {
    out.push({ tone: 'info', text: '这是第一天记录。GitHub 的流量数据只留 14 天，<b>每天跑一次</b>才能攒出长期趋势——建议开自动抓取。' });
  }

  return out;
}

// 每日柱状图（纯 SVG，两组柱：拿走代码 / 逛过页面）
function barChart(days, n = 30) {
  const rows = recentDays(days, n);
  if (!rows.length) return '<div class="empty">还没有流量数据</div>';
  const W = 900, H = 220, PAD = { l: 34, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...rows.map((r) => Math.max(r.cloneUniques || 0, r.viewUniques || 0)));
  const bw = (W - PAD.l - PAD.r) / rows.length;
  const y = (v) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);

  const bars = rows.map((r, i) => {
    const x = PAD.l + i * bw;
    const c = r.cloneUniques || 0, v = r.viewUniques || 0;
    const w = Math.max(2, bw / 2 - 2);
    return `<rect x="${x + 1}" y="${y(v)}" width="${w}" height="${H - PAD.b - y(v)}" fill="#cfe0c3" rx="2"><title>${r.date} 逛过页面 ${v} 人</title></rect>
      <rect x="${x + w + 2}" y="${y(c)}" width="${w}" height="${H - PAD.b - y(c)}" fill="#6aa84f" rx="2"><title>${r.date} 拿走代码 ${c} 人</title></rect>`;
  }).join('');

  const ticks = [0, Math.round(max / 2), max].map((v) =>
    `<line x1="${PAD.l}" y1="${y(v)}" x2="${W - PAD.r}" y2="${y(v)}" stroke="#e6ded0"/>
     <text x="4" y="${y(v) + 4}" class="ax">${v}</text>`).join('');

  const labels = rows.map((r, i) => (i % Math.ceil(rows.length / 8) === 0
    ? `<text x="${PAD.l + i * bw}" y="${H - 8}" class="ax">${r.date.slice(5)}</text>` : '')).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="每日趋势">${ticks}${bars}${labels}</svg>
    <div class="legend"><span><i style="background:#6aa84f"></i>拿走代码的人</span><span><i style="background:#cfe0c3"></i>逛过页面的人</span></div>`;
}

function funnel(s) {
  const steps = [
    { k: '逛过页面', v: s.viewUniques14, hint: '14 天独立访客' },
    { k: '拿走代码', v: s.cloneUniques14, hint: '14 天独立 clone' },
    { k: '下载安装包', v: s.totalDownloads, hint: '开站至今累计' },
  ];
  const max = Math.max(1, ...steps.map((x) => x.v));
  const bars = steps.map((x) => `<div class="fn-row">
      <div class="fn-k">${x.k}</div>
      <div class="fn-bar"><div class="fn-fill" style="width:${Math.max(3, (x.v / max) * 100)}%"></div></div>
      <div class="fn-v">${num(x.v)}<span class="fn-hint">${x.hint}</span></div>
    </div>`).join('');

  // clone 人数可能反超访客数：CI、镜像站、脚本会 clone 但不开网页。倒挂时说明一句，免得看着像数据错了。
  const note = s.cloneUniques14 > s.viewUniques14
    ? `<div class="note" style="margin-top:10px">注：clone 人数比访客还多是正常的——CI、镜像站、自动化脚本会 clone 但不打开网页，所以这一层含水分，把它当「上限」看。</div>`
    : '';
  return bars + note;
}

function versionTable(assets) {
  const byTag = new Map();
  for (const a of assets) {
    if (!byTag.has(a.tag)) byTag.set(a.tag, { tag: a.tag, published: a.published, total: 0, files: [] });
    const t = byTag.get(a.tag);
    t.total += a.count;
    t.files.push(a);
  }
  const rows = [...byTag.values()].sort((a, b) => String(b.published).localeCompare(String(a.published))).slice(0, 12);
  if (!rows.length) return '<div class="empty">还没有发布任何版本</div>';
  return `<table><thead><tr><th>版本</th><th>发布时间</th><th class="r">下载次数</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><b>${esc(r.tag)}</b></td><td class="dim">${esc(String(r.published).slice(0, 10))}</td><td class="r ${r.total ? '' : 'dim'}">${num(r.total)}</td></tr>`).join('')}
  </tbody></table>`;
}

function refTable(referrers) {
  if (!referrers?.length) return '<div class="empty">14 天内没有外部来源数据</div>';
  return `<table><thead><tr><th>来源</th><th class="r">访问</th><th class="r">人数</th></tr></thead><tbody>
    ${referrers.slice(0, 8).map((r) => `<tr><td>${esc(r.referrer)}</td><td class="r">${num(r.count)}</td><td class="r">${num(r.uniques)}</td></tr>`).join('')}
  </tbody></table>`;
}

export function renderDashboard({ raw, history, repo }) {
  const s = summarize({ raw, history });
  const now = new Date().toLocaleString('zh-CN', { hour12: false });

  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Token 小精灵 · 运营看板</title>
<style>
  :root { --bg:#f6f2ea; --card:#fff; --ink:#3d3730; --dim:#948a79; --green:#6aa84f; --line:#eae3d6; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 28px 20px 60px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .sub { color: var(--dim); font-size: 13px; margin-bottom: 22px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin-bottom:20px; }
  .card { background:var(--card); border-radius:14px; padding:18px 18px 16px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .card .k { font-size:13px; color:var(--dim); }
  .card .v { font-size:34px; font-weight:700; line-height:1.2; margin:6px 0 2px; }
  .card .n { font-size:12px; color:var(--dim); }
  .up { color:var(--green); } .down { color:#c47b5a; }
  section { background:var(--card); border-radius:14px; padding:18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  section h2 { font-size:15px; margin:0 0 14px; }
  .ins { border-left:3px solid var(--green); background:#f3f7f0; padding:10px 14px; border-radius:0 8px 8px 0; margin-bottom:10px; font-size:14px; }
  .ins.warn { border-color:#e0a355; background:#fdf6ec; }
  .ins.info { border-color:#8fa8bf; background:#f0f4f8; }
  .fn-row { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
  .fn-k { width:88px; font-size:13px; color:var(--dim); flex:none; }
  .fn-bar { flex:1; background:#f2ede3; border-radius:6px; height:26px; overflow:hidden; }
  .fn-fill { height:100%; background:linear-gradient(90deg,#6aa84f,#9ac47f); border-radius:6px; }
  .fn-v { width:120px; text-align:right; font-weight:700; flex:none; }
  .fn-hint { display:block; font-weight:400; font-size:11px; color:var(--dim); }
  .chart { width:100%; height:auto; }
  .ax { font-size:10px; fill:var(--dim); }
  .legend { display:flex; gap:16px; font-size:12px; color:var(--dim); margin-top:6px; }
  .legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:5px; vertical-align:-1px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { text-align:left; font-weight:600; font-size:12px; color:var(--dim); padding:6px 8px; border-bottom:1px solid var(--line); }
  td { padding:8px; border-bottom:1px solid #f4efe6; }
  .r { text-align:right; } .dim { color:var(--dim); }
  .empty { color:var(--dim); font-size:13px; padding:8px 0; }
  .note { font-size:12.5px; color:var(--dim); line-height:1.8; }
  .note b { color:var(--ink); }
</style></head>
<body><div class="wrap">
  <h1>🌱 Token 小精灵 · 运营看板</h1>
  <div class="sub">${esc(repo)} · 更新于 ${esc(now)} · 已攒 ${s.daysTracked} 天流量记录</div>

  <div class="cards">
    <div class="card"><div class="k">拿走代码的人（14 天）</div><div class="v">${num(s.cloneUniques14)}</div>
      <div class="n">最近 7 天 ${num(s.clone7)} 人${s.cloneTrend.pct === null ? '' : ` · <span class="${s.cloneTrend.up ? 'up' : 'down'}">${s.cloneTrend.up ? '↑' : '↓'}${Math.abs(s.cloneTrend.pct)}%</span>`}</div></div>
    <div class="card"><div class="k">安装包下载（累计）</div><div class="v">${num(s.totalDownloads)}</div>
      <div class="n">最新版 ${esc(s.latestTag)} · ${num(s.latestDownloads)} 次</div></div>
    <div class="card"><div class="k">Star</div><div class="v">${num(s.stars)}</div>
      <div class="n">${s.starsDelta > 0 ? `<span class="up">↑ 本周 +${s.starsDelta}</span> · ` : ''}${num(s.forks)} 个 fork</div></div>
  </div>

  <section><h2>💡 一句话看懂</h2>
    ${insights(s).map((i) => `<div class="ins ${i.tone}">${i.text}</div>`).join('') || '<div class="empty">暂无结论</div>'}
  </section>

  <section><h2>🔻 从看到到装上，人是怎么漏掉的</h2>${funnel(s)}</section>

  <section><h2>📈 每日趋势</h2>${barChart(history.days || {})}</section>

  <section><h2>📦 各版本下载</h2>${versionTable(s.assets)}</section>

  <section><h2>🔗 人从哪来（14 天）</h2>${refTable(raw.referrers)}</section>

  <section><h2>📖 这些数字怎么读</h2>
    <div class="note">
      <b>「安装了多少人」拿不到精确值</b>——小精灵全程本地、不联网、不埋点，所以谁装了、装完有没有在用，程序不会往外报。这是产品承诺，看板不打算破坏它。<br/>
      因此这里用两个能看见的口径逼近：<b>拿走代码的人</b>（独立 clone 数，偏开发者）和 <b>安装包下载次数</b>（偏普通用户）。真实安装数介于两者之间，且一定比它们小（有人下了没装，有人 clone 只是看看）。<br/>
      <b>GitHub 流量只保留 14 天</b>，所以这个脚本每天跑一次、把数据存进本地 <code>ops-data/history.json</code>，长期趋势才攒得出来。<br/>
      想要真实的安装数和活跃数，唯一办法是应用里加匿名上报（要联网 + 一台服务器）——那会动到「全本地不联网」这个卖点，需要你先拍板。
    </div>
  </section>
</div></body></html>`;
}
