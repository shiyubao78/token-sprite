<div align="center">

# 🌱 Token 小精灵

**用你真实烧掉的 AI 编程 token，孵化、养成、集齐一整墙小精灵。**

一只养在 macOS 桌面角落的桌宠 —— 你每写一段代码，它就在悄悄进化。
全程只读本地用量，**不联网、不上传**。

</div>

---

## 🥚 孵化 = 一路进化

选一颗蛋，它吃你的 token，从蛋一路长到**化形**，收进图鉴。

<div align="center">
<img src="assets/readme/evolution-flower.png" width="720" alt="蛋 → 破壳 → 成长 → 花苞 → 化形" />
</div>

## 👾 6 只精灵，破壳才揭晓是谁

达成成就攒券 → 抽卡开出**不同稀有度的蛋** → 孵化养成 → 集齐图鉴。

<div align="center">
<img src="assets/readme/collection-shadows.png" width="760" alt="6 只精灵剪影 · 破壳揭晓" />
</div>

> 草木、海洋、岩浆、雷电、冰晶、机械 —— 每只都有自己的 5 段进化线。你会先抽到谁？

## ✨ 它凭什么不一样

- **真实劳动养出来**：读本地 **Claude Code / Codex** 的真实 token 用量，装不出、刷不了。
- **会陪你**：连写久了劝你歇口气、深夜提醒早点睡、久别重逢招手 —— 从"被看"变"陪你"。
- **桌宠**：悬浮置顶、可拖动，还能收成"侧边探头"不占地方。
- **越集越上头**：成就 → 抽卡 → 孵化 → 图鉴，收集驱动。
- **全本地私密**：数据只在你电脑本地读取。

## 🎴 成就 · 稀有度

| 稀有度 | 孵化门槛 | 抽中概率 |
|---|---|---|
| 🟢 普通 | 0.5B token | 高 |
| 🔵 稀有 | 2B token | 中 |
| 🟣 史诗 | 8B token | 低 |
| 🟡 传说 | 30B token | 极低 |

达成「初出茅庐 / 双修 / 昼夜不息 / 爆种 / 一周不辍 / 里程碑 / 传说之路」等成就得券 —— 全用你的真实用量判定。

## 🚀 快速开始

需要 [Node.js](https://nodejs.org/) 20+（macOS，Intel / Apple 芯片通用）。

```bash
git clone https://github.com/shiyubao78/token-sprite.git
cd token-sprite
npm install
npm start
```

`npm start` 自动编译并启动，小精灵出现在桌面右下角。

### 🤖 或者一句话让 agent 帮你装

仓库带了 `AGENTS.md` / `CLAUDE.md`，直接对 Claude Code、Codex 说：

> “把 github.com/shiyubao78/token-sprite clone 下来，在我桌面跑起来。”

## 🧩 它怎么工作

**自动检测**你本地装了哪些 AI 工具，能读到 token 的就统计、没装的自动跳过：

| 工具 | 读取位置 |
|---|---|
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| Codex | `~/.codex/**/rollout-*.jsonl` |

安装那刻记一个基准，之后**从 0 开始养** —— 你写多少，它长多少。

> 只能统计把 token **写在本地、可解析**的工具（多为 CLI）；豆包 / Cursor / Trae / DeepSeek / Kimi 这类用量在服务端、本地无数据，**任何本地工具都读不到**。

### 想让它认出你的工具？加一个读取器（十行）

用了别的会写本地日志的 CLI（Gemini CLI、OpenCode、Aider…）？在 `scripts/usage.mjs` 的 `READERS` 里照着加一段即可，装了就自动纳入、没装自动跳过：

```js
async function readYourTool() {
  const root = join(homedir(), '.yourtool');
  if (!(await exists(root))) return null;           // 没装 → 跳过
  let total = 0, recentTokens = 0, todayTokens = 0, lastActivityAt = 0;
  // 遍历该工具的本地日志，累加 token、记录最近/今日/时间戳……
  return { total, recentTokens, todayTokens, lastActivityAt };
}
export const READERS = [
  /* …已有的 Claude Code、Codex… */
  { source: 'yourtool', label: 'Your Tool', read: readYourTool },
];
```

💡 因为你多半也在用 AI agent，可以直接让它帮你写：**“看看我本地 &lt;工具&gt; 的用量日志格式，给 token-sprite 的 `scripts/usage.mjs` 加一个读取器。”** 欢迎 PR 回来惠及大家。

## 📦 打包成 .app

```bash
npm run pack     # 产物在 release/mac-universal/Token小精灵.app
```

未签名、Intel / Apple 通用版。首次打开若被拦，右键 →「打开」一次即可。打包后默认开启开机自启（菜单里可关）。

## 🔧 自定义

- 品种、稀有度、名字、图路径：`src/config/species.js`
- 成就、门槛、抽卡概率：`src/config/achievements.js` / `src/config/rarities.js`
- 换形象：把 5 段图放进 `assets/sprite/<品种>/`（`1-seed` … `5-adult`，512 透明 PNG）

## 📄 License

MIT，见 [LICENSE](LICENSE)。内置形象为 AI 生成，仅作示例，可自行替换。
