// 6 个品种，每个一条 5 段进化线（1-seed 蛋 → 2-sprout → 3-growth → 4-bud → 5-adult 化形）。
// 图在 assets/sprite/<folder>/<n>-*.png。稀有度决定孵化门槛与抽中概率。
// name/nick/note 双语：调用点仍用 sp.name / sp.nick，getter 按当前语言解析。
import { L } from './i18n.js';

const T = (zh, en) => ({ zh, en });
function mk(o) {
  return {
    ...o,
    get name() { return L(o._name); },
    get nick() { return L(o._nick); },
    get note() { return L(o._note); },
  };
}

export const SPECIES = [
  mk({ key: 'flower', rarity: 'common', folder: '00-flower-spirit',
    _name: T('萌芽精灵', 'Sproutling'), _nick: T('小苗', 'Sprout'),
    _note: T('草木之灵，化形为花仙子', 'A woodland spirit that awakens into a flower fairy') }),
  mk({ key: 'shell', rarity: 'common', folder: '01-water-shell',
    _name: T('贝壳精灵', 'Shellkin'), _nick: T('小贝', 'Shelly'),
    _note: T('海洋之灵，背着海螺壳', 'An ocean spirit that carries a conch shell') }),
  mk({ key: 'fire', rarity: 'rare', folder: '02-fire-lava',
    _name: T('火苗精灵', 'Emberling'), _nick: T('小火', 'Ember'),
    _note: T('岩浆之灵，化形为熔岩兽', 'A magma spirit that awakens into a lava beast') }),
  mk({ key: 'thunder', rarity: 'rare', folder: '03-thunder-spirit',
    _name: T('雷精灵', 'Boltling'), _nick: T('小雷', 'Bolt'),
    _note: T('雷电之灵，化形为雷电团子', 'A lightning spirit that awakens into a thunder puff') }),
  mk({ key: 'ice', rarity: 'epic', folder: '05-ice-phoenix',
    _name: T('冰凤凰', 'Frostwing'), _nick: T('小凰', 'Frosty'),
    _note: T('冰晶之灵，化形为冰晶战鸟', 'An ice spirit that awakens into a crystal phoenix') }),
  mk({ key: 'mech', rarity: 'legendary', folder: '04-mech-spirit',
    _name: T('机械兽', 'Cogbeast'), _nick: T('小铁', 'Cog'),
    _note: T('科技之灵，化形为金色机械兽', 'A tech spirit that awakens into a golden mecha beast') }),
];

// 所有品种在两种语言下的默认昵称集合。用于判断 petName 是否只是「跟随当前这只」的默认昵称
// （而非用户自定义名）——跨语言都能认出来，切语言后名字不会被误当成自定义名卡住。
export const DEFAULT_NICKS = SPECIES.flatMap((s) => [s._nick.zh, s._nick.en]);

export function speciesByKey(key) {
  return SPECIES.find((s) => s.key === key) || null;
}
export function speciesOfRarity(rarity) {
  return SPECIES.filter((s) => s.rarity === rarity);
}
