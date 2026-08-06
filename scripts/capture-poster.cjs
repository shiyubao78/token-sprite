// 一次性脚本：把 scratchpad 的 poster.html 用 Electron 渲染成高清 PNG。
// 用法：npx electron scripts/capture-poster.cjs <html路径> <输出png路径>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const htmlPath = process.argv[2];
const outPath = process.argv[3];
const W = 1500, H = 2000; // 视网膜屏 capturePage 会自动按 2x 出图

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: W, height: H, show: false, useContentSize: true,
    webPreferences: { webSecurity: false },
  });
  await win.loadFile(htmlPath);
  // 等字体/图片/JS 排版稳定
  await new Promise((r) => setTimeout(r, 1200));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(outPath, img.toPNG());
  const { width, height } = img.getSize();
  console.log(`poster saved: ${outPath} (${width}x${height})`);
  app.quit();
});
