import { DIFFICULTY_DEFS } from '../data/difficulty';
import { BASE_ITEMS, type Item, type Material } from '../data/items';
import type { MonsterDef } from '../data/monsters';
import { MAX_SKILL_LEVEL, SKILLS, type Rarity, type SkillDef } from '../data/skills';
import { STAT_KEYS } from '../data/stats';
import { ELEMENTS } from '../data/elements';
import type { Rng } from './rng';
import { makeItem, type RunState } from './run';

export type Drop =
  | { kind: 'gold'; amount: number }
  | { kind: 'potion' }
  | { kind: 'material'; material: Material }
  | { kind: 'item'; item: Item }
  | { kind: 'scroll'; skillId: string };

/** Floors without a skill scroll before one is guaranteed in the floor chest. */
export const SKILL_PITY_FLOORS = 5;

export function rollRarity(rng: Rng, floor: number, bonus: number): Rarity {
  const f = floor + bonus * 6;
  return rng.weighted<Rarity>([
    ['common', 70],
    ['rare', 24 + f * 0.6],
    ['epic', 5 + f * 0.35],
    ['legendary', Math.max(0, f - 6) * 0.2],
  ]);
}

const AFFIX_COUNT: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };

export function rollItem(run: RunState, rng: Rng, floor: number, rarityBonus = 0): Item {
  const pool = BASE_ITEMS.filter((b) => b.minFloor <= floor);
  const base = rng.pick(pool);
  const rarity = rollRarity(rng, floor, rarityBonus);
  const ilvl = Math.max(1, floor + rng.int(-1, 1));
  const item = makeItem(run, base.id, rarity, ilvl);
  for (let i = 0; i < AFFIX_COUNT[rarity]; i++) {
    const stat = rng.pick(STAT_KEYS);
    item.affixes[stat] = (item.affixes[stat] ?? 0) + rng.int(1, 2 + Math.floor(floor / 4));
  }
  if (base.slot === 'weapon' && rarity !== 'common' && rng.chance(0.4)) {
    item.element = rng.pick(ELEMENTS);
  }
  return item;
}

const SKILL_WEIGHT: Record<Rarity, number> = { common: 10, rare: 6, epic: 3, legendary: 1, mythic: 0 };

/** Picks a skill for the run's class that can still be learned or upgraded. */
export function rollSkill(run: RunState, rng: Rng, floor: number): SkillDef | null {
  const options = SKILLS.filter((s) => {
    if (s.classId !== run.classId) return false;
    if (s.rarity === 'epic' && floor < 3) return false;
    const known = run.skills.find((k) => k.id === s.id);
    return !known || known.level < MAX_SKILL_LEVEL;
  });
  if (options.length === 0) return null;
  return rng.weighted(options.map((s) => {
    const known = run.skills.some((k) => k.id === s.id);
    // New skills are preferred so builds grow wider early.
    return [s, SKILL_WEIGHT[s.rarity] * (known ? 0.6 : 1.4)] as const;
  }));
}

export function rollKillDrops(run: RunState, rng: Rng, monster: MonsterDef, elite: boolean): Drop[] {
  const diff = DIFFICULTY_DEFS[run.difficulty];
  const drops: Drop[] = [];
  const eliteBoost = elite ? 2.5 : 1;
  if (rng.chance(0.7)) {
    const amount = Math.max(1, Math.round((2 + run.floor * 1.2) * rng.range(0.6, 1.4) * diff.rewardMult * eliteBoost));
    drops.push({ kind: 'gold', amount });
  }
  if (rng.chance(0.07 * diff.healDrops * eliteBoost)) drops.push({ kind: 'potion' });
  if (rng.chance(0.22 * eliteBoost)) drops.push({ kind: 'material', material: monster.material });
  if (rng.chance(0.05 * eliteBoost)) drops.push({ kind: 'item', item: rollItem(run, rng, run.floor, elite ? 1 : 0) });
  if (rng.chance(0.025 * eliteBoost)) {
    const skill = rollSkill(run, rng, run.floor);
    if (skill) drops.push({ kind: 'scroll', skillId: skill.id });
  }
  return drops;
}

export function rollBossDrops(run: RunState, rng: Rng, monster: MonsterDef): Drop[] {
  const diff = DIFFICULTY_DEFS[run.difficulty];
  const drops: Drop[] = [
    { kind: 'gold', amount: Math.round(60 * diff.rewardMult) },
    { kind: 'potion' },
    { kind: 'material', material: monster.material },
    { kind: 'material', material: monster.material },
    { kind: 'item', item: rollItem(run, rng, run.floor + 2, 2) },
  ];
  const skill = rollSkill(run, rng, run.floor + 3);
  if (skill) drops.push({ kind: 'scroll', skillId: skill.id });
  return drops;
}

/** The chest that appears when a floor is cleared. Always holds gear or a scroll. */
export function rollFloorChest(run: RunState, rng: Rng): Drop[] {
  const diff = DIFFICULTY_DEFS[run.difficulty];
  const drops: Drop[] = [{ kind: 'gold', amount: Math.round((8 + run.floor * 3) * diff.rewardMult) }];
  const pity = run.floorsSinceSkill >= SKILL_PITY_FLOORS - 1;
  const skill = pity || rng.chance(0.35) ? rollSkill(run, rng, run.floor) : null;
  if (skill) drops.push({ kind: 'scroll', skillId: skill.id });
  else drops.push({ kind: 'item', item: rollItem(run, rng, run.floor) });
  return drops;
}
