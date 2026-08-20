# CLAUDE.md

Token 小精灵 —— 桌面桌宠（macOS / Windows / Linux 通用）+ 成就抽卡 × 孵化养成 × 图鉴收集。读本机 AI 编程工具的真实 token 用量，token 用来孵蛋、让精灵进化到化形、集齐图鉴。全本地、不联网。

## 运行

Node.js 20+（三系统均可），仓库根目录：

```bash
npm install
npm start      # 编译 + 启动，桌宠出现在桌面右下角（开发态，关了就没）
```

**如果用户说的是「帮我安装」，别用 `npm start` 交差**——那是开发态，终端一关就没了。
按 [AGENTS.md](AGENTS.md) 开头的「装成常驻 app」那一节做（打包 + 装进 /Applications）。

打包（在对应系统本机跑）：`npm run pack`（mac）/ `pack:win`（Windows）/ `pack:linux`（Linux）；也可用 GitHub Actions 一键三系统出包。测试：`npm test`。

完整说明见 [AGENTS.md](AGENTS.md)。
