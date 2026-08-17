# Token 小精灵项目进度

更新时间：2026-08-17

## 运营看板（2026-08-17 新增）

- `npm run ops` 抓 GitHub 数据 → 存 `ops-data/history.json` → 生成 `ops-data/dashboard.html`。
- `npm run ops:auto` 开每天 12:00 自动抓（launchd）；`-- off` 关，`-- status` 看状态。
- 为什么要每天抓：GitHub 的浏览/clone 流量只保留 14 天，不抓就永久丢。
- 首次数据（08-17）：15 star、2 fork、14 天 132 人 clone、704 次浏览 / 79 独立访客、**安装包累计只被下载 5 次**。
- 结论：用户走的是「clone 源码跑」，不是「下载安装包」。想要普通用户，得把下载即用这条路做顺。
- 已定：**不加匿名上报**，保持「全本地不联网」的承诺，安装数就只用下载数+clone 数估。

## 已查清：更新提醒是好的（2026-08-17）

- 一度怀疑「v0.4.2 缺 latest-mac.yml 导致老用户收不到更新」，**查证后是虚惊**。
- 本项目故意不用 electron-updater（未签名的 app 用不了），`electron/update-controller.js` 走的是轻量方案：
  读 `github.com/<repo>/releases/latest` 的重定向拿版本号 → 比版本 → 弹窗引导去下载页。**完全不读 latest-mac.yml**。
- 端到端验证（真实 GitHub 请求 + 真实控制器）：装 0.3.0 / 0.4.1 都能正确弹「发现新版本 v0.4.2」并打开正确下载页；装 0.4.2 提示「已经是最新版本」。
- 所以 v0.4.x 下载量为 0 的原因不是更新链路，是**用户基数太小**（历史累计下载才 5 次）。
- 遗留物：`release.yml` 和 `scripts/verify-update-artifacts.mjs` 里那套 latest-mac.yml 校验对当前方案已无用，流水线本身也已改成手动触发。要清理时一起处理。

## 陪伴2.0 进度（v0.3.4 后）

## 陪伴2.0 进度（v0.3.4 后）

- ① 用量洞察 ✅（今日/本周/按工具/活跃时段）
- ② 花费/额度 ✅（2026-08-06）：面板加「约多少钱」（每百万token≈¥8混合价粗估·可调）+ 今日/本周花费；每日预算到80%/超100%各冒泡提醒一次，当天不重复、跨天重置。纯函数 `src/domain/cost.js`+16测试；存档新增 `settings`/`budgetAlert`。设计文档 `docs/superpowers/specs/2026-08-06-cost-budget-design.md`。**未发版**（下次发 v0.3.5 一起）。
- ③ 剩余互动 ⏳（摸头/挠痒手势、记名字、纪念日）

## 已完成

- macOS 菜单栏常驻入口：召回、检查更新、开机启动、当前版本、退出。
- 单实例运行：重复打开只召回已有小精灵。
- 自动防丢：启动、显示器变化、睡眠恢复时检查窗口，完全越界才移回屏幕。
- 用户确认式自动更新：确认下载、确认重启；开发环境不联网。
- macOS universal DMG、ZIP、blockmap、`latest-mac.yml` 构建。
- GitHub `v*` 标签发布流水线：测试、版本校验、签名、公证、Release 资产上传。
- 发布产物完整性校验，避免更新描述引用不存在的文件。

## 当前验证结果

- 自动测试通过。
- Vite 生产构建通过。
- 本地 universal `.app`、DMG、ZIP 和更新元数据可生成。
- 本地没有 Developer ID Application 与 Apple API Key，因此签名、公证和真实 Release 更新链路尚未验证。
- 未执行公开发布。

## 下一步

1. 仓库所有者准备 Apple Developer Program、Developer ID Application 证书和 App Store Connect API Key。
2. 在 GitHub 仓库填入五个 Actions Secrets。
3. 将应用版本提升到首个正式版本，并准备 Release 更新说明。
4. 获得明确发布授权后打同版本 `v*` 标签。
5. 在一台安装旧正式版的 Mac 上验证发现更新、下载、稍后和重启安装全流程。
6. 通知现有未签名版本用户手动安装首个正式版一次。

## 已知卡点

- 没有 Apple 凭证时，macOS 自动更新无法完成端到端验收。
- Windows/Linux 正式签名和自动更新不在本期范围。
- `npm audit` 当前报告的依赖风险需要单独评估，禁止直接使用可能引入破坏性升级的 `npm audit fix --force`。
