# Token 小精灵 macOS 正式发布、自动更新与防丢 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Token 小精灵补齐 macOS 菜单栏召回、窗口自动防丢、GitHub Release 自动更新以及签名公证发布流水线。

**Architecture:** 将窗口几何、Tray 菜单和更新控制从 `electron/main.js` 分离成小模块；纯逻辑用 Vitest 测试，Electron 主进程只做系统事件接线。Electron Builder 生成 universal DMG、ZIP 和更新元数据，GitHub Actions 在 `v*` 标签上测试、校验版本、签名、公证并发布。

**Tech Stack:** Electron 33、Electron Builder 25、electron-updater、Vite 7、Vitest 4、GitHub Actions、Apple Developer ID。

## Global Constraints

- 本期正式发布和自动更新只覆盖 macOS；Windows/Linux 现有手动构建不得被破坏。
- 更新必须由用户确认下载和确认重启，不得强制中断。
- 开发环境不得访问更新服务。
- 用户成长数据不得因覆盖安装或自动更新被删除或重置。
- Apple 证书、密码、公证凭证只允许从 GitHub Secrets 读取。
- 未获得明确授权不得创建公开 Release。
- 所有行为变更先写失败测试，再写最小实现。

---

### Task 1: 可测试的窗口防丢几何模块

**Files:**
- Create: `electron/window-placement.js`
- Create: `electron/window-placement.test.js`

**Interfaces:**
- Consumes: Electron 风格矩形 `{ x, y, width, height }`。
- Produces: `rectsIntersect(rect, area): boolean`、`isVisibleOnAnyDisplay(bounds, workAreas): boolean`、`bottomRightBounds(workArea, size, margin = 24): Bounds`、`clampBoundsToWorkArea(bounds, workArea): Bounds`。

- [ ] **Step 1: 写窗口几何失败测试**

覆盖完整可见、部分可见、完全越界、负坐标副屏、上下排列副屏、FULL/PEEK 两种尺寸和 24px 右下边距：

```js
import { describe, expect, it } from 'vitest';
import { bottomRightBounds, isVisibleOnAnyDisplay } from './window-placement.js';

it('窗口完全在所有屏幕外时判定为不可见', () => {
  const displays = [{ x: 0, y: 0, width: 1440, height: 900 }];
  expect(isVisibleOnAnyDisplay({ x: 2000, y: 100, width: 236, height: 348 }, displays)).toBe(false);
});

it('按目标尺寸放到工作区右下角', () => {
  expect(bottomRightBounds({ x: -1280, y: 0, width: 1280, height: 800 }, { width: 56, height: 104 }))
    .toEqual({ x: -80, y: 672, width: 56, height: 104 });
});
```

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `npx vitest run electron/window-placement.test.js`

Expected: FAIL，原因是 `electron/window-placement.js` 尚不存在。

- [ ] **Step 3: 实现最小纯函数**

```js
export function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function isVisibleOnAnyDisplay(bounds, workAreas) {
  return workAreas.some((area) => rectsIntersect(bounds, area));
}

export function bottomRightBounds(area, size, margin = 24) {
  return {
    x: area.x + area.width - size.width - margin,
    y: area.y + area.height - size.height - margin,
    width: size.width,
    height: size.height,
  };
}
```

`clampBoundsToWorkArea` 必须同时处理工作区比窗口更小的情况，不能产出 NaN 或反向坐标。

- [ ] **Step 4: 运行定向测试并确认通过**

Run: `npx vitest run electron/window-placement.test.js`

Expected: PASS。

- [ ] **Step 5: 存档**

```bash
git add electron/window-placement.js electron/window-placement.test.js
git commit -m "增加小精灵窗口防丢定位规则"
```

### Task 2: 菜单栏、单实例与系统级召回

