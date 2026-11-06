export type Element =
  | 'fire'
  | 'water'
  | 'wind'
  | 'earth'
  | 'lightning'
  | 'ice'
  | 'poison'
  | 'light'
  | 'dark';

export const ELEMENTS: readonly Element[] = [
  'fire',
  'water',
  'wind',
  'earth',
  'lightning',
  'ice',
  'poison',
  'light',
  'dark',
];

export const STRONG = 1.5;
export const WEAK = 0.75;

/**
 * attacker -> defenders it beats.
 * Cycle: water > fire > wind > earth > lightning > water.
 * Light and dark beat each other. Ice beats water, poison beats earth.
 */
const BEATS: Record<Element, readonly Element[]> = {
  water: ['fire'],
  fire: ['wind', 'ice'],
  wind: ['earth'],
  earth: ['lightning'],
  lightning: ['water'],
  ice: ['water'],
  poison: ['earth'],
  light: ['dark', 'poison'],
  dark: ['light'],
};

/** Multiplier for an attack element against a defender's elements (0 to 2 of them). */
export function elementMultiplier(
  attack: Element | null | undefined,
  defender: readonly Element[],
): number {
  if (!attack || defender.length === 0) return 1;
  let mult = 1;
  for (const d of defender) {
    if (BEATS[attack].includes(d)) mult *= STRONG;
    else if (BEATS[d].includes(attack) && !(attack === 'light' || attack === 'dark')) mult *= WEAK;
  }
  return mult;
}

export const ELEMENT_COLOR: Record<Element, number> = {
  fire: 0xe2582c,
  water: 0x3f8fd2,
  wind: 0x9fd0a8,
  earth: 0xa9773f,
  lightning: 0xf2d23c,
  ice: 0xa8e0f0,
  poison: 0x7fb03a,
  light: 0xf5ecc8,
  dark: 0x7a4f8f,
};

export const ELEMENT_LABEL: Record<Element, string> = {
  fire: 'Fire',
  water: 'Water',
  wind: 'Wind',
  earth: 'Earth',
  lightning: 'Lightning',
  ice: 'Ice',
  poison: 'Poison',
  light: 'Light',
  dark: 'Dark',
};

/** The status effect each element applies on hit. */
export type StatusKind = 'burn' | 'soak' | 'knockback' | 'stagger' | 'shock' | 'chill' | 'poison' | 'blind' | 'drain';

export const ELEMENT_STATUS: Record<Element, StatusKind> = {
  fire: 'burn',
  water: 'soak',
  wind: 'knockback',
  earth: 'stagger',
  lightning: 'shock',
  ice: 'chill',
  poison: 'poison',
  light: 'blind',
  dark: 'drain',
};
