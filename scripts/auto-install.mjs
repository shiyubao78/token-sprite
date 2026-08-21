// 判断 npm install 之后该不该自动把桌宠重装一遍。
//
// 为什么要自动：用户（或帮他干活的 agent）拉完代码常常忘了重装，
// 或者用 npm start 交差——那是开发态，会话一结束桌宠就没了。
//
// 为什么要克制：自动打包要 2-3 分钟、还会覆盖 /Applications 里的 app。
// 所以只在「这台机器上已经装过、这次明显是更新」时才做。

export function shouldAutoInstall({ platform, env = {}, appInstalled }) {
  if (platform !== 'darwin') {
    return { run: false, reason: 'not-macos' }; // 只有 mac 有一键安装脚本
  }
  if (env.CI) {
    return { run: false, reason: 'ci' };
  }
  if (env.TS_NO_AUTO_INSTALL) {
    return { run: false, reason: 'opted-out' };
  }
  if (!appInstalled) {
    // 首次 clone（多半是开发者），别擅自往 /Applications 里塞东西
    return { run: false, reason: 'first-time' };
  }
  return { run: true, reason: 'update' };
}

export function messageFor(reason) {
  const m = {
    'first-time': '\n🌱 依赖装好了。要把桌宠装成常驻 app（关终端也不会没）：\n   npm run install:local\n',
    'opted-out': '\n（已跳过自动重装：TS_NO_AUTO_INSTALL）\n',
    update: '\n🌱 检测到你已经装过桌宠，正在用这次的新代码重装一遍…\n   （不想每次都自动装：TS_NO_AUTO_INSTALL=1 npm install）\n',
  };
  return m[reason] || '';
}
