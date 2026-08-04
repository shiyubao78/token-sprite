# Token 小精灵海报制作计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成一张可直接传播的 3:4 竖版 Token 小精灵宣传海报。

**Architecture:** 先基于项目现有六只成年精灵与五段成长素材生成无字主视觉，再通过本地排版叠加准确中文。最终同时检查原图与手机缩略图，避免悬念感压过玩法信息。

**Tech Stack:** 内置图像生成工具、项目现有 PNG 素材、本地图片排版工具。

## Global Constraints

- 画幅为 3:4 竖版。
- 不复制宝可梦角色、标志、字体、道具或具体版式。
- 中文文案必须逐字准确，不出现伪文字。
- 六只成年精灵以剪影呈现，五段进化链必须可辨识。
- 最终 PNG 保存到 `assets/promo/`。

---

### Task 1: 生成海报主视觉

**Files:**
- Reference: `assets/sprite/*/5-adult.png`
- Reference: `assets/sprite/00-flower-spirit/*.png`
- Create: `assets/promo/token-sprite-poster-vertical-art.png`

- [x] 生成无文字的 3:4 主视觉：中央发光蛋、外围六只成年精灵剪影、下方五段进化剪影。
- [x] 检查六只轮廓是否彼此可辨，并确认没有现成 IP 元素或乱码。
- [x] 若焦点或轮廓不清，只针对该问题迭代一次。

### Task 2: 排版、验收与交付

**Files:**
- Create: `assets/promo/token-sprite-poster-vertical.png`

- [x] 叠加项目名、主标题、四步玩法链路与隐私卖点。
- [x] 检查全部中文逐字准确。
- [x] 生成手机缩略图并确认主标题、发光蛋、六只剪影和进化方向仍可识别。
- [x] 检查最终 PNG 尺寸与文件完整性，并提交版本存档。
