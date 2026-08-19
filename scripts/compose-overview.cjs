// 把 capture-overview 出的 8 张面板图拼成 README/宣传用的「界面一览」大图。
// 用法：npx electron scripts/compose-overview.cjs <面板图目录> <输出.png> [zh|en]
//
// 之前这一步是手工拼的、没留下来，改一行文案就得重做整张图。现在固化成脚本：
// 改了界面文案 → 重跑 capture-overview + 本脚本，图自动跟上。
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SHOTS = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const LOCALE = process.argv[4] === 'en' ? 'en' : 'zh';
const W = 1400;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const TEXT = {
  zh: {
    title: 'Token 小精灵 · 界面一览',
    sub: '读本机 AI 编程 token，养成 · 抽卡 · 孵化 · 图鉴 · 羁绊 · 用量',
    cells: [
      ['main', '主界面', '桌宠陪伴 · token 喂养化形 · 羁绊'],
      ['menu', '功能菜单', '起名 · 抽卡 · 孵化 · 图鉴 · 用量'],
      ['gacha', '成就抽卡', '达成成就得券，抽稀有新蛋'],
      ['incubator', '孵化器', '蛋吃 token 进化，可一键设为在养'],
      ['collection', '图鉴收集', '集齐每个品种的进化全程'],
      ['achievements', '成就', '里程碑解锁，新手也有惊喜'],
      ['usage', '用量洞察', '看 token 花在哪、约花了多少钱'],
      ['bond', '羁绊', '化形后开始，写码 + 互动升温'],
    ],
  },
  en: {
    title: 'Token Sprite · Interface Tour',
    sub: 'Reads your local AI coding tokens — raise · draw · hatch · collect · bond · usage',
    cells: [
      ['main', 'Main', 'Desktop companion · fed by tokens · bond'],
      ['menu', 'Menu', 'Name · draw · hatch · collection · usage'],
      ['gacha', 'Draw', 'Earn tickets from achievements, draw rare eggs'],
      ['incubator', 'Incubator', 'Eggs eat tokens to evolve; set one as active'],
      ['collection', 'Collection', 'Complete every species’ evolution line'],
      ['achievements', 'Achievements', 'Milestones unlock as you go'],
      ['usage', 'Usage', 'Where your tokens go, and roughly what it costs'],
      ['bond', 'Bond', 'Starts after transformation; grows as you code'],
    ],
  },
}[LOCALE];

const cell = ([file, name, desc]) => `
  <div class="cell${file === 'main' ? ' is-main' : ''}">
    <div class="shot"><img src="file://${path.join(SHOTS, file)}.png" alt=""/></div>
    <div class="cap">${name}</div>
    <div class="desc">${desc}</div>
  </div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: ${W}px; padding: 52px 48px 44px;
    background: linear-gradient(160deg, #f7f4ec 0%, #eef3e6 55%, #e6efdd 100%);
    font: 15px/1.6 -apple-system, "PingFang SC", "Helvetica Neue", sans-serif; color: #3d3730; }
  h1 { font-size: 40px; font-weight: 400; text-align: center; letter-spacing: 1px; }
  .sub { text-align: center; color: #8f836d; font-size: 17px; margin: 12px 0 44px; letter-spacing: .5px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 34px 26px; align-items: start; }
  .cell { text-align: center; }
  .shot { display: flex; justify-content: center; align-items: flex-start; }
  .shot img { width: 100%; height: auto; border-radius: 14px;
    box-shadow: 0 6px 22px rgba(90, 80, 60, .13); }
  .cell.is-main .shot img { width: auto; max-width: 100%; border-radius: 18px; }
  .cap { font-size: 20px; margin-top: 16px; }
  .desc { font-size: 14px; color: #8f836d; margin-top: 5px; line-height: 1.5; }
</style></head><body>
  <h1>${TEXT.title}</h1>
  <div class="sub">${TEXT.sub}</div>
  <div class="grid">${TEXT.cells.map(cell).join('')}</div>
</body></html>`;

const tmp = path.join(require('os').tmpdir(), `overview-${LOCALE}-${process.pid}.html`);
fs.writeFileSync(tmp, html);

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W, height: 1200, show: false, useContentSize: true,
    webPreferences: { offscreen: true, webSecurity: false },
  });
  win.webContents.setFrameRate(30);
  await win.loadFile(tmp);
  await wait(1800);
  const h = await win.webContents.executeJavaScript('Math.ceil(document.body.getBoundingClientRect().height)');
  win.setContentSize(W, h);
  await wait(1400);
  const img = await win.webContents.capturePage();
  fs.writeFileSync(OUT, img.toPNG());
  fs.rmSync(tmp, { force: true });
  const s = img.getSize();
  console.log(`saved ${OUT} ${s.width}x${s.height}`);
  app.quit();
}).catch((e) => { console.error('FAIL', e && e.message); app.quit(); });
