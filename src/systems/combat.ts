import { elementMultiplier, type Element } from '../data/elements';
import { mitigation } from '../data/stats';

export interface HitInput {
  raw: number;
  element: Element | null;
  defenderElements: readonly Element[];
  defense: number;
  critChance: number;
  /** 0..1 roll for crit, passed in so the caller controls randomness. */
  roll: number;
  /** Multiplier from buffs (War Cry etc). */
  bonus?: number;
}

export interface HitResult {
  damage: number;
  crit: boolean;
  effectiveness: 'strong' | 'weak' | 'normal';
}

export const CRIT_MULT = 1.75;

export function computeHit(h: HitInput): HitResult {
  const elem = elementMultiplier(h.element, h.defenderElements);
  const crit = h.roll < h.critChance;
  const dmg = h.raw * elem * (crit ? CRIT_MULT : 1) * (h.bonus ?? 1) * mitigation(h.defense);
  return {
    damage: Math.max(1, Math.round(dmg)),
    crit,
    effectiveness: elem > 1 ? 'strong' : elem < 1 ? 'weak' : 'normal',
  };
}

/** Enemy stats grow 9% per floor, then the difficulty multiplier applies. */
export function floorScale(floor: number): number {
  return 1 + (floor - 1) * 0.09;
}
