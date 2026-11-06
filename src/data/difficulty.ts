export type Difficulty = 'easy' | 'medium' | 'hard' | 'hell';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'hell'];

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  enemyMult: number;
  rewardMult: number;
  /** Multiplier on healing drop chance. */
  healDrops: number;
  /** Chance a floor rolls elite (on top of fixed elite floors). */
  eliteChance: number;
  healOnBossFloor: boolean;
  midRunSave: boolean;
  /** Bosses gain an extra phase. */
  extraBossPhase: boolean;
  summary: string;
}

export const DIFFICULTY_DEFS: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    enemyMult: 0.75,
    rewardMult: 0.75,
    healDrops: 1.3,
    eliteChance: 0,
    healOnBossFloor: true,
    midRunSave: true,
    extraBossPhase: false,
    summary: 'Enemies at 75%. Full heal before every boss.',
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    enemyMult: 1,
    rewardMult: 1,
    healDrops: 1,
    eliteChance: 0.05,
    healOnBossFloor: false,
    midRunSave: true,
    extraBossPhase: false,
    summary: 'The standard climb.',
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    enemyMult: 1.4,
    rewardMult: 1.5,
    healDrops: 0.7,
    eliteChance: 0.15,
    healOnBossFloor: false,
    midRunSave: true,
    extraBossPhase: false,
    summary: 'Enemies at 140%, more elites, fewer potions. Better loot.',
  },
  hell: {
    id: 'hell',
    name: 'Hell',
    enemyMult: 2,
    rewardMult: 2,
    healDrops: 0.6,
    eliteChance: 0.2,
    healOnBossFloor: false,
    midRunSave: false,
    extraBossPhase: true,
    summary: 'Enemies at 200%. Bosses gain a phase. No mid-run save.',
  },
};

/** The level below each difficulty, which must be cleared to unlock it. */
export const UNLOCKED_BY: Record<Difficulty, Difficulty | null> = {
  easy: null,
  medium: null,
  hard: 'medium',
  hell: 'hard',
};
