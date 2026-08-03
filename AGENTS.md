# AGENTS.md — Token 小精灵

给 AI coding agent（Claude Code / Codex 等）读的项目说明。人也能照着看。

## 怎么运行（最重要）

macOS + Node.js 20+。在仓库根目录：

```bash
npm install
npm start          # 编译 + 启动桌宠，出现在桌面右下角
```

- `npm start` = `npm run build`（Vite 构建网页层）+ `electron .`（启动桌面壳）。
- 退出：点桌宠 `⋯` → 退出。
- 只想开发网页层热更新：`npm run dev`（终端1）+ `npm run desktop`（终端2，electron 指向 localhost:5173）。
- 打包可分发的 `.app`：`npm run pack` → `release/mac-arm64/Token小精灵.app`。
- 跑测试：`npm test`（Vitest）。

## 这是什么

一只 macOS 桌面桌宠，用本机 AI 编程工具的**真实 token 用量**自动养大。悬浮置顶、可拖动、点击有互动。5 段进化（种子→嫩芽→幼苗→花苞→化形小精灵），token 累积成长、不用喂；超 24 小时无新消耗回落一级。

## 数据来源（自动检测 + 本地读取，不联网）

- `scripts/usage.mjs` 里有一张 `READERS` 登记表，每个读取器 `read()` 返回 `{total, lastActivityAt}`，**没装该工具就返回 `null` 自动跳过**。
- 内置：Claude Code（`~/.claude/projects/**/*.jsonl` 的 `usage`）、Codex（`~/.codex/**/rollout-*.jsonl` 的 `token_count` 事件 `last_token_usage`）。
- 求和 = 累计 token；取最近时间戳 = 最近活跃。
- **加新工具**：往 `READERS` 加一行读取器即可（先 `detect` 有没有装、再 `read` 解析）。只能覆盖**把 token 写在本地、可解析**的工具；app/网页类（豆包/DeepSeek/Kimi 等）用量在服务端、本地无数据、无法统计。

## 关键目录

- `src/config/stages.js`：5 段（名字、`art` 图号、累积阈值）+ `DECAY_MS`。**调平衡只改这里**。
- `src/domain/growth.js`：`stageFor`/`progressFor`/`decayLevels`/`effectiveStage`（纯逻辑，有单测）。
- `src/services/token-source.js`：`LocalUsageSource.getUsage()`；优先 Electron IPC(`window.tokenSprite`) → `/api/usage`(网页) → `/usage.json`(静态)。
- `src/services/pet-store.js`：LocalStorage 存档 + 损坏兜底。
- `src/services/sprites.js`：按 `art` 号加载 `assets/sprite/stage-N.png`。
- `src/ui/views.js`：桌宠视图 + 图鉴 + 菜单模板。`src/main.js`：控制器（定时同步、自动成长、进化、蔫、点击互动、拖动、菜单）。
- `scripts/usage.mjs`：本地用量读取。`scripts/sync.mjs`：写 `public/usage.json`。
- `electron/main.js`：无边框/透明/置顶/可拖动小窗，主进程经 IPC 供数据、移动窗口、开机自启。`electron/preload.cjs`：`contextBridge` 暴露 `window.tokenSprite`。
- `assets/sprite/stage-*.png`：形象（512×512 透明 PNG）；当前用 1/2/3/4/7。

## 约定

- 游戏逻辑只认数据源接口 `getUsage()`，不依赖具体来源。
- 当前形态 = `effectiveStage(累计 token, 距最近活跃的空窗)`：累积得基础等级，空窗每满 24h 回落一级、最低种子。
- 行为变化先写失败测试再改实现；每个可运行阶段做中文 Git 存档。
- 不联网、不上传，只在本机读本地用量文件。

## 已知限制

- 仅 macOS / Apple 芯片（Intel 需改 `universal` 打包）；`.app` 未签名（首次右键→打开）。
- 数字只含 Claude Code + Codex 本地日志。
- 内置形象为 AI 生成示例图，可替换。
