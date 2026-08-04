# Token Sprite 中英双语 README 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目 README 改成以新孵化主视觉吸引用户、核心内容中英双语的 GitHub 项目首页。

**Architecture:** 用户提供的主视觉作为独立 README 素材保存，README 通过相对路径引用。正文采用中文主叙事与自然英文对照，详细技术内容保持单份，避免重复维护。

**Tech Stack:** GitHub Markdown、HTML 图片标签、PNG 项目素材。

## Global Constraints

- 第一屏展示项目名、双语价值主张和新孵化主视觉。
- 不再引用 `assets/readme/collection-shadows.png`，但不删除该文件。
- 核心介绍、玩法、卖点、安装、隐私与平台支持中英双语。
- 命令、表格与技术细节只保留一份。
- 不修改游戏逻辑。

---

### Task 1: 接入新主视觉

**Files:**
- Create: `assets/readme/hatching-hero.png`
- Modify: `README.md`

- [x] 将用户提供的 3:4 孵化主视觉复制为 `assets/readme/hatching-hero.png`。
- [x] 在 README 第一屏居中引用新图片，宽度设为 `760`。
- [x] 删除 README 对 `assets/readme/collection-shadows.png` 的引用，保留素材文件。

### Task 2: 重排双语内容

**Files:**
- Modify: `README.md`

- [x] 重写标题区、中英文价值主张和 `CODE → HATCH → EVOLVE → COLLECT` 玩法循环。
- [x] 为进化、卖点、快速安装、工作原理和平台支持补充自然英文说明。
- [x] 保留成就、稀有度、读取器、打包和自定义配置的单份技术内容。
- [x] 突出可直接交给 Agent 的中英文安装指令。

### Task 3: 验证与存档

**Files:**
- Verify: `README.md`
- Verify: `assets/readme/hatching-hero.png`

- [x] 检查 README 引用的本地图片全部存在。
- [x] 确认 README 不再包含 `collection-shadows.png`。
- [x] 检查 Markdown 代码围栏、HTML 标签和表格结构成对完整。
- [x] 运行项目测试并提交版本存档。
