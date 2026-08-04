const KEY = 'token-sprite:pet:v1';

export function defaultState() {
  return {
    petName: '小苗',
    createdAt: Date.now(),
    baseline: null, // 首次运行记录安装那刻的历史累计，之后只算新增
    greetDate: null,
    achievements: {}, // { [id]: { at } } 已达成
    tickets: { common: 0, rare: 0, epic: 0, legendary: 0 }, // 抽卡券
    eggs: [], // 孵化器里的蛋 { id, rarity, species, at }
    activeEggId: null, // 在孵的蛋
    incubationStart: 0, // 该蛋开始在孵时的 growthTotal
    collection: {}, // 图鉴 { [species]: { count, firstAt } }
    activePetSpecies: null, // 出战宠物
    activeDates: [], // 活跃日 YYYY-MM-DD
    nightDates: [], // 深夜活跃日
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
