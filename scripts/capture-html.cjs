// 一次性脚本：把一个固定宽度的 HTML 页面按内容高度截成高清 PNG。
// 用法：npx electron scripts/capture-html.cjs <html> <out.png> [width]
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const htmlPath = process.argv[2];
const outPath = process.argv[3];
const W = Number(process.argv[4]) || 1560;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: 1000, show: false, useContentSize: true, webPreferences: { webSecurity: false } });
  await win.loadFile(htmlPath);
  await wait(1200); // 等图片加载
  const h = await win.webContents.executeJavaScript('Math.ceil(document.body.getBoundingClientRect().height)');
  win.setContentSize(W, h);
  await wait(500);
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: h });
  fs.writeFileSync(outPath, img.toPNG());
  const s = img.getSize();
  console.log(`saved ${outPath} ${s.width}x${s.height}`);
  app.quit();
});