**Files:**
- Create: `electron/tray-menu.js`
- Create: `electron/tray-menu.test.js`
- Modify: `electron/main.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createTrayMenuTemplate({ version, autoLaunch, updateEnabled, onRecall, onCheckUpdates, onToggleAutoLaunch, onQuit })`。
- Produces: Electron `Menu.buildFromTemplate` 可接受的菜单模板；主进程函数 `recallSprite({ forceMove?: boolean })` 和 `ensureSpriteVisible()`。

- [ ] **Step 1: 写 Tray 菜单失败测试**

验证顺序、版本文案、开发环境禁用更新、开机启动勾选状态，并直接调用 click 回调确认动作被转发：

```js
it('生成固定五项菜单并转发召回动作', () => {
  const onRecall = vi.fn();
  const menu = createTrayMenuTemplate({
    version: '1.0.0', autoLaunch: true, updateEnabled: true,
    onRecall, onCheckUpdates: vi.fn(), onToggleAutoLaunch: vi.fn(), onQuit: vi.fn(),
  });
  expect(menu.filter((item) => item.type !== 'separator').map((item) => item.label))
    .toEqual(['召回小精灵', '检查更新', '开机启动', '当前版本 1.0.0', '退出']);
  menu[0].click();
  expect(onRecall).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `npx vitest run electron/tray-menu.test.js`

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现菜单模板与主进程接线**

`electron/tray-menu.js` 只生成模板，不直接依赖 Electron。`electron/main.js` 完成以下接线：

```js
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else app.on('second-instance', () => recallSprite({ forceMove: true }));

screen.on('display-added', ensureSpriteVisible);
screen.on('display-removed', ensureSpriteVisible);
screen.on('display-metrics-changed', ensureSpriteVisible);
powerMonitor.on('resume', ensureSpriteVisible);
```

召回目标使用 `screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea`。召回时若处于 PEEK 尺寸，先恢复 FULL；随后 `show()`、设置右下角 bounds、`setAlwaysOnTop`、`focus()`。普通系统检查只在窗口与所有工作区完全无交集时移动。

macOS 创建 `Tray` 并设置 tooltip；通过 `nativeImage.createFromPath(path.join(app.getAppPath(), 'build/icon.png')).resize({ width: 18, height: 18 })` 从现有图标生成菜单栏图标。把 `build/icon.png` 加入 Electron Builder 的 `files`，保证打包后路径存在。Tray 引用保存到模块级变量，避免被垃圾回收。

- [ ] **Step 4: 运行测试和生产构建**

Run: `npx vitest run electron/window-placement.test.js electron/tray-menu.test.js && npm run build`

Expected: 全部 PASS，Vite 构建成功。

- [ ] **Step 5: 手动验证单实例和召回**

Run: `npm start`

Expected: 菜单栏出现入口；把窗口拖到外接屏再断开或通过开发调试移到屏幕外后能找回；再次启动不出现第二只。

- [ ] **Step 6: 存档**

```bash
git add electron/main.js electron/tray-menu.js electron/tray-menu.test.js package.json
git commit -m "增加菜单栏召回和窗口自动防丢"
```

### Task 3: 用户确认式自动更新控制器

**Files:**
- Create: `electron/update-controller.js`
- Create: `electron/update-controller.test.js`
- Modify: `electron/main.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `createUpdateController({ updater, dialog, app, isEnabled, startupDelayMs, intervalMs })`。
- Produces: `{ start(): void, check({ userInitiated?: boolean }): Promise<void>, dispose(): void, enabled: boolean }`。

- [ ] **Step 1: 写更新状态失败测试**

使用假的 updater 事件发射器覆盖：开发环境不检查、启动延迟、用户确认后才下载、下载完成后确认才安装、主动检查无更新提示、后台错误静默、主动检查错误提示。

