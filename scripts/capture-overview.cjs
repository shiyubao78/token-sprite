// 一次性脚本：载入 dev 应用(localhost:5173)，注入一份"演示存档"，逐个面板高清截图到 PNG。
// 用法：npx electron scripts/capture-overview.cjs <输出目录>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:5173';
const OUTDIR = process.argv[2];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const now = Date.now();
const DAY = 86400000;
// 演示存档：孵化中的蛋 + 图鉴收集 2/6 + 成就若干 + 券 + 羁绊 Lv.3 + 花费预算。baseline 设很大→growth=0，画面冻结不被 sync 改动。
const DEMO = {
  petName: '小苗',
  createdAt: now - 20 * DAY,
  baseline: { total: 999e9, bySource: {}, at: now - 20 * DAY },
  greetDate: null,
  achievements: { meet: { at: now }, warmup: { at: now }, 'getting-there': { at: now }, dual: { at: now } },
  tickets: { common: 2, rare: 1, epic: 1, legendary: 0 },
  eggs: [
    { id: 'e1', species: 'shell', at: now - 5 * DAY, fed: 200000000 },
    { id: 'e2', species: 'thunder', at: now - 2 * DAY, fed: 0 },
  ],
  activeEggId: 'e1',
  lastGrowth: 0,
  collection: { flower: { count: 1, firstAt: now - 15 * DAY }, fire: { count: 1, firstAt: now - 8 * DAY } },
  activePetSpecies: 'flower',
  activeDates: [],
  nightDates: [],
  settings: { usdPerMillion: 1.3, dailyBudget: 200 },
  budgetAlert: null,
  bond: { startedAt: 0, interactPoints: 80, todayInteract: 0, day: '', level: 3 },
};

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 430, height: 1500, show: false,
    backgroundColor: '#ffffff',
    webPreferences: { webSecurity: false, backgroundThrottling: false },
  });
  const wc = win.webContents;

  await win.loadURL(URL);
  await wc.executeJavaScript(`localStorage.setItem('token-sprite:pet:v1', ${JSON.stringify(JSON.stringify(DEMO))}); true`);
  await win.loadURL(URL);
  await wait(2000); // 等 app 启动

  // 注入一份可控的演示用量（隐藏窗口取本机 /api/usage 不稳），再触发一次 sync 重渲
  await wc.executeJavaScript(`(()=>{
    const DAY=86400000, now=Date.now(), pad=n=>String(n).padStart(2,'0');
    const key=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
    const week=[150e6,1.4e9,1.1e9,0.9e9,1.6e9,1.2e9,0.85e9];
    const daily={}; week.forEach((v,i)=>daily[key(now-i*DAY)]=v);
    const MOCK={
      total:12e9, recentTokens:2.4e6, todayTokens:150e6, lastActivityAt:now, daily,
      hourly:[2,1,0,0,0,0,0,3,8,22,40,55,48,35,70,95,80,60,42,50,66,38,18,7],
      breakdown:[
        {source:'claude-code',label:'Claude Code',total:9.4e9,recentTokens:2e6,todayTokens:120e6,weekTokens:5.8e9,lastActivityAt:now},
        {source:'codex',label:'Codex',total:2.6e9,recentTokens:0.4e6,todayTokens:30e6,weekTokens:1.4e9,lastActivityAt:now-3600000},
      ],
    };
    const of=window.fetch;
    window.fetch=(u,o)=>String(u).includes('/api/usage')?Promise.resolve({ok:true,json:()=>Promise.resolve(MOCK)}):of(u,o);
    window.dispatchEvent(new Event('focus'));
    return true;
  })()`);
  await wait(1000); // 等重渲

  // 展开面板不再截断，方便整块截图
  await wc.insertCSS('.sheet{max-height:none !important; overflow:visible !important} .sheet-mask{align-items:flex-start !important; padding-top:0 !important}');

  const rectOf = (sel) => wc.executeJavaScript(
    `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.max(0,Math.floor(r.x)),y:Math.max(0,Math.floor(r.y)),width:Math.ceil(r.width),height:Math.ceil(r.height)};})()`);
  const clickSel = (sel) => wc.executeJavaScript(
    `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e){e.click();return true;}return false;})()`);
  const closeSheets = () => wc.executeJavaScript(`document.querySelectorAll('.sheet-mask').forEach(m=>m.remove());true`);

  async function shot(name, sel) {
    const rect = await rectOf(sel);
    if (!rect || !rect.width) { console.log('MISS', name, sel); return; }
    const img = await wc.capturePage(rect);
    fs.writeFileSync(path.join(OUTDIR, name + '.png'), img.toPNG());
    console.log('OK', name, JSON.stringify(rect));
  }

  // main（整个 #app）
  await shot('main', '#app');
  // 菜单
  await closeSheets(); await clickSel('#menuBtn'); await wait(400); await shot('menu', '.sheet');
  // 抽卡（主界面券徽章直接进）
  await closeSheets(); await clickSel('#tkBadge'); await wait(400); await shot('gacha', '.sheet');
  // 孵化器（菜单→孵化器）
  await closeSheets(); await clickSel('#menuBtn'); await wait(300); await clickSel('#incubatorBtn'); await wait(400); await shot('incubator', '.sheet');
  // 图鉴
  await closeSheets(); await clickSel('#menuBtn'); await wait(300); await clickSel('#dexBtn'); await wait(400); await shot('collection', '.sheet');
  // 成就
  await closeSheets(); await clickSel('#menuBtn'); await wait(300); await clickSel('#achBtn'); await wait(400); await shot('achievements', '.sheet');
  // 用量洞察
  await closeSheets(); await clickSel('#menuBtn'); await wait(300); await clickSel('#usageBtn'); await wait(700); await shot('usage', '.sheet');
  // 羁绊（主界面 bondBadge）
  await closeSheets(); await clickSel('#bondBadge'); await wait(400); await shot('bond', '.sheet');

  await closeSheets();
  console.log('done');
  app.quit();
});
