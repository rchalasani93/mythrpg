import type { Element } from './elements';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0xd8cfb8,
  rare: 0x5fa3d6,
  epic: 0xc77ad8,
  legendary: 0xe8a83a,
  mythic: 0xe4553a,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

/** How a skill is shaped in the arena. The game scene turns these into hitboxes. */
export type SkillShape =
  | { kind: 'arc'; radius: number; angle: number }
  | { kind: 'circle'; radius: number }
  | { kind: 'leap'; distance: number; radius: number }
  | { kind: 'line'; length: number; width: number }
  | { kind: 'spin'; radius: number; duration: number; ticks: number }
  | { kind: 'buff'; duration: number; damageBonus?: number; damageTaken?: number };

export interface SkillDef {
  id: string;
  name: string;
  classId: string;
  rarity: Rarity;
  description: string;
  /** Percent of weapon damage, 1.6 = 160%. Ignored for buffs. */
  power: number;
  cooldown: number;
  rageCost: number;
  element: Element | null;
  shape: SkillShape;
  tags: readonly string[];
}

export const SKILLS: readonly SkillDef[] = [
  {
    id: 'cleave',
    name: 'Cleave',
    classId: 'warrior',
    rarity: 'common',
    description: 'A wide swing that hits every enemy in front of you.',
    power: 1.6,
    cooldown: 3,
    rageCost: 0,
    element: null,
    shape: { kind: 'arc', radius: 78, angle: 150 },
    tags: ['melee'],
  },
  {
    id: 'iron_skin',
    name: 'Iron Skin',
    classId: 'warrior',
    rarity: 'common',
    description: 'Take half damage for 4 seconds.',
    power: 0,
    cooldown: 14,
    rageCost: 0,
    element: null,
    shape: { kind: 'buff', duration: 4, damageTaken: 0.5 },
    tags: ['defense'],
  },
  {
    id: 'war_cry',
    name: 'War Cry',
    classId: 'warrior',
    rarity: 'common',
    description: 'Deal 35% more damage for 6 seconds.',
    power: 0,
    cooldown: 12,
    rageCost: 10,
    element: null,
    shape: { kind: 'buff', duration: 6, damageBonus: 0.35 },
    tags: ['buff'],
  },
  {
    id: 'leap_slam',
    name: 'Leap Slam',
    classId: 'warrior',
    rarity: 'rare',
    description: 'Leap forward and crash down, staggering enemies where you land.',
    power: 1.4,
    cooldown: 6,
    rageCost: 15,
    element: 'earth',
    shape: { kind: 'leap', distance: 140, radius: 70 },
    tags: ['melee', 'earth', 'mobility'],
  },
  {
    id: 'flame_cleave',
    name: 'Flame Cleave',
    classId: 'warrior',
    rarity: 'rare',
    description: 'A burning arc that sets enemies alight.',
    power: 1.8,
    cooldown: 4,
    rageCost: 10,
    element: 'fire',
    shape: { kind: 'arc', radius: 86, angle: 140 },
    tags: ['melee', 'fire'],
  },
  {
    id: 'whirlwind',
    name: 'Whirlwind',
    classId: 'warrior',
    rarity: 'epic',
    description: 'Spin for 2 seconds, hitting everything around you.',
    power: 0.7,
    cooldown: 10,
    rageCost: 30,
    element: 'wind',
    shape: { kind: 'spin', radius: 74, duration: 2, ticks: 6 },
    tags: ['melee', 'wind'],
  },
  {
    id: 'earthshatter',
    name: 'Earthshatter',
    classId: 'warrior',
    rarity: 'epic',
    description: 'Split the ground in a long line ahead of you.',
    power: 2.4,
    cooldown: 9,
    rageCost: 40,
    element: 'earth',
    shape: { kind: 'line', length: 260, width: 46 },
    tags: ['earth'],
  },
];

export function skillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

/** Each extra skill level adds 15% power and trims 8% cooldown. */
export function skillPower(def: SkillDef, level: number): number {
  return def.power * (1 + 0.15 * (level - 1));
}

export function skillCooldown(def: SkillDef, level: number): number {
  return def.cooldown * Math.pow(0.92, level - 1);
}

export const MAX_SKILL_LEVEL = 5;
export const SKILL_SLOTS = 4;
