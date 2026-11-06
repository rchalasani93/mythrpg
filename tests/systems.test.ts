import { describe, expect, it } from 'vitest';
import { elementMultiplier, STRONG, WEAK } from '../src/data/elements';
import { computeHit } from '../src/systems/combat';
import { rollFloorChest, rollItem, SKILL_PITY_FLOORS } from '../src/systems/loot';
import { Rng } from '../src/systems/rng';
import { assignSkill, derivedOf, equipFromBag, gainXp, learnSkill, newRun, unequip } from '../src/systems/run';
import { emptyMeta, isDifficultyUnlocked, parseSave, validRun } from '../src/systems/save';

describe('elements', () => {
  it('follows the cycle water > fire > wind > earth > lightning > water', () => {
    expect(elementMultiplier('water', ['fire'])).toBe(STRONG);
    expect(elementMultiplier('fire', ['wind'])).toBe(STRONG);
    expect(elementMultiplier('wind', ['earth'])).toBe(STRONG);
    expect(elementMultiplier('earth', ['lightning'])).toBe(STRONG);
    expect(elementMultiplier('lightning', ['water'])).toBe(STRONG);
    expect(elementMultiplier('fire', ['water'])).toBe(WEAK);
  });

  it('light and dark beat each other', () => {
    expect(elementMultiplier('light', ['dark'])).toBe(STRONG);
    expect(elementMultiplier('dark', ['light'])).toBe(STRONG);
  });

  it('places ice and poison outside the cycle', () => {
    expect(elementMultiplier('ice', ['water'])).toBe(STRONG);
    expect(elementMultiplier('ice', ['fire'])).toBe(WEAK);
    expect(elementMultiplier('poison', ['earth'])).toBe(STRONG);
    expect(elementMultiplier('poison', ['light'])).toBe(WEAK);
  });

  it('is neutral without an element', () => {
    expect(elementMultiplier(null, ['fire'])).toBe(1);
    expect(elementMultiplier('fire', [])).toBe(1);
  });
});

describe('combat', () => {
  it('applies crit, element and defense', () => {
    const base = computeHit({ raw: 100, element: null, defenderElements: [], defense: 0, critChance: 0, roll: 0.5 });
    expect(base.damage).toBe(100);
    const crit = computeHit({ raw: 100, element: null, defenderElements: [], defense: 0, critChance: 1, roll: 0.5 });
    expect(crit.crit).toBe(true);
    expect(crit.damage).toBe(175);
    const strong = computeHit({ raw: 100, element: 'water', defenderElements: ['fire'], defense: 50, critChance: 0, roll: 1 });
    expect(strong.effectiveness).toBe('strong');
    expect(strong.damage).toBe(75);
  });
});

describe('run state', () => {
  it('starts a warrior with gear, Cleave and full HP', () => {
    const run = newRun('warrior', 'greek', 'medium', 42);
    expect(run.equipped.weapon?.base).toBe('bronze_sword');
    expect(run.skillSlots[0]).toBe('cleave');
    expect(run.hp).toBe(derivedOf(run).maxHp);
  });

  it('refuses classes not in the prototype', () => {
    expect(() => newRun('mage', 'greek', 'medium', 1)).toThrow();
  });

  it('levels up and grants 2 free points per level', () => {
    const run = newRun('warrior', 'greek', 'medium', 1);
    const gained = gainXp(run, 500);
    expect(gained).toBeGreaterThan(0);
    expect(run.freePoints).toBe(gained * 2);
  });

  it('learns, upgrades and slots skills', () => {
    const run = newRun('warrior', 'greek', 'medium', 1);
    expect(learnSkill(run, 'war_cry')).toBe('learned');
    expect(run.skillSlots[1]).toBe('war_cry');
    expect(learnSkill(run, 'war_cry')).toBe('upgraded');
    assignSkill(run, 3, 'war_cry');
    expect(run.skillSlots[3]).toBe('war_cry');
    expect(run.skillSlots[1]).toBeNull();
  });

  it('swaps gear between bag and slot, and blocks gear the stats cannot carry', () => {
    const run = newRun('warrior', 'greek', 'medium', 1);
    const rng = new Rng(7);
    const item = rollItem(run, rng, 10);
    run.bag.push(item);
    equipFromBag(run, item.uid);
    expect(unequip(run, 'boots')).toBe(true);
    const labrys = { uid: 'x1', base: 'labrys', rarity: 'common' as const, ilvl: 1, affixes: {}, element: null, upgrades: 0 };
    run.bag.push(labrys);
    expect(equipFromBag(run, 'x1')).toBe('requirements');
  });
});

describe('loot', () => {
  it('guarantees a skill scroll in the chest after the pity window', () => {
    const run = newRun('warrior', 'greek', 'medium', 3);
    run.floorsSinceSkill = SKILL_PITY_FLOORS - 1;
    for (let seed = 0; seed < 20; seed++) {
      const drops = rollFloorChest(run, new Rng(seed));
      expect(drops.some((d) => d.kind === 'scroll')).toBe(true);
    }
  });

  it('only rolls items that exist by that floor', () => {
    const run = newRun('warrior', 'greek', 'medium', 3);
    const rng = new Rng(11);
    for (let i = 0; i < 200; i++) {
      const item = rollItem(run, rng, 1);
      expect(['labrys', 'bronze_cuirass']).not.toContain(item.base);
    }
  });
});

describe('save validation', () => {
  it('round-trips a valid run', () => {
    const run = newRun('warrior', 'greek', 'hard', 99);
    const parsed = parseSave(JSON.stringify({ meta: emptyMeta(), run }));
    expect(parsed.run?.seed).toBe(99);
  });

  it('drops tampered or broken saves instead of crashing', () => {
    expect(parseSave('not json').run).toBeNull();
    expect(parseSave(null).run).toBeNull();
    const run = newRun('warrior', 'greek', 'medium', 1) as unknown as Record<string, unknown>;
    expect(validRun({ ...run, gold: -5 })).toBe(false);
    expect(validRun({ ...run, classId: '<script>' })).toBe(false);
    expect(validRun({ ...run, bag: new Array(500).fill(null) })).toBe(false);
    expect(parseSave('x'.repeat(300_000)).run).toBeNull();
  });

  it('unlocks Hard only after a Medium clear', () => {
    const meta = emptyMeta();
    expect(isDifficultyUnlocked(meta, 'medium')).toBe(true);
    expect(isDifficultyUnlocked(meta, 'hard')).toBe(false);
    meta.actClears.medium = 1;
    expect(isDifficultyUnlocked(meta, 'hard')).toBe(true);
    expect(isDifficultyUnlocked(meta, 'hell')).toBe(false);
  });
});
