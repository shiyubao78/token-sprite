// ⚠️ 跨版本更新的存档全靠这个 key 定位——绝不要随意改，改了旧存档会读不到、用户成长进度会"丢失"。
export const KEY = 'token-sprite:pet:v1';

export function defaultState() {
  return {
    petName: '小苗',
    createdAt: Date.now(),
    baseline: null, // 首次运行记录安装那刻的历史累计，之后只算新增
    greetDate: null,
    achievements: {}, // { [id]: { at } } 已达成
    tickets: { common: 0, rare: 0, epic: 0, legendary: 0 }, // 抽卡券
    eggs: [], // 孵化器里的蛋 { id, rarity, species, at, fed }。fed=这只自己的累积喂养量，切换也不清零
    activeEggId: null, // 放在桌面上（在养）的那颗蛋，只有它吸收新增 token
    lastGrowth: null, // 上次记账时的 growthTotal，用来算「这次新增多少」喂给在养的那只（null=未初始化/待迁移）
    collection: {}, // 图鉴 { [species]: { count, firstAt } }
    activePetSpecies: null, // 出战宠物
    activeDates: [], // 活跃日 YYYY-MM-DD
    nightDates: [], // 深夜活跃日
    settings: { usdPerMillion: 1.3, dailyBudget: null }, // 花费估算单价（每百万token≈$）+ 每日预算美元（null=不提醒）
    budgetAlert: null, // { date, level:80|100 } 当天预算提醒已到哪档，防重复
  };
}

export function loadPet(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultState();
    return { ...defaultState(), ...parsed, createdAt: parsed.createdAt || Date.now() };
  } catch {
    return defaultState();
  }
}

export function savePet(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 存储不可用时静默降级，不阻塞游玩 */
  }
}
