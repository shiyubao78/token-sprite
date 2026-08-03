export const ACTIVE_MS = 12 * 60 * 1000; // 12 分钟内有活动 = 正在敲
export const RETURN_IDLE_MS = 2 * 60 * 60 * 1000; // 久别 = 2 小时
export const BURST_TOKENS = 5_000_000; // 最近 15 分钟超过这个量 = 火力全开
const RATE_MS = 18 * 60 * 1000; // 普通闲聊气泡的最小间隔

// 心情：驱动待机小动作。wilted 由 24h 回落单独给，这里给活着的状态。
export function computeMood({ idleMs, hour, sessionMinutes, recentTokens, decayed }) {
  if (decayed) return 'wilted';
  const active = idleMs < ACTIVE_MS;
  if (active) {
    if (hour >= 0 && hour < 6) return 'sleepy'; // 深夜还在敲
    if (recentTokens > BURST_TOKENS) return 'excited';
    if (sessionMinutes >= 90) return 'caring'; // 连写太久
    return 'focused';
  }
  if (idleMs > RETURN_IDLE_MS) return 'lonely';
  return 'idle';
}

const LINES = {
  morning: ['早，新的一天～ 🌱', '早呀，今天也一起加油！', '醒啦？我等你好久咯'],
  night: ['这么晚了…注意身体呀 🌙', '夜深了，别太拼，我陪着你', '熬夜伤身，早点歇呀'],
  rest: ['敲挺久啦，起来接杯水？', '连轴转好久了，伸个懒腰吧', '歇会儿眼睛，我看着进度～'],
  welcome: ['你回来啦～想你了', '嘿，等你好久！', '回来就好，继续冲～'],
  burst: ['刚刚好猛！🔥', '火力全开，我都跟着长了！', '这波输出可以啊！'],
};
function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// 挑一条情境台词。sig: {active,hour,sessionMinutes,burst,justReturned,today,sessionId}
// mem: {greetDate,restSession,nightSession,lastBubbleAt}。返回 {text,set?} 或 null。
export function pickBubble(sig, mem, now = Date.now()) {
  if (sig.active && sig.hour >= 5 && sig.hour < 12 && mem.greetDate !== sig.today) {
    return { text: pick(LINES.morning), set: { greetDate: sig.today } };
  }
  if (sig.active && sig.hour >= 0 && sig.hour < 6 && mem.nightSession !== sig.sessionId) {
    return { text: pick(LINES.night), set: { nightSession: sig.sessionId } };
  }
  if (sig.active && sig.sessionMinutes >= 90 && mem.restSession !== sig.sessionId) {
    return { text: pick(LINES.rest), set: { restSession: sig.sessionId } };
  }
  if (sig.justReturned) {
    return { text: pick(LINES.welcome) };
  }
  if (now - (mem.lastBubbleAt || 0) < RATE_MS) return null;
  if (sig.active && sig.burst) return { text: pick(LINES.burst) };
  return null;
}
