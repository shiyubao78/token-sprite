# 花费/额度设计：约多少钱 + 每日预算提醒

## 背景 / 目标
用量洞察只有 token 数，用户没有"这值多少钱"的直觉。补上两件事：
1. **约多少钱**：把 token 折成人民币，给"我的 agent 干了多少钱的活"的体感（契合"真实劳动→成长"的立意）。
2. **每日预算提醒**：用户设一个每日预算，快到 / 超了时精灵主动提醒，帮控开销。

## 定稿算法（单一混合价，可调）
- **单价**：`每百万 token ≈ ¥X`，默认 `X=8`（按主流模型 输入/输出/缓存 混合价粗估）。
  - 现有管线把输入/输出/缓存 token 全加成一个总数，不拆类型；因此用一个"混合价"折算，面板标注**「粗略估算·可调」**，用户可自行改单价。
- **花费**：`cost(tokens) = tokens / 1_000_000 * X`（人民币元）。
- 面板展示：**今日花费**、**最近 7 天花费**（对应现有今日/本周 token 两格）。

## 每日预算提醒
- 用户在用量面板填 **每日预算 ¥**（`settings.dailyBudgetYuan`）。为空 = 不提醒。
- 当天估算花费（`cost(todayTokens)`）：
  - 到 **80%**：精灵冒泡「今天快到预算啦～」提醒一次。
  - 超 **100%**：冒泡「今天超预算咯」再提醒一次。
  - **同一天每档只提醒一次**，不重复刷屏（跨天自动重置）。
- 面板显示预算进度条（今日花费 / 预算），near(≥80%)/over(≥100%) 变色。

## 数据（存档新增，向后兼容）
- `state.settings = { yuanPerMillion: 8, dailyBudgetYuan: null }`（`defaultState` 补默认，旧存档合并后自动带上）。
- `state.budgetAlert = { date: 'YYYY-MM-DD', level: 0|80|100 }`：记当天已提醒到哪一档，防重复。

## 纯函数（TDD，`src/domain/cost.js`）
- `DEFAULT_YUAN_PER_MILLION = 8`
- `estimateCost(tokens, rate)` → 元（number）
- `formatYuan(n)` → `¥12`、`¥1,234`、`¥3.4`（<10 保留一位小数）
- `budgetView(todayCost, budget)` → `{ hasBudget, pct, level:'ok'|'near'|'over', budget, cost }`
- `settleBudgetAlert(state, todayCost, budget, today)` → `{ level:'near'|'over' } | null`，并写 `state.budgetAlert`（仿 `petInteract` 就地改 state、返回是否有事）

## 接线
- `src/domain/usageStats.js` 保持不变；花费在 `deriveVm` 里用 `state.settings.yuanPerMillion` 折算，塞进 `vm.usage.cost`。
- `src/ui/views.js` `usageHTML`：token 两格下加"今日/本周花费"，加预算进度条，加两个小输入（每百万单价、每日预算）。窄窗 236px 内不折行。
- `src/main.js`：
  - `openUsage` 用 `openSheet(html, bind)` 绑定两个输入，改动写 `state.settings` + `savePet` + 重渲。
  - `sync()` 里算 `todayCost`，调 `settleBudgetAlert`，命中则 `savePet` + 进冒泡优先级链（放成就之后）。

## 不做 / 以后
- 不拆 token 类型精算（成本大、收益低；"粗略估算"够用）。以后要精算再改管线。
- 不做按模型分别定价、不做月度账单。
