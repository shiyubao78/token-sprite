# AGENTS.md — Token 小精灵

给 AI coding agent（Claude Code / Codex 等）读的项目说明。人也能照着看。

## 怎么运行（最重要）

Node.js 20+，macOS / Windows / Linux 均可。仓库根目录：

```bash
npm install
npm start                 # 编译 + 启动桌宠，出现在桌面右下角
npm test                  # 全量测试
npm run build             # 前端生产构建
npm run pack              # macOS universal .app 目录
npm run pack:mac:release  # macOS universal DMG、ZIP、blockmap、latest-mac.yml
```

- `npm start` = `npm run build`（Vite 构建）+ `electron .`（启动桌面壳）。退出：点桌宠 `⋯` → 退出，或使用 macOS 菜单栏入口。
- 开发热更新：`npm run dev`（终端1）+ `npm run desktop`（终端2，electron 指向 localhost:5173，用 cross-env 设环境变量以兼容 Windows）。
- 打包（在目标系统本机跑）：`npm run pack`（mac → `release/mac-universal/Token小精灵.app`）/ `pack:win`（Windows → 免安装 exe + NSIS）/ `pack:linux`（Linux → AppImage）。三系统一键出包用 `.github/workflows/build.yml`（仅 Actions 手动触发）。测试：`npm test`。
- macOS 正式发布：先更新 `package.json` 版本，再打同版本标签（如 `v1.2.3`）。`.github/workflows/release.yml` 会测试、校验版本、签名、公证、构建并创建 GitHub Release。没有仓库所有者明确授权，不得打标签或发布。
- 正式发布所需 GitHub Secrets：`MAC_CERTIFICATE_P12_BASE64`、`MAC_CERTIFICATE_PASSWORD`、`APPLE_API_KEY_P8_BASE64`、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER_ID`。不得把值写入仓库或日志。

## 这是什么

桌面桌宠（macOS / Windows / Linux 通用）+ **成就抽卡 × 孵化养成 × 图鉴收集**：读本机 AI 编程工具的真实 token 用量，token 用来孵蛋、让精灵一路进化到化形、集齐图鉴。悬浮置顶、可拖动、可收起「侧边探头」。还会陪你（连写劝歇、深夜关心、久别招手）。全本地、不联网。

**核心闭环**：写代码烧 token → 达成就领券 → 抽卡开不同稀有度的蛋 → 孵化器选一颗养 → token 喂它从蛋进化到化形 → 破壳进图鉴 → 切换谁陪你。

## 数据来源（自动检测 + 本地读取，不联网）

- `scripts/usage.mjs` 里一张 `READERS` 登记表，每个读取器 `read()` 返回 `{total, recentTokens, todayTokens, lastActivityAt}`，**没装该工具就返回 `null` 自动跳过**。
- 内置：Claude Code（`~/.claude/projects/**/*.jsonl` 的 usage）、Codex（`~/.codex/**/rollout-*.jsonl` 的 token_count）、Gemini CLI（`~/.gemini` 的 usageMetadata，best-effort）。
- 安装那刻记 `baseline`，之后**从 0 起算**（growthTotal = 当前累计 − baseline）。
- **加新工具**：往 `READERS` 加一段读取器即可（照现有例子）。只能覆盖把 token 写在本地、可解析的工具；豆包/Cursor/Trae/DeepSeek/Kimi 这类用量在服务端、本地无数据、读不到。

## 关键目录

- `src/config/rarities.js`：4 档稀有度（孵化门槛、抽中权重、颜色）。
- `src/config/species.js`：6 个品种（key、名字、稀有度、`folder`），每个一条 5 段进化线，图在 `assets/sprite/<folder>/<1-5>-*.png`。
- `src/config/achievements.js`：成就定义（`check(ctx)` + 发券稀有度）。
- `src/domain/`：`gacha.js`(抽卡) · `incubation.js`(孵化进度/段位) · `incubator.js`(抽卡→蛋/选在孵/破壳) · `achievements.js`(结算+连续天数) · `mood.js`(陪伴心情+台词) · `format.js`。均为纯逻辑、有单测。
- `src/services/`：`token-source.js`(数据源接口) · `pet-store.js`(LocalStorage 存档) · `sprites.js`(按品种文件夹加载 5 段图)。
- `src/ui/views.js`：主视图(在孵蛋/陪伴宠物) + 抽卡/孵化器/图鉴/成就面板 + 菜单模板。
- `src/main.js`：控制器（定时同步、成就发券、孵化结算、破壳演出、拖拽、收起、心情台词、各面板）。
- `scripts/usage.mjs`：本地用量读取（READERS）。`vite.config.js`：开发 `/api/usage` 中间件。
- `electron/main.js`：无边框/透明/置顶/可拖/可收起小窗，主进程 IPC 供数据、移窗、收起、开机自启。macOS 提供菜单栏召回、单实例、显示器变化/睡眠恢复防丢和正式包自动更新。`electron/window-placement.js` 是窗口几何纯逻辑，`electron/tray-menu.js` 生成菜单，`electron/update-controller.js` 管理用户确认式更新。`electron/preload.cjs`：`window.tokenSprite`（含 `platform`）。

## 约定

- 游戏逻辑只认数据源接口，不依赖具体后端。
- 存档在现有基础上扩展（券/蛋/图鉴/活跃日/陪伴品种）；行为变化先写失败测试再改实现；每个可运行阶段中文 Git 存档。
- 只读本地用量文件，不联网、不上传。形象图可替换：换 `assets/sprite/<品种>/` 下的图即可。

## 已知限制

- 三系统均支持：mac(universal)/win(portable+nsis)/linux(AppImage)。macOS 正式 Release 流水线已支持 Developer ID 签名和 Apple 公证；本地无凭证构建仍未签名。Windows/Linux 暂未建立正式签名与自动更新。
- 当前旧版没有更新器，需要用户手动安装首个签名正式版一次，此后才能应用内更新。
- 自动更新发布前必须运行 `npm run verify:update-artifacts`，确保 `latest-mac.yml` 引用的文件与实际资产同名。
- Linux 的透明/置顶效果依赖桌面环境合成器；开机自启在 Linux 未提供开关。
- 服务端用量的工具（豆包/Cursor 等）本地读不到，无法统计。
- 内置形象为 AI 生成示例图，可替换。
