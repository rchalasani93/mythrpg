import { classById, type ClassDef } from '../data/classes';
import type { Difficulty } from '../data/difficulty';
import {
  baseById,
  itemPower,
  MATERIALS,
  meetsRequirements,
  SLOTS,
  type Item,
  type Material,
  type Slot,
} from '../data/items';
import { MAX_SKILL_LEVEL, SKILL_SLOTS, skillById } from '../data/skills';
import { addStats, derive, emptyStats, xpForLevel, type Derived, type StatKey, type Stats } from '../data/stats';

export const RUN_VERSION = 1;
export const BAG_LIMIT = 20;

export interface LearnedSkill {
  id: string;
  level: number;
}

export interface RunState {
  version: number;
  seed: number;
  rngState: number;
  classId: string;
  mythId: string;
  difficulty: Difficulty;
  floor: number;
  level: number;
  xp: number;
  freePoints: number;
  allocated: Stats;
  hp: number;
  rage: number;
  gold: number;
  potions: number;
  materials: Record<Material, number>;
  equipped: Partial<Record<Slot, Item>>;
  bag: Item[];
  skills: LearnedSkill[];
  skillSlots: (string | null)[];
  floorsSinceSkill: number;
  uidCounter: number;
  kills: number;
}

export function emptyMaterials(): Record<Material, number> {
  const out = {} as Record<Material, number>;
  for (const m of MATERIALS) out[m] = 0;
  return out;
}

export function newRun(classId: string, mythId: string, difficulty: Difficulty, seed: number): RunState {
  const cls = classById(classId);
  if (!cls || !cls.playable) throw new Error(`Class ${classId} is not playable`);
  const run: RunState = {
    version: RUN_VERSION,
    seed,
    rngState: seed,
    classId,
    mythId,
    difficulty,
    floor: 1,
    level: 1,
    xp: 0,
    freePoints: 0,
    allocated: emptyStats(),
    hp: 0,
    rage: 0,
    gold: 0,
    potions: 2,
    materials: emptyMaterials(),
    equipped: {},
    bag: [],
    skills: [{ id: cls.startingSkill, level: 1 }],
    skillSlots: [cls.startingSkill, null, null, null],
    floorsSinceSkill: 0,
    uidCounter: 0,
    kills: 0,
  };
  for (const baseId of cls.startingGear) {
    const base = baseById(baseId);
    if (!base) continue;
    run.equipped[base.slot] = makeItem(run, baseId, 'common', 1);
  }
  run.hp = derivedOf(run).maxHp;
  return run;
}

export function makeItem(run: RunState, baseId: string, rarity: Item['rarity'], ilvl: number): Item {
  run.uidCounter += 1;
  return { uid: `i${run.uidCounter}`, base: baseId, rarity, ilvl, affixes: {}, element: null, upgrades: 0 };
}

export function classOf(run: RunState): ClassDef {
  const cls = classById(run.classId);
  if (!cls) throw new Error(`Unknown class ${run.classId}`);
  return cls;
}

/** Stats from class, levels and allocated points, before gear. */
export function baseStats(run: RunState): Stats {
  const cls = classOf(run);
  const lv = run.level - 1;
  return addStats(addStats(cls.baseStats, {
    str: cls.growth.str * lv,
    dex: cls.growth.dex * lv,
    vit: cls.growth.vit * lv,
    mag: cls.growth.mag * lv,
  }), run.allocated);
}

export function totalStats(run: RunState): Stats {
  let stats = baseStats(run);
  for (const slot of SLOTS) {
    const item = run.equipped[slot];
    if (item) stats = addStats(stats, item.affixes);
  }
  return stats;
}

export function gearDefense(run: RunState): number {
  let def = 0;
  for (const slot of SLOTS) {
    const item = run.equipped[slot];
    if (item && slot !== 'weapon') def += itemPower(item);
  }
  return def;
}

export function derivedOf(run: RunState): Derived {
  return derive(totalStats(run), gearDefense(run));
}

export interface WeaponInfo {
  damage: number;
  speed: number;
  reach: number;
  element: Item['element'];
  favored: boolean;
}

export function weaponOf(run: RunState): WeaponInfo {
  const item = run.equipped.weapon;
  const base = item ? baseById(item.base) : undefined;
  if (!item || !base) return { damage: 4, speed: 1.5, reach: 44, element: null, favored: false };
  const favored = classOf(run).favoredWeapons.includes(base.id);
  return {
    damage: itemPower(item) * (favored ? 1.1 : 1),
    speed: base.speed ?? 1.5,
    reach: base.reach ?? 50,
    element: item.element,
    favored,
  };
}

