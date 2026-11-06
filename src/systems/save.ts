import { DIFFICULTIES, UNLOCKED_BY, type Difficulty } from '../data/difficulty';
import { baseById, MATERIALS, SLOTS, type Item, type Slot } from '../data/items';
import { classById } from '../data/classes';
import { mythById } from '../data/myths';
import { RARITY_ORDER, SKILL_SLOTS, MAX_SKILL_LEVEL, skillById } from '../data/skills';
import { ELEMENTS } from '../data/elements';
import { STAT_KEYS } from '../data/stats';
import { BAG_LIMIT, RUN_VERSION, emptyMaterials, type RunState } from './run';

/**
 * Saves live in localStorage. Anything read back is treated as untrusted:
 * a hand-edited or corrupted save is validated field by field and dropped if it fails.
 */
const KEY = 'mythrpg.save.v1';
const MAX_SAVE_BYTES = 200_000;

export interface MetaState {
  version: 1;
  souls: number;
  /** Myth ids cleared, per difficulty. */
  cleared: Record<Difficulty, string[]>;
  /** Monster ids seen, for the codex. */
  codex: string[];
  bestFloor: number;
  /** Prototype only: Act I clears per difficulty, used to unlock the next one. */
  actClears: Record<Difficulty, number>;
}

export interface SaveFile {
  meta: MetaState;
  run: RunState | null;
}

export function emptyMeta(): MetaState {
  return {
    version: 1,
    souls: 0,
    cleared: { easy: [], medium: [], hard: [], hell: [] },
    codex: [],
    bestFloor: 0,
    actClears: { easy: 0, medium: 0, hard: 0, hell: 0 },
  };
}

export function isDifficultyUnlocked(meta: MetaState, d: Difficulty): boolean {
  const below = UNLOCKED_BY[d];
  if (!below) return true;
  // Design rule: clearing any myth on the level below unlocks this one.
  // The prototype only has Act I, so an Act I clear counts.
  return meta.cleared[below].length > 0 || meta.actClears[below] > 0;
}

// ---------- validation helpers ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isNum = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isStr = (v: unknown, max = 64): v is string => typeof v === 'string' && v.length <= max;
const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);

function validItem(v: unknown): v is Item {
  if (!isObj(v)) return false;
  if (!isStr(v.uid, 16) || !isStr(v.base) || !baseById(v.base)) return false;
  if (!(RARITY_ORDER as readonly unknown[]).includes(v.rarity)) return false;
  if (!isInt(v.ilvl, 1, 200) || !isInt(v.upgrades, 0, 10)) return false;
  if (v.element !== null && !(ELEMENTS as readonly unknown[]).includes(v.element)) return false;
  if (!isObj(v.affixes)) return false;
  for (const [k, val] of Object.entries(v.affixes)) {
    if (!(STAT_KEYS as readonly string[]).includes(k) || !isInt(val, 0, 999)) return false;
  }
  return true;
}

function validMeta(v: unknown): v is MetaState {
  if (!isObj(v) || v.version !== 1) return false;
  if (!isInt(v.souls, 0, 1e9) || !isInt(v.bestFloor, 0, 100)) return false;
  if (!Array.isArray(v.codex) || v.codex.length > 500 || !v.codex.every((c) => isStr(c))) return false;
  if (!isObj(v.cleared) || !isObj(v.actClears)) return false;
  for (const d of DIFFICULTIES) {
    const list = v.cleared[d];
    if (!Array.isArray(list) || list.length > 20 || !list.every((m) => isStr(m) && !!mythById(m))) return false;
    if (!isInt(v.actClears[d], 0, 1e6)) return false;
  }
  return true;
}

export function validRun(v: unknown): v is RunState {
  if (!isObj(v) || v.version !== RUN_VERSION) return false;
  if (!isInt(v.seed, 0, 0xffffffff) || !isInt(v.rngState, 0, 0xffffffff)) return false;
  if (!isStr(v.classId) || !classById(v.classId)?.playable) return false;
  if (!isStr(v.mythId) || !mythById(v.mythId)?.playable) return false;
  if (!isDifficulty(v.difficulty)) return false;
  if (!isInt(v.floor, 1, 100) || !isInt(v.level, 1, 999) || !isInt(v.xp, 0, 1e9)) return false;
  if (!isInt(v.freePoints, 0, 9999) || !isNum(v.hp, 0, 1e7) || !isNum(v.rage, 0, 100)) return false;
  if (!isInt(v.gold, 0, 1e9) || !isInt(v.potions, 0, 99)) return false;
  if (!isInt(v.floorsSinceSkill, 0, 1000) || !isInt(v.uidCounter, 0, 1e9) || !isInt(v.kills, 0, 1e9)) return false;
  if (!isObj(v.allocated)) return false;
  for (const k of STAT_KEYS) if (!isInt(v.allocated[k], 0, 9999)) return false;
  if (!isObj(v.materials)) return false;
  for (const m of MATERIALS) if (!isInt(v.materials[m], 0, 9999)) return false;
  if (!isObj(v.equipped)) return false;
  for (const [slot, item] of Object.entries(v.equipped)) {
    if (!(SLOTS as readonly string[]).includes(slot) || !validItem(item)) return false;
    if (baseById(item.base)?.slot !== (slot as Slot)) return false;
  }
  if (!Array.isArray(v.bag) || v.bag.length > BAG_LIMIT || !v.bag.every(validItem)) return false;
  if (!Array.isArray(v.skills) || v.skills.length > 50) return false;
  for (const s of v.skills) {
    if (!isObj(s) || !isStr(s.id) || !skillById(s.id) || !isInt(s.level, 1, MAX_SKILL_LEVEL)) return false;
  }
  if (!Array.isArray(v.skillSlots) || v.skillSlots.length !== SKILL_SLOTS) return false;
  const known = (v.skills as { id: string }[]).map((s) => s.id);
  for (const slot of v.skillSlots) if (slot !== null && !(isStr(slot) && known.includes(slot))) return false;
  return true;
}

// ---------- storage ----------

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function parseSave(raw: string | null): SaveFile {
  const fallback: SaveFile = { meta: emptyMeta(), run: null };
  if (!raw || raw.length > MAX_SAVE_BYTES) return fallback;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!isObj(data)) return fallback;
  const meta = validMeta(data.meta) ? data.meta : emptyMeta();
  const run = validRun(data.run) ? data.run : null;
  if (run) {
    // Older saves may lack newer material keys; fill them in.
    run.materials = { ...emptyMaterials(), ...run.materials };
  }
  return { meta, run };
}

export function loadSave(): SaveFile {
  return parseSave(storage()?.getItem(KEY) ?? null);
}

export function writeSave(save: SaveFile): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked (private mode). The game keeps running without saving.
  }
}
