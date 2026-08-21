import { describe, it, expect } from 'vitest';
import { summarize, insights, recentDays } from './ops-render.mjs';

const mkDays = (list) => Object.fromEntries(list.map((d, i) => [
  `2026-08-${String(i + 1).padStart(2, '0')}`, d,
]));

const baseRaw = {
  repo: { stargazers_count: 15, forks_count: 2, subscribers_count: 0, open_issues_count: 0 },
  releases: [
    { tag_name: 'v0.4.2', published_at: '2026-08-12T00:00:00Z', assets: [{ name: 'a.dmg', download_count: 0 }] },
    { tag_name: 'v0.3.0', published_at: '2026-08-05T00:00:00Z', assets: [{ name: 'b.zip', download_count: 4 }] },
  ],
  clones: { count: 278, uniques: 132, clones: [] },
  views: { count: 704, uniques: 79, views: [] },
  referrers: [],
};

describe('recentDays', () => {
  it('按日期排序取最近 n 天', () => {
    const days = { '2026-08-03': { views: 3 }, '2026-08-01': { views: 1 }, '2026-08-02': { views: 2 } };
    expect(recentDays(days, 2).map((d) => d.date)).toEqual(['2026-08-02', '2026-08-03']);
  });
});

describe('summarize', () => {
  it('累计下载把所有版本所有文件加起来', () => {
    const s = summarize({ raw: baseRaw, history: { days: {}, snapshots: [] } });
    expect(s.totalDownloads).toBe(4);
    expect(s.latestTag).toBe('v0.4.2');
    expect(s.latestDownloads).toBe(0);
  });

  it('对比最近 7 天和上个 7 天的 clone 人数', () => {
    const days = mkDays([
      ...Array(7).fill({ cloneUniques: 10, viewUniques: 5 }),
      ...Array(7).fill({ cloneUniques: 5, viewUniques: 5 }),
    ]);
    const s = summarize({ raw: baseRaw, history: { days, snapshots: [] } });
    expect(s.clonePrev7).toBe(70);
    expect(s.clone7).toBe(35);
    expect(s.cloneTrend.up).toBe(false);
    expect(s.cloneTrend.pct).toBe(-50);
  });

  it('star 增长按一周前的快照算', () => {
    const snapshots = [
      { date: '2026-08-01', stars: 5, forks: 1, totalDownloads: 0 },
      { date: '2026-08-10', stars: 15, forks: 2, totalDownloads: 4 },
    ];
    const s = summarize({ raw: baseRaw, history: { days: {}, snapshots } });
    expect(s.stars).toBe(15);
    expect(s.starsDelta).toBe(10);
  });

  it('没有历史时也能出数（用当次抓到的值兜底）', () => {
    const s = summarize({ raw: baseRaw, history: { days: {}, snapshots: [] } });
    expect(s.stars).toBe(15);
    expect(s.cloneUniques14).toBe(132);
    expect(s.viewUniques14).toBe(79);
  });
});

describe('insights', () => {
  it('下载远少于 clone 时，说明主路径是 agent 安装（而不是当成问题）', () => {
    const s = summarize({ raw: baseRaw, history: { days: {}, snapshots: [] } });
    const hit = insights(s).find((i) => i.text.includes('主路径'));
    expect(hit).toBeTruthy();
    expect(hit.tone).toBe('good'); // 这是正常现象，不是警告
    expect(hit.text).toContain('别拿下载数判断死活');
  });

  it('最新版 0 下载时给出解释，不渲染成坏消息', () => {
    const s = summarize({ raw: baseRaw, history: { days: {}, snapshots: [] } });
    const hit = insights(s).find((i) => i.text.includes('v0.4.2'));
    expect(hit.text).toContain('不代表没人用');
    expect(hit.tone).toBe('info');
  });

  it('第一次跑时提示要每天抓', () => {
    const s = summarize({ raw: baseRaw, history: { days: {}, snapshots: [{ date: '2026-08-17', stars: 15 }] } });
    expect(insights(s).some((i) => i.tone === 'info')).toBe(true);
  });
});
