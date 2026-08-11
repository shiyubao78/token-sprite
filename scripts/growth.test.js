import { describe, it, expect } from 'vitest';
import { extractUserText, extractCodexUserText, isRealUserPrompt, isToday, condensePrompts, buildPrompt, todayKey, readJournal, saveEntry } from './growth.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

describe('extractUserText', () => {
  it('抽出字符串 content 的用户提问', () => {
    expect(extractUserText({ message: { role: 'user', content: '帮我写个正则' } })).toBe('帮我写个正则');
  });
  it('抽出数组 content 里的 text 块', () => {
    const obj = { message: { role: 'user', content: [{ type: 'text', text: '解释下闭包' }] } };
    expect(extractUserText(obj)).toBe('解释下闭包');
  });
  it('忽略工具结果（非 text 块）', () => {
    const obj = { message: { role: 'user', content: [{ type: 'tool_result', content: 'huge output' }] } };
    expect(extractUserText(obj)).toBeNull();
  });
  it('忽略 assistant 消息', () => {
    expect(extractUserText({ message: { role: 'assistant', content: 'hi' } })).toBeNull();
  });
  it('过滤系统注入内容', () => {
    expect(extractUserText({ message: { role: 'user', content: '<system-reminder>x</system-reminder>' } })).toBeNull();
    expect(extractUserText({ message: { role: 'user', content: 'Caveat: The messages below...' } })).toBeNull();
  });
});

describe('extractCodexUserText', () => {
  it('抽出 Codex payload 里的用户输入（input_text）', () => {
    const obj = { payload: { role: 'user', content: [{ type: 'input_text', text: '重构这个函数' }] } };
    expect(extractCodexUserText(obj)).toBe('重构这个函数');
  });
  it('role 在 payload.message 上也能抽', () => {
    const obj = { payload: { type: 'message', message: { role: 'user', content: '加个测试' } } };
    expect(extractCodexUserText(obj)).toBe('加个测试');
  });
  it('非用户消息返回 null', () => {
    expect(extractCodexUserText({ payload: { type: 'token_count' } })).toBeNull();
  });
});

describe('isRealUserPrompt', () => {
  it('真提问通过', () => { expect(isRealUserPrompt('这个报错怎么修')).toBe(true); });
  it('太短的不算', () => { expect(isRealUserPrompt('1')).toBe(false); });
  it('命令回显不算', () => { expect(isRealUserPrompt('<local-command-stdout>ls</local-command-stdout>')).toBe(false); });
});

describe('isToday', () => {
  it('今天的时间戳算今天', () => {
    const now = Date.parse('2026-08-10T15:00:00');
    expect(isToday(Date.parse('2026-08-10T09:00:00'), now)).toBe(true);
  });
  it('昨天的不算', () => {
    const now = Date.parse('2026-08-10T15:00:00');
    expect(isToday(Date.parse('2026-08-09T23:00:00'), now)).toBe(false);
  });
  it('非法时间戳不算', () => { expect(isToday(NaN)).toBe(false); });
});

describe('condensePrompts', () => {
  it('只留最近 N 条', () => {
    const arr = Array.from({ length: 60 }, (_, i) => ({ source: 'Claude Code', text: `p${i}` }));
    const out = condensePrompts(arr, { maxCount: 10 });
    expect(out.length).toBe(10);
    expect(out[0].text).toBe('p50');
  });
  it('每条超长截断', () => {
    const out = condensePrompts([{ source: 'Codex', text: 'x'.repeat(500) }], { maxChars: 100 });
    expect(out[0].text.length).toBe(101); // 100 + 省略号
    expect(out[0].text.endsWith('…')).toBe(true);
  });
});

describe('buildPrompt', () => {
  it('中文含贴心口吻 + 按工具标注的提问', () => {
    const p = buildPrompt([{ source: 'Claude Code', text: '帮我写正则' }, { source: 'Codex', text: '解释闭包' }], 'zh');
    expect(p).toContain('小精灵');
    expect(p).toContain('1. [Claude Code] 帮我写正则');
    expect(p).toContain('2. [Codex] 解释闭包');
    expect(p).toContain('Claude Code / Codex'); // 汇总了用到的工具
  });
  it('英文走英文模板', () => {
    const p = buildPrompt([{ source: 'Codex', text: 'write a regex' }], 'en');
    expect(p).toContain('coding buddy');
    expect(p).toContain('1. [Codex] write a regex');
  });
  it('要求三块结构（提醒/知识点/小结）', () => {
    const p = buildPrompt([{ source: 'Codex', text: 'x' }], 'zh');
    expect(p).toContain('## 📌');
    expect(p).toContain('## 🧠');
    expect(p).toContain('## 🌱');
  });
});

describe('journal 存留', () => {
  it('todayKey 是 YYYY-MM-DD', () => {
    expect(todayKey(Date.parse('2026-08-11T09:00:00'))).toBe('2026-08-11');
  });
  it('文件不存在时 readJournal 返回 {}', async () => {
    expect(await readJournal(join(tmpdir(), 'nope-ts-journal-xyz.json'))).toEqual({});
  });
  it('saveEntry 写入后能读回，覆盖当天', async () => {
    const fp = join(tmpdir(), `ts-journal-test-${process.pid}.json`);
    await rm(fp, { force: true });
    await saveEntry(fp, '2026-08-11', { text: 'a', count: 3 });
    await saveEntry(fp, '2026-08-10', { text: 'b', count: 1 });
    await saveEntry(fp, '2026-08-11', { text: 'a2', count: 5 }); // 覆盖当天
    const all = await readJournal(fp);
    expect(Object.keys(all).sort()).toEqual(['2026-08-10', '2026-08-11']);
    expect(all['2026-08-11'].text).toBe('a2');
    await rm(fp, { force: true });
  });
});
