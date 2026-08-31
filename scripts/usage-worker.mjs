#!/usr/bin/env node
// 在独立子进程里算用量，算完把结果发回主进程。
//
// 为什么必须分出去：日志是逐行 JSON.parse 解析的，这是同步操作。
// 重度用户的 ~/.codex 能到几个 GB，一次扫描要十几秒——放在主进程里就是
// 十几秒动不了的桌宠（用得越多越卡，正好把最活跃的用户挡在门外）。
import { computeLocalUsage } from './usage.mjs';

const send = (msg) => { try { process.send?.(msg); } catch { /* 父进程已退出 */ } };

computeLocalUsage()
  .then((data) => { send({ ok: true, data }); process.exit(0); })
  .catch((err) => { send({ ok: false, error: String(err && err.message || err) }); process.exit(1); });
