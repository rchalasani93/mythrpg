export type StatKey = 'str' | 'dex' | 'vit' | 'mag';
export type Stats = Record<StatKey, number>;

export const STAT_KEYS: readonly StatKey[] = ['str', 'dex', 'vit', 'mag'];

export const STAT_LABEL: Record<StatKey, string> = {
  str: 'STR',
  dex: 'DEX',
  vit: 'VIT',
  mag: 'MAG',
};

export const STAT_HELP: Record<StatKey, string> = {
  str: 'Melee damage',
  dex: 'Speed, crit, dodge',
  vit: 'HP, defense',
  mag: 'Element power',
};

export function emptyStats(): Stats {
  return { str: 0, dex: 0, vit: 0, mag: 0 };
}

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  return {
    str: a.str + (b.str ?? 0),
    dex: a.dex + (b.dex ?? 0),
    vit: a.vit + (b.vit ?? 0),
    mag: a.mag + (b.mag ?? 0),
  };
}

export interface Derived {
  maxHp: number;
  defense: number;
  /** Multiplier on physical (weapon and STR based) damage. */
  physMult: number;
  /** Multiplier on elemental damage. */
  elemMult: number;
  critChance: number;
  attackSpeed: number;
  dodgeCooldown: number;
  moveSpeed: number;
}

export function derive(stats: Stats, gearDefense: number): Derived {
  return {
    maxHp: Math.round(60 + stats.vit * 10),
    defense: gearDefense + stats.vit * 0.5,
    physMult: 1 + stats.str * 0.05,
    elemMult: 1 + stats.mag * 0.06,
    critChance: Math.min(0.5, 0.05 + stats.dex * 0.006),
    attackSpeed: 1 + stats.dex * 0.012,
    dodgeCooldown: Math.max(0.45, 1.1 - stats.dex * 0.012),
    moveSpeed: 150 + stats.dex * 1.2,
  };
}

/** Fraction of incoming damage that gets through a defense value. */
export function mitigation(defense: number): number {
  return 50 / (50 + Math.max(0, defense));
}

export function xpForLevel(level: number): number {
  return Math.round(18 * Math.pow(level, 1.55));
}
