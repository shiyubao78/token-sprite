# Token Sprite 中英双语 README 设计

## 目标

把 GitHub README 改成中文主叙事、英文紧随其后的双语项目首页。第一屏用孵化主视觉吸引用户，并让中英文读者快速看懂玩法、隐私特点与安装方式。

## 语言策略

- 核心内容双语：项目简介、玩法循环、核心卖点、快速安装、隐私与平台支持。
- 详细内容精简双语：成就和稀有度表保留一份，用双语表头或英文引导句说明。
- 开发者扩展、打包细节和自定义配置以中文为主，标题带英文，避免 README 长度翻倍。
- 英文按自然产品文案重写，不逐字机械翻译。

## 页面结构

1. 居中标题 `Token 小精灵 / Token Sprite`。
2. 中英文一句话价值主张。
3. 新孵化主视觉，使用用户提供的深蓝紫发光蛋与六只精灵画面。
4. 一行玩法循环：`CODE → HATCH → EVOLVE → COLLECT`，附中英文解释。
5. `孵化与进化 / Hatch & Evolve`：保留现有五段进化图。
6. `为什么特别 / Why It’s Different`：五条核心卖点中英双语。
7. `成就与抽蛋 / Achievements & Hatching`：保留一份数值表，补英文引导。
8. `快速开始 / Quick Start`：命令共用，说明中英双语；突出让 Agent 直接安装的自然语言指令。
9. `工作原理 / How It Works`：隐私、支持的数据来源与限制提供双语摘要。
10. 开发者扩展、打包、自定义和许可保持精简。

## 图片调整

- 将用户提供的图片复制为 `assets/readme/hatching-hero.png`，README 顶部宽度设为约 760px。
- 删除 README 对 `assets/readme/collection-shadows.png` 的引用，不删除原文件，避免不可逆操作并保留历史素材。
- 保留 `assets/readme/evolution-flower.png`，继续说明五段进化。
- 所有图片补充中英文 `alt` 文本。

## 文案重点

- 中文：`你写下的每个 Token，都在让它长大。`
- 英文：`Every token you write helps it grow.`
- 玩法：`CODE → HATCH → EVOLVE → COLLECT`
- Agent 安装：让用户把仓库地址直接交给 Agent，不要求用户理解安装命令。

## 验收标准

- README 第一屏能看到项目名、双语价值主张和新孵化主视觉。
- README 不再引用 `collection-shadows.png`。
- 中文读者保留原有信息密度，英文读者能独立理解玩法、卖点、安装、隐私和平台支持。
- GitHub Markdown 中图片、表格、代码块和锚点结构正确。
- 不修改游戏逻辑，不删除原有素材文件。
