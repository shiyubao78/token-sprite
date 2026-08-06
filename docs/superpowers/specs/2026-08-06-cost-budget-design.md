# 花费估算设计：约多少钱

## 背景 / 目标
用量洞察只有 token 数，用户没有"这值多少钱"的直觉。把 token 折成美元，给"我的 agent 干了多少钱的活"的体感（契合"真实劳动→成长"的立意）。

> **2026-08-06 调整**：原设计还含「每日预算提醒」，但大家都是**订阅制**（花的是固定订阅费，不是按 token 付费），预算/超支提醒没有意义，已整体移除。只保留"约多少钱"作为"你的用量值多少钱"的趣味参考。

## 定稿算法（单一混合价，可调）
- **单价**：`每百万 token ≈ $X`，默认 `X=1.3`（按主流模型 输入/输出/缓存 混合价粗估）。
  - 现有管线把输入/输出/缓存 token 全加成一个总数，不拆类型；因此用一个"混合价"折算，面板标注**「粗略估算·可调」**，用户可自行改单价。
- **花费**：`cost(tokens) = tokens / 1_000_000 * X`（美元）。
- 面板展示：**今日花费**、**最近 7 天花费**（对应现有今日/本周 token 两格）。大额用 K/M 缩写防折行。

## 数据（存档，向后兼容）
- `state.settings = { usdPerMillion: 1.3 }`（`defaultState` 补默认，旧存档合并后自动带上；早期存过的 `dailyBudget`/`budgetAlert` 字段直接忽略）。

## 纯函数（TDD，`src/domain/cost.js`）
- `DEFAULT_USD_PER_MILLION = 1.3`
- `estimateCost(tokens, rate)` → 美元（number）
- `formatMoney(n)` → `$147`、`$1.2K`、`$9.4K`、`$1.2M`、`$3.4`（<10 保留一位小数，大额 K/M 缩写）

## 接线
- `src/domain/usageStats.js` 保持不变；花费在 `deriveVm` 里用 `state.settings.usdPerMillion` 折算，塞进 `vm.usage.cost`。
- `src/ui/views.js` `usageHTML`：token 两格下加"今日/近 7 天花费"，花费设置里一个可调单价输入。窄窗 236px 内不折行。
- `src/main.js`：`openUsage` 用 `openSheet(html, bind)` 绑定单价输入，改动写 `state.settings` + `savePet` + 重渲。

## 不做 / 以后
- 不拆 token 类型精算（成本大、收益低；"粗略估算"够用）。以后要精算再改管线。
- 不做每日预算 / 超支提醒（订阅场景无意义）、不做按模型分别定价、不做月度账单。
