// 数据源：读本机 AI 工具用量（Claude Code + Codex 等），返回累计 token 与最近活跃时间。
// 优先级：Electron 桌面壳注入的 window.tokenSprite → 网页开发接口 /api/usage → 静态 /usage.json。
export class LocalUsageSource {
  constructor(fetchFn = (...a) => globalThis.fetch(...a)) {
    this.fetch = fetchFn;
    this.id = 'local';
  }

  async getUsage() {
    if (globalThis.tokenSprite && typeof globalThis.tokenSprite.getUsage === 'function') {
      const data = await globalThis.tokenSprite.getUsage();
      if (data && Number.isFinite(data.total)) return normalize(data);
    }
    for (const url of ['./api/usage', './usage.json']) {
      try {
        const res = await this.fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && Number.isFinite(Number(data.total))) return normalize(data);
      } catch {
        /* 试下一个来源 */
      }
    }
    return { total: 0, lastActivityAt: Date.now(), breakdown: [] };
  }
}

function normalize(data) {
  return {
    total: Number(data.total) || 0,
    recentTokens: Number(data.recentTokens) || 0,
    todayTokens: Number(data.todayTokens) || 0,
    lastActivityAt: Number(data.lastActivityAt) || Date.now(),
    breakdown: Array.isArray(data.breakdown) ? data.breakdown : [],
    daily: (data.daily && typeof data.daily === 'object') ? data.daily : {},
    hourly: (Array.isArray(data.hourly) && data.hourly.length === 24) ? data.hourly : new Array(24).fill(0),
  };
}