```js
it('发现版本后只有用户同意才下载', async () => {
  const updater = fakeUpdater();
  const dialog = { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };
  const controller = createUpdateController({ updater, dialog, app: fakeApp(), isEnabled: true });
  controller.start();
  updater.emit('update-available', { version: '1.1.0', releaseNotes: '新功能' });
  await flushPromises();
  expect(updater.downloadUpdate).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `npx vitest run electron/update-controller.test.js`

Expected: FAIL，更新控制器尚不存在。

- [ ] **Step 3: 安装运行时依赖并实现控制器**

Run: `npm install electron-updater@^6.6.2`

配置：

```js
updater.autoDownload = false;
updater.autoInstallOnAppQuit = true;
```

`start()` 仅在 `isEnabled === true` 时创建启动延时和低频定时器。`check()` 防止并发检查。事件对话框按钮固定使用中文：发现更新为“下载更新/稍后”，下载完成为“重启并更新/稍后”。releaseNotes 统一转换成安全的纯文本摘要，不向对话框注入 HTML。

- [ ] **Step 4: 接入主进程和 Tray 主动检查**

在 `app.whenReady()` 后动态导入 `electron-updater`，只对 `app.isPackaged && process.platform === 'darwin'` 启用。Tray 的“检查更新”调用 `check({ userInitiated: true })`；开发环境菜单项禁用并显示开发版本状态。

- [ ] **Step 5: 运行定向测试和全量测试**

Run: `npx vitest run electron/update-controller.test.js && npm test`

Expected: 全部 PASS，不产生真实网络请求。

- [ ] **Step 6: 存档**

```bash
git add electron/main.js electron/update-controller.js electron/update-controller.test.js package.json package-lock.json
git commit -m "增加用户确认式自动更新"
```

### Task 4: macOS 签名、公证和 GitHub Release 流水线

**Files:**
- Create: `build/entitlements.mac.plist`
- Create: `scripts/notarize.cjs`
- Create: `scripts/verify-release-version.mjs`
- Create: `scripts/verify-release-version.test.js`
- Modify: `package.json`
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/build.yml`

**Interfaces:**
- Consumes: `verifyReleaseVersion(tag, packageVersion)`，标签格式必须为 `v<packageVersion>`。
- Produces: universal `.dmg`、`.zip`、`.blockmap`、`latest-mac.yml` 和 GitHub Release。

- [ ] **Step 1: 写版本校验失败测试**

```js
it('接受与应用版本一致的 v 标签', () => {
  expect(verifyReleaseVersion('v1.2.3', '1.2.3')).toBe('1.2.3');
});

it.each([
  ['v1.2.4', '1.2.3'],
  ['release-1.2.3', '1.2.3'],
])('拒绝无效发布标签 %s', (tag, version) => {
  expect(() => verifyReleaseVersion(tag, version)).toThrow(/不一致|格式/);
});
```

CLI 从 `GITHUB_REF_NAME` 和 `package.json` 读取值，失败时以非零状态退出。

- [ ] **Step 2: 运行定向测试并确认失败**

Run: `npx vitest run scripts/verify-release-version.test.js`

Expected: FAIL，脚本尚不存在。

- [ ] **Step 3: 实现版本校验并调整 Electron Builder**

`package.json` 调整为：

```json
{
  "build": {
    "mac": {
      "target": [{ "target": "dmg", "arch": ["universal"] }, { "target": "zip", "arch": ["universal"] }],
      "hardenedRuntime": true,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "afterSign": "scripts/notarize.cjs",
    "publish": [{ "provider": "github", "owner": "shiyubao78", "repo": "token-sprite" }]
  }
}
```

移除 `identity: null`。安装 `@electron/notarize`，由 `scripts/notarize.cjs` 在 `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER` 三项齐全时调用 `notarize({ appPath, appleApiKey, appleApiKeyId, appleApiIssuer })`；三项全空时明确跳过本地公证，只有部分存在时抛错。新增 `pack:mac:release`，运行 `npm run build && electron-builder --mac dmg zip --universal --publish never`；保留 `pack` 作为本地目录构建，避免日常开发每次生成安装包。

- [ ] **Step 4: 重写 tag 发布工作流**

