const KEY = 'token-sprite:pet:v1';

export function defaultState() {
  return {
    petName: '小苗',
    createdAt: Date.now(),
    lastSeenLevel: 1,
    bestLevel: 1,
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
