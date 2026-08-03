# 🌱 Token 小精灵

一只养在 macOS 桌面上的小精灵——用你**在本地 AI 编程工具里真实烧掉的 token** 自动喂养，从种子一路长成会发光的小精灵。悬浮在桌面角落，写代码时一抬头就看见它在长大。

> A desktop pet for macOS that grows from your real local AI-coding token usage (Claude Code + Codex). Everything is read **locally** — nothing is uploaded.

## ✨ 一眼看懂

- 读你本机 **Claude Code** 和 **Codex** 的用量，token 越烧越多，小精灵越长越大。
- **5 段进化**：种子 → 嫩芽 → 幼苗 → 花苞 → 化形·小精灵。
- **累积成长、不用喂**：自动读、自动长。
- **会蔫**：超过 24 小时没有新消耗就退一级，写代码就长回来。
- **点一下**逗它（弹跳+星星），**按住拖**能在桌面上挪位置。
- 全程只读本地文件，**不联网、不上传**。

## 🚀 快速开始

需要 [Node.js](https://nodejs.org/) 20+（macOS，Intel / Apple 芯片通用）。

```bash
git clone https://github.com/shiyubao78/token-sprite.git
cd token-sprite
npm install
npm start
```

`npm start` 会自动编译并启动，小精灵出现在桌面右下角。退出：点它 `⋯` → 退出。

## 🤖 让你的 AI agent 帮你装

因为仓库里带了 `AGENTS.md` / `CLAUDE.md`，你可以直接对 Claude Code、Codex 等 agent 说一句：

> “把 github.com/shiyubao78/token-sprite clone 下来，在我桌面跑起来。”

agent 会读到仓库里的运行说明，自动完成 clone → `npm install` → `npm start`。

## 🧩 它怎么工作

| 工具 | 读取位置 | 统计口径 |
|---|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` | 每条回复的 usage（输入+输出+缓存 token） |
| Codex | `~/.codex/**/rollout-*.jsonl` | `token_count` 事件的 `last_token_usage` |

本机没装的工具会自动跳过。数据只在你电脑本地读取和展示。

## 🔧 自定义

- 进化阈值、形态名字、用哪张图：`src/config/stages.js`（`DECAY_MS` 是回落时长）。
- 换形象：把图片放进 `assets/sprite/stage-N.png`（512×512 透明 PNG），改 `stages.js` 里的 `art` 号即可。

## 📦 打包成 .app

```bash
npm run pack     # 产物在 release/mac-universal/Token小精灵.app
```

未签名、Intel / Apple 通用版。首次打开若被拦，右键 →「打开」一次即可。打包后首次运行默认开启开机自启（菜单里可关）。

## ⚠️ 说明

- 目前仅 macOS（Intel / Apple 芯片通用）。
- 数字只含 Claude Code + Codex 本地日志，不代表你的全部用量。
- 内置形象为 AI 生成图，仅作示例，可自行替换。

## 📄 License

MIT，见 [LICENSE](LICENSE)。