`.github/workflows/release.yml` 的发布 job 必须依次：`npm ci` → `npm test` → 版本校验 → 导入 `CSC_LINK/CSC_KEY_PASSWORD` → 将 API Key 解码到临时文件并设置 `APPLE_API_KEY`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER` → `pack:mac:release` → 上传所有更新资产到同一个 Release。

Secrets 名称固定为：

- `MAC_CERTIFICATE_P12_BASE64`
- `MAC_CERTIFICATE_PASSWORD`
- `APPLE_API_KEY_P8_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER_ID`

工作流将 base64 内容写入 runner 临时目录，步骤结束后由临时 runner 销毁；不得输出内容。将 `.github/workflows/build.yml` 改为只允许 `workflow_dispatch`，避免 tag 重复构建发布。

- [ ] **Step 5: 运行测试、配置检查和安装包构建**

Run: `npm test && npm run build && npm run pack:mac:release`

Expected: 测试和构建通过；无签名凭证的本机生成 unsigned DMG、ZIP、blockmap 和 `latest-mac.yml`，文件均非空。不得声称签名或公证通过。

- [ ] **Step 6: 存档**

```bash
git add build/entitlements.mac.plist scripts/notarize.cjs scripts/verify-release-version.mjs scripts/verify-release-version.test.js package.json package-lock.json .github/workflows/release.yml .github/workflows/build.yml
git commit -m "建立 macOS 签名公证和正式发布流水线"
```

### Task 5: 使用说明、项目记忆与完整验收

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Create: `memory.md` if absent

**Interfaces:**
- Consumes: 前四项任务的实际菜单文案、命令、Secrets 名称和产物名称。
- Produces: 面向用户的安装/更新说明和面向维护者的发布清单。

- [ ] **Step 1: 更新用户说明**

README 明确区分：

- 普通用户从 GitHub Release 下载 DMG。
- 旧版用户需要手动安装首个正式版一次。
- 后续版本可从菜单栏“检查更新”。
- 小精灵不见时点菜单栏图标 → “召回小精灵”。
- 源码开发仍使用 `npm install && npm start`。

- [ ] **Step 2: 更新维护说明和 memory**

AGENTS.md 写入准确命令：`npm test`、`npm run build`、`npm run pack`、`npm run pack:mac:release`。列出五个 GitHub Secrets，说明打 tag 前必须先更新 `package.json` 版本，且正式发布必须得到仓库所有者明确授权。

`memory.md` 记录已完成能力、尚缺的 Apple 凭证、首次发布迁移提醒和下一步真机验证项。

- [ ] **Step 3: 完整自动验证**

Run: `npm test && npm run build && npm run pack && npm run pack:mac:release`

Expected: 所有测试通过；Vite 构建成功；`.app`、DMG、ZIP、blockmap、`latest-mac.yml` 均生成且非空。

- [ ] **Step 4: macOS 桌面真机验证**

启动目录构建，依次确认：Tray 菜单五项、召回、收起后召回、窗口越界恢复、重复启动单实例、开机启动勾选、开发环境更新项禁用。记录无法在无签名凭证下验证的签名、公证和真实 Release 更新链路。

- [ ] **Step 5: 最终自检并存档**

Run: `git diff --check && git status --short`

Expected: 无空白错误，只包含本计划范围内的文档改动。

```bash
git add README.md AGENTS.md memory.md
git commit -m "补齐安装更新和发布维护说明"
```

## 完成标准

- 自动测试、生产构建、目录构建和 macOS 更新安装包构建全部通过。
- 菜单栏能召回小精灵；屏幕变化后完全越界的窗口自动恢复；重复启动只有一个实例。
- 已打包 macOS 应用能按用户确认流程检查、下载并安装 GitHub Release 更新。
- Release 工作流具备版本校验、签名、公证和更新资产发布步骤，且不泄露凭证。
- 没有 Apple 凭证或测试 Release 时，交付说明明确标为“待仓库所有者完成”，不虚报验证结果。
