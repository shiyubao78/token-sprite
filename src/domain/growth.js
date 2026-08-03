import { STAGES, DECAY_MS } from '../config/stages.js';

function clamp(tokens) {
  return Number.isFinite(tokens) && tokens > 0 ? tokens : 0;
}

export function stageFor(tokens) {
  const t = clamp(tokens);
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (t >= stage.threshold) current = stage;
    else break;
  }
  return current;
}

export function stageByLevel(level) {
  return STAGES.find((s) => s.level === level) ?? STAGES[0];
}

export function nextStageFor(tokens) {
  const current = stageFor(tokens);
  return STAGES.find((s) => s.level === current.level + 1) ?? null;
}

export function progressFor(tokens) {
  const t = clamp(tokens);
  const stage = stageFor(t);
  const next = nextStageFor(t);
  if (!next) {
    return { stage, next: null, fraction: 1, remaining: 0 };
  }
  const span = next.threshold - stage.threshold;
  const into = t - stage.threshold;
  return { stage, next, fraction: span > 0 ? into / span : 0, remaining: next.threshold - t };
}

// 蔫多少级：每满一个 DECAY_MS 的空窗掉一级
export function decayLevels(idleMs) {
  if (!Number.isFinite(idleMs) || idleMs <= 0) return 0;
  return Math.floor(idleMs / DECAY_MS);
}

// 综合：由「本周已喂」得到基础等级，再按空窗时长回落
export function effectiveStage(fedThisWeek, idleMs) {
  const base = stageFor(fedThisWeek);
  const level = Math.max(1, base.level - decayLevels(idleMs));
  return { base, stage: stageByLevel(level), decayed: level < base.level, dropped: base.level - level };
}
