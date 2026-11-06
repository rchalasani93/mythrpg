import type { Stats } from './stats';

export interface ClassDef {
  id: string;
  name: string;
  summary: string;
  baseStats: Stats;
  /** Stats gained automatically per level, on top of free points. */
  growth: Stats;
  startingSkill: string;
  startingGear: readonly string[];
  /** Weapon base ids that get the class bonus. */
  favoredWeapons: readonly string[];
  /** False for classes designed but not yet built in this prototype. */
  playable: boolean;
  starter: boolean;
  /** Visual tint for the body layer (shirt). */
  tunic: number;
}

export const CLASSES: readonly ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    summary: 'Melee and tough. Builds Rage by hitting and being hit.',
    baseStats: { str: 8, dex: 4, vit: 7, mag: 1 },
    growth: { str: 2, dex: 1, vit: 1, mag: 0 },
    startingSkill: 'cleave',
    startingGear: ['bronze_sword', 'linen_chiton', 'sandals'],
    favoredWeapons: ['bronze_sword', 'bronze_axe', 'iron_xiphos', 'labrys'],
    playable: true,
    starter: true,
    tunic: 0x8a3b2a,
  },
  {
    id: 'mage',
    name: 'Mage',
    summary: 'Ranged elemental spells. Lives and dies by Mana.',
    baseStats: { str: 1, dex: 4, vit: 4, mag: 10 },
    growth: { str: 0, dex: 1, vit: 1, mag: 2 },
    startingSkill: '',
    startingGear: [],
    favoredWeapons: [],
    playable: false,
    starter: true,
    tunic: 0x2f4f7a,
  },
  {
    id: 'archer',
    name: 'Archer',
    summary: 'Ranged physical damage, kiting and crits.',
    baseStats: { str: 3, dex: 10, vit: 4, mag: 1 },
    growth: { str: 1, dex: 2, vit: 1, mag: 0 },
    startingSkill: '',
    startingGear: [],
    favoredWeapons: [],
    playable: false,
    starter: true,
    tunic: 0x3f5a2e,
  },
  {
    id: 'support',
    name: 'Support',
    summary: 'Shields, heals and debuffs. Spirit wards fight for you.',
    baseStats: { str: 2, dex: 4, vit: 7, mag: 7 },
    growth: { str: 0, dex: 1, vit: 2, mag: 1 },
    startingSkill: '',
    startingGear: [],
    favoredWeapons: [],
    playable: false,
    starter: true,
    tunic: 0xb59a4a,
  },
];

export function classById(id: string): ClassDef | undefined {
  return CLASSES.find((c) => c.id === id);
}
