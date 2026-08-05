# 每只精灵的「进化详情」 · 设计

## 背景 / 问题
v3 改成「6 只收集图鉴」后，丢失了老版本的**每只分段进化视图**。现在孵化器只显示一个「化形百分比」，用户看不到：这只处在第几段、下一段还差多少、5 段形态分别长什么样。

## 目标
点孵化器里的一颗蛋 → 弹出这只的「进化详情」，等于把老版进化图鉴按「每只一份」复活。

## 分段规则（沿用现有 `incubationStage`，不改数值）
5 段：蛋(1) → 幼体(2) → 成长(3) → 蓄能(4) → 化形(5)。
- 每 25% 一段：到达第 n 段的累计喂养门槛 = `(n-1)/4 × need`，`need` = 该稀有度 `RARITY[rarity].hatch`。
- 当前段 = `incubationStage(fraction)`。化形(第5段)= 养满 100%、破壳进图鉴。

## 详情内容
1. **顶部**：`<species> · 进化`，副标 chip：`<稀有度> · 第 N 段 / 共 5 段`。
2. **5 段阶梯**，每段一行 [缩略图 + 段名 + 状态]：
   - `done`（已过的段）：彩色 + ✅。
   - `current`（当前段）：高亮 + 「当前」标 + **本段进度条**：`距下一段·<名> 还差 <toNext> token（本段已 <within>%）`。
   - `locked`（未到的中间段 3/4）：**灰色剪影**（A 方案，预告不剧透细节）+ 🔒 + `养到 <threshold> 解锁`。
   - `mystery`（第5段化形且未到）：显示 `?` 占位 + `化形 · ???` + `养满 <need> 破壳揭晓`。
3. **底部**：`累计已喂 <fed> · 距化形还差 <need−fed>` + 按钮「设为在养 / 在养中」。

## 交互变化
孵化器行「点击」由"直接设为在养"改为"打开进化详情"；设为在养的动作移到详情里的按钮。理由：能看进度、也防手滑误切。
孵化器行小字：由「已养到 40%」改为「第2段·幼体 · 40%」，一眼看出所在段。

## 结构（遵循现有分层）
- **domain**：`src/domain/incubation.js` 新增纯函数 `evolution(fed, rarity)` → `{ need, fed, fraction, current, toHatch, stages: [{no,name,threshold,state,toNext?,withinPct?,nextName?}] }`。配单测 `incubation.test.js`。
- **view**：`src/ui/views.js` 新增 `evolutionHTML(vm)`；图用 `stageUrl(folder,n)`，mystery 段不给图、显示 `?`。
- **wire**：`src/main.js` `openIncubator` 行点击改为 `openEvolution(egg)`；详情里绑「设为在养」。新增 `evolutionVm(egg)` 组装。
- **style**：`src/style.css` 加 `.evo-*` 类（见已批准的设计图）。

## 不做（YAGNI）
不碰 6 只收集图鉴、不改分段数值/门槛、不加新的存档字段（全部由 `fed` + 稀有度实时算出）。

## 验证
- 单测覆盖 `evolution()`：0%、段边界(25/50/75%)、接近满、满。
- 构建后用 Electron 截图核对详情外观（贝壳精灵第2段样例，对齐已批准设计图）。
