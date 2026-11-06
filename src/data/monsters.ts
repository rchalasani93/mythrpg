import type { Element } from './elements';
import type { Material } from './items';

export type MonsterAI = 'chaser' | 'swooper' | 'brute' | 'minotaur';

export interface MonsterDef {
  id: string;
  name: string;
  myth: string;
  elements: readonly Element[];
  hp: number;
  damage: number;
  speed: number;
  /** Radius of the body for collisions, in px (before scale). */
  radius: number;
  xp: number;
  ai: MonsterAI;
  texture: string;
  scale: number;
  material: Material;
  boss?: boolean;
  /** One line for the codex. */
  lore: string;
}

export const MONSTERS: readonly MonsterDef[] = [
  {
    id: 'satyr',
    name: 'Satyr',
    myth: 'greek',
    elements: ['earth'],
    hp: 30,
    damage: 6,
    speed: 82,
    radius: 9,
    xp: 6,
    ai: 'chaser',
    texture: 'mon_satyr',
    scale: 3,
    material: 'satyr_horn',
    lore: 'Goat-legged followers of Dionysus. In the Tower they have forgotten the music and kept the horns.',
  },
  {
    id: 'harpy',
    name: 'Harpy',
    myth: 'greek',
    elements: ['wind'],
    hp: 22,
    damage: 7,
    speed: 120,
    radius: 9,
    xp: 7,
    ai: 'swooper',
    texture: 'mon_harpy',
    scale: 3,
    material: 'harpy_feather',
    lore: 'The snatchers. They circle out of reach, then dive.',
  },
  {
    id: 'shade_hoplite',
    name: 'Shade Hoplite',
    myth: 'greek',
    elements: ['dark'],
    hp: 55,
    damage: 10,
    speed: 55,
    radius: 10,
    xp: 10,
    ai: 'brute',
    texture: 'mon_hoplite',
    scale: 3,
    material: 'shade_dust',
    lore: 'Soldiers who never crossed the Styx. They still hold formation.',
  },
  {
    id: 'minotaur',
    name: 'Asterion, the Minotaur',
    myth: 'greek',
    elements: ['earth'],
    hp: 950,
    damage: 18,
    speed: 70,
    radius: 22,
    xp: 120,
    ai: 'minotaur',
    texture: 'mon_minotaur',
    scale: 3,
    material: 'minotaur_horn',
    boss: true,
    lore: 'Guardian of the first labyrinth floors. He charges in straight lines and cannot turn mid-charge.',
  },
];

export function monsterById(id: string): MonsterDef | undefined {
  return MONSTERS.find((m) => m.id === id);
}
