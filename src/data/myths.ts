export interface ActDef {
  name: string;
  /** Floor colors for the arena. */
  ground: number;
  groundAlt: number;
  wall: number;
  monsters: readonly string[];
}

export interface MythDef {
  id: string;
  name: string;
  finalBoss: string;
  acts: readonly ActDef[];
  /** Floor bosses by floor number. */
  bosses: Record<number, string>;
  playable: boolean;
}

export const MYTHS: readonly MythDef[] = [
  {
    id: 'greek',
    name: 'Greek',
    finalBoss: 'Typhon',
    playable: true,
    acts: [
      {
        name: 'The Labyrinth',
        ground: 0x6b5d4a,
        groundAlt: 0x625544,
        wall: 0x3a3128,
        monsters: ['satyr', 'harpy', 'shade_hoplite'],
      },
    ],
    bosses: { 10: 'minotaur' },
  },
  { id: 'norse', name: 'Norse', finalBoss: 'Jörmungandr', playable: false, acts: [], bosses: {} },
  { id: 'hindu', name: 'Hindu', finalBoss: 'Mahishasura', playable: false, acts: [], bosses: {} },
  { id: 'egyptian', name: 'Egyptian', finalBoss: 'Apep', playable: false, acts: [], bosses: {} },
];

/** The prototype covers Greek Act I, floors 1 to 10. */
export const PROTOTYPE_LAST_FLOOR = 10;

export function mythById(id: string): MythDef | undefined {
  return MYTHS.find((m) => m.id === id);
}

export type FloorKind = 'normal' | 'elite' | 'event' | 'boss';

export function floorKind(floor: number, myth: MythDef): FloorKind {
  if (myth.bosses[floor]) return 'boss';
  if (floor % 10 === 5) return 'event';
  if (floor % 10 === 7) return 'elite';
  return 'normal';
}