/** Returns number of levels gained. */
export function gainXp(run: RunState, amount: number): number {
  run.xp += amount;
  let gained = 0;
  while (run.xp >= xpForLevel(run.level)) {
    run.xp -= xpForLevel(run.level);
    run.level += 1;
    run.freePoints += 2;
    gained += 1;
  }
  if (gained > 0) run.hp = derivedOf(run).maxHp;
  return gained;
}

export function allocatePoint(run: RunState, stat: StatKey): boolean {
  if (run.freePoints <= 0) return false;
  const before = derivedOf(run).maxHp;
  run.freePoints -= 1;
  run.allocated[stat] += 1;
  run.hp += derivedOf(run).maxHp - before;
  return true;
}

export type LearnResult = 'learned' | 'upgraded' | 'maxed';

export function learnSkill(run: RunState, skillId: string): LearnResult {
  const known = run.skills.find((s) => s.id === skillId);
  if (known) {
    if (known.level >= MAX_SKILL_LEVEL) return 'maxed';
    known.level += 1;
    return 'upgraded';
  }
  run.skills.push({ id: skillId, level: 1 });
  const empty = run.skillSlots.indexOf(null);
  if (empty >= 0) run.skillSlots[empty] = skillId;
  return 'learned';
}

export function assignSkill(run: RunState, slotIndex: number, skillId: string | null): void {
  if (slotIndex < 0 || slotIndex >= SKILL_SLOTS) return;
  if (skillId !== null && !run.skills.some((s) => s.id === skillId)) return;
  if (skillId !== null && !skillById(skillId)) return;
  const existing = skillId === null ? -1 : run.skillSlots.indexOf(skillId);
  if (existing >= 0) run.skillSlots[existing] = run.skillSlots[slotIndex] ?? null;
  run.skillSlots[slotIndex] = skillId;
}

export function skillLevel(run: RunState, skillId: string): number {
  return run.skills.find((s) => s.id === skillId)?.level ?? 0;
}

/** Adds to bag. A full bag sells the item for gold instead. Returns gold gained if sold. */
export function addToBag(run: RunState, item: Item): number {
  if (run.bag.length < BAG_LIMIT) {
    run.bag.push(item);
    return 0;
  }
  const value = sellValue(item);
  run.gold += value;
  return value;
}

export function sellValue(item: Item): number {
  const r = { common: 1, rare: 2.5, epic: 5, legendary: 10, mythic: 20 }[item.rarity];
  return Math.round((4 + item.ilvl * 2) * r);
}

export type EquipResult = 'ok' | 'requirements' | 'missing';

export function equipFromBag(run: RunState, uid: string): EquipResult {
  const idx = run.bag.findIndex((i) => i.uid === uid);
  const item = run.bag[idx];
  if (!item) return 'missing';
  const base = baseById(item.base);
  if (!base) return 'missing';
  if (!meetsRequirements(item, totalStats(run))) return 'requirements';
  const before = derivedOf(run).maxHp;
  const previous = run.equipped[base.slot];
  run.bag.splice(idx, 1);
  run.equipped[base.slot] = item;
  if (previous) run.bag.push(previous);
  clampHp(run, before);
  return 'ok';
}

export function unequip(run: RunState, slot: Slot): boolean {
  const item = run.equipped[slot];
  if (!item || run.bag.length >= BAG_LIMIT) return false;
  const before = derivedOf(run).maxHp;
  delete run.equipped[slot];
  run.bag.push(item);
  clampHp(run, before);
  return true;
}

export function sellFromBag(run: RunState, uid: string): number {
  const idx = run.bag.findIndex((i) => i.uid === uid);
  const item = run.bag[idx];
  if (!item) return 0;
  run.bag.splice(idx, 1);
  const value = sellValue(item);
  run.gold += value;
  return value;
}

function clampHp(run: RunState, maxBefore: number): void {
  const maxAfter = derivedOf(run).maxHp;
  if (maxAfter > maxBefore) run.hp += maxAfter - maxBefore;
  run.hp = Math.min(run.hp, maxAfter);
}

/** Forge upgrade: costs materials and gold, raises an item's power. */
export const FORGE_MATERIAL_COST = 4;
export function forgeCost(item: Item): number {
  return 30 + item.upgrades * 25 + item.ilvl * 3;
}

export function totalMaterials(run: RunState): number {
  return MATERIALS.reduce((s, m) => s + run.materials[m], 0);
}

export function forgeUpgrade(run: RunState, slot: Slot): boolean {
  const item = run.equipped[slot];
  if (!item || item.upgrades >= 5) return false;
  const gold = forgeCost(item);
  if (run.gold < gold || totalMaterials(run) < FORGE_MATERIAL_COST) return false;
  run.gold -= gold;
  let left = FORGE_MATERIAL_COST;
  for (const m of MATERIALS) {
    const take = Math.min(left, run.materials[m]);
    run.materials[m] -= take;
    left -= take;
  }
  item.upgrades += 1;
  return true;
}
