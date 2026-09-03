import { describe, it, expect } from 'vitest';
import { resolveStage, ownsSpecies } from './stage.js';

const owned = { flower: { count: 1, firstAt: 1 } };

describe('ownsSpecies', () => {
  it('真的孵出来才算拥有', () => {
    expect(ownsSpecies(owned, 'flower')).toBe(true);
    expect(ownsSpecies(owned, 'fire')).toBe(false);
    expect(ownsSpecies({ flower: { count: 0 } }, 'flower')).toBe(false);
    expect(ownsSpecies(null, 'flower')).toBe(false);
    expect(ownsSpecies(owned, null)).toBe(false);
  });
});

describe('resolveStage', () => {
  it('点过「让它陪我」之后，即使还有蛋在孵也显示精灵', () => {
    expect(resolveStage({
      stageMode: 'pet', hasActiveEgg: true, collection: owned, activePetSpecies: 'flower',
    })).toBe('pet'); // 这就是之前坏掉的那条：有蛋在孵就把用户的选择吞了
  });

  it('没点过就保持原样：有蛋看蛋', () => {
    expect(resolveStage({
      stageMode: 'auto', hasActiveEgg: true, collection: owned, activePetSpecies: 'flower',
    })).toBe('incubating');
  });

  it('没有在养的蛋时显示精灵', () => {
    expect(resolveStage({
      stageMode: 'auto', hasActiveEgg: false, collection: owned, activePetSpecies: 'flower',
    })).toBe('pet');
  });

  it('还没孵出过任何精灵，就不能强行显示精灵（否则会剧透没获得的品种）', () => {
    expect(resolveStage({
      stageMode: 'pet', hasActiveEgg: true, collection: {}, activePetSpecies: 'flower',
    })).toBe('incubating');
  });

  it('选的那只自己没有，也退回蛋', () => {
    expect(resolveStage({
      stageMode: 'pet', hasActiveEgg: true, collection: owned, activePetSpecies: 'fire',
    })).toBe('incubating');
  });

  it('老存档没有 stageMode 字段时行为不变', () => {
    expect(resolveStage({
      stageMode: undefined, hasActiveEgg: true, collection: owned, activePetSpecies: 'flower',
    })).toBe('incubating');
  });
});
