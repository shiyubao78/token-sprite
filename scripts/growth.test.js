import { describe, it, expect } from 'vitest';
import { extractUserText, extractCodexUserText, isRealUserPrompt, isToday, condensePrompts, buildPrompt, todayKey, parseGeneration, normalizeStore, mergeGeneration } from './growth.mjs';

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
  it('带上已知记忆当背景', () => {
    const p = buildPrompt([{ source: 'Codex', text: 'x' }], 'zh', ['偏好简洁', '项目全本地']);
    expect(p).toContain('长期背景');
    expect(p).toContain('- 偏好简洁');
    expect(p).toContain('- 项目全本地');
  });
  it('没有记忆时不加背景块', () => {
    expect(buildPrompt([{ source: 'Codex', text: 'x' }], 'zh', [])).not.toContain('长期背景');
  });
  it('要求四类 JSON 键', () => {
    const p = buildPrompt([{ source: 'Codex', text: 'x' }], 'zh');
    expect(p).toContain('"summary"');
    expect(p).toContain('"knowledge"');
    expect(p).toContain('"todos"');
    expect(p).toContain('"memory"');
  });
});

describe('parseGeneration', () => {
  it('解析干净 JSON 四类', () => {
    const r = parseGeneration('{"summary":"今天写了日记","knowledge":[{"term":"IPC","explain":"进程间通信"}],"todos":["订机票"],"memory":["喜欢简洁"]}');
    expect(r.summary).toBe('今天写了日记');
    expect(r.knowledge[0]).toEqual({ term: 'IPC', explain: '进程间通信' });
    expect(r.todos).toEqual(['订机票']);
    expect(r.memory).toEqual(['喜欢简洁']);
  });
  it('剥掉 ```json 围栏和前后废话', () => {
    const r = parseGeneration('好的：\n```json\n{"summary":"s","knowledge":[],"todos":[],"memory":[]}\n```');
    expect(r.summary).toBe('s');
  });
  it('解析失败退化为 summary', () => {
    const r = parseGeneration('这不是 JSON');
    expect(r.summary).toBe('这不是 JSON');
    expect(r.todos).toEqual([]);
  });
});

describe('normalizeStore', () => {
  it('新结构原样', () => {
    expect(normalizeStore({ days: { a: {} }, todos: [1], memory: [] })).toEqual({ days: { a: {} }, todos: [1], memory: [] });
  });
  it('旧扁平 {date:{text}} 迁进 days', () => {
    const s = normalizeStore({ '2026-08-10': { text: 'x' } });
    expect(s.days['2026-08-10'].text).toBe('x');
    expect(s.todos).toEqual([]);
  });
});

describe('mergeGeneration', () => {
  const base = { days: {}, todos: [{ id: 'a', text: '订机票', done: false }], memory: [] };
  const parsed = { summary: 's', knowledge: [{ term: 'k', explain: 'e' }], todos: ['订机票', '加测试'], memory: ['偏好简洁'] };
  it('当天 summary/knowledge 写进 days', () => {
    const s = mergeGeneration(base, '2026-08-11', parsed, { tools: ['Codex'], count: 5 });
    expect(s.days['2026-08-11'].summary).toBe('s');
    expect(s.days['2026-08-11'].knowledge[0].term).toBe('k');
  });
  it('todos 只追加新的（去重已存在的“订机票”）', () => {
    const s = mergeGeneration(base, '2026-08-11', parsed, {});
    expect(s.todos.map((t) => t.text)).toEqual(['订机票', '加测试']);
  });
  it('memory 追加并带 id', () => {
    const s = mergeGeneration(base, '2026-08-11', parsed, {});
    expect(s.memory[0].text).toBe('偏好简洁');
    expect(typeof s.memory[0].id).toBe('string');
  });
  it('todayKey 是 YYYY-MM-DD', () => {
    expect(todayKey(Date.parse('2026-08-11T09:00:00'))).toBe('2026-08-11');
  });
});
