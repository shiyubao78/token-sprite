# Token Sprite Prompt 孵化海报制作计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 制作一张展示“Prompt → 消耗 Token → 孵化桌面精灵”的 3:4 新海报。

**Architecture:** 先用图像生成制作无字桌面孵化主视觉，再本地叠加准确英文标题、三项卖点与 Agent 安装入口。最终以原尺寸和手机缩略图双重验收。

**Tech Stack:** 内置图像生成工具、项目角色参考 PNG、本地图片排版工具。

## Global Constraints

- 画幅为 3:4 竖版。
- 屏幕展示 Prompt 对话，不出现代码。
- 主逻辑是 Prompt 消耗 Token 并喂养精灵蛋。
- 三项卖点必须是真实功能：稀有抽蛋、用量与花费、本地隐私。
- 英文和 GitHub 地址必须逐字准确。
- 最终文件保存到 `assets/promo/`，不覆盖现有海报。

---

### Task 1: 生成无字主视觉

**Files:**
- Reference: `assets/readme/interface-overview.png`
- Reference: `assets/sprite/00-flower-spirit/2-sprout.png`
- Create: `assets/promo/token-sprite-prompt-hatching-art.png`

- [x] 生成深夜桌面、Prompt 对话屏幕、Token 能量流和破壳精灵的 3:4 无字主视觉。
- [x] 检查屏幕没有代码与乱码，能量来源和孵化关系明确。
- [x] 检查未知精灵可爱、原创且只露出局部，不提前完全揭晓。

### Task 2: 英文信息排版

**Files:**
- Create: `assets/promo/token-sprite-prompt-hatching.png`

- [x] 叠加唯一主标题 `PROMPT. BURN TOKENS. HATCH COMPANIONS.`。
- [x] 叠加 `HATCH THE RARE`、`KNOW YOUR SPEND`、`KEEP IT LOCAL` 三张卖点卡及说明。
- [x] 叠加 Agent 安装指令与 GitHub 地址。
- [x] 保持标题、主视觉、卖点和行动入口层级清楚。

### Task 3: 验证与存档

**Files:**
- Create: `assets/promo/token-sprite-prompt-hatching-mobile-preview.jpg`

- [x] 验证最终海报为精确 3:4，PNG 文件完整。
- [x] 在 360×480 手机缩略图下检查标题、孵化关系和 GitHub 地址。
- [x] 运行项目测试并提交版本存档。
