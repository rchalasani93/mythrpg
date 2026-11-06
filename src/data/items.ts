import type { Element } from './elements';
import type { Rarity } from './skills';
import type { Stats, StatKey } from './stats';

export type Slot = 'weapon' | 'side' | 'helmet' | 'armor' | 'gloves' | 'pants' | 'boots';

export const SLOTS: readonly Slot[] = ['weapon', 'side', 'helmet', 'armor', 'gloves', 'pants', 'boots'];

export const SLOT_LABEL: Record<Slot, string> = {
  weapon: 'Weapon',
  side: 'Side weapon',
  helmet: 'Helmet',
  armor: 'Armor',
  gloves: 'Gloves',
  pants: 'Pants',
  boots: 'Boots',
};

/** Which sprite shape a base item uses for its layer on the character. */
export type LayerShape =
  | 'sword'
  | 'axe'
  | 'shield'
  | 'cap'
  | 'helm'
  | 'robe'
  | 'cuirass'
  | 'gloves'
  | 'trousers'
  | 'greaves'
  | 'sandals'
  | 'boots';

export interface BaseItem {
  id: string;
  name: string;
  slot: Slot;
  /** Weapons: damage. Others: defense. */
  power: number;
  /** Attacks per second at 1.0 attack speed (weapons only). */
  speed?: number;
  /** Reach of the basic attack in px (weapons only). */
  reach?: number;
  requires?: Partial<Stats>;
  shape: LayerShape;
  tint: number;
  /** Earliest floor this base can drop on. */
  minFloor: number;
}

export const BASE_ITEMS: readonly BaseItem[] = [
  { id: 'bronze_sword', name: 'Bronze Sword', slot: 'weapon', power: 10, speed: 1.6, reach: 56, shape: 'sword', tint: 0xc58b3a, minFloor: 1 },
  { id: 'iron_xiphos', name: 'Iron Xiphos', slot: 'weapon', power: 13, speed: 1.75, reach: 54, shape: 'sword', tint: 0xa7adb3, minFloor: 4 },
  { id: 'bronze_axe', name: 'Bronze Axe', slot: 'weapon', power: 15, speed: 1.15, reach: 60, requires: { str: 10 }, shape: 'axe', tint: 0xc58b3a, minFloor: 2 },
  { id: 'labrys', name: 'Labrys', slot: 'weapon', power: 22, speed: 0.95, reach: 66, requires: { str: 16 }, shape: 'axe', tint: 0xd4c27a, minFloor: 7 },

  { id: 'wicker_shield', name: 'Wicker Shield', slot: 'side', power: 2, shape: 'shield', tint: 0xa98a52, minFloor: 1 },
  { id: 'hoplon', name: 'Hoplon', slot: 'side', power: 5, requires: { str: 11 }, shape: 'shield', tint: 0xc58b3a, minFloor: 4 },

  { id: 'leather_cap', name: 'Leather Cap', slot: 'helmet', power: 1, shape: 'cap', tint: 0x8b5a2b, minFloor: 1 },
  { id: 'bronze_helm', name: 'Corinthian Helm', slot: 'helmet', power: 3, requires: { vit: 9 }, shape: 'helm', tint: 0xc58b3a, minFloor: 3 },

  { id: 'linen_chiton', name: 'Linen Chiton', slot: 'armor', power: 1, shape: 'robe', tint: 0xd9cfb4, minFloor: 1 },
  { id: 'linothorax', name: 'Linothorax', slot: 'armor', power: 4, shape: 'cuirass', tint: 0xe2d6b0, minFloor: 2 },
  { id: 'bronze_cuirass', name: 'Bronze Cuirass', slot: 'armor', power: 7, requires: { str: 12, vit: 10 }, shape: 'cuirass', tint: 0xc58b3a, minFloor: 5 },

  { id: 'leather_wraps', name: 'Leather Wraps', slot: 'gloves', power: 1, shape: 'gloves', tint: 0x8b5a2b, minFloor: 1 },
  { id: 'bronze_bracers', name: 'Bronze Bracers', slot: 'gloves', power: 2, shape: 'gloves', tint: 0xc58b3a, minFloor: 4 },

  { id: 'wool_trousers', name: 'Wool Trousers', slot: 'pants', power: 1, shape: 'trousers', tint: 0x6b5b45, minFloor: 1 },
  { id: 'bronze_greaves', name: 'Bronze Greaves', slot: 'pants', power: 3, requires: { vit: 9 }, shape: 'greaves', tint: 0xc58b3a, minFloor: 3 },

  { id: 'sandals', name: 'Sandals', slot: 'boots', power: 0, shape: 'sandals', tint: 0x9b6a3a, minFloor: 1 },
  { id: 'hide_boots', name: 'Hide Boots', slot: 'boots', power: 2, shape: 'boots', tint: 0x7a5233, minFloor: 2 },
];

export function baseById(id: string): BaseItem | undefined {
  return BASE_ITEMS.find((b) => b.id === id);
}

/** A rolled item instance. Kept plain so it can be saved as JSON. */
export interface Item {
  uid: string;
  base: string;
  rarity: Rarity;
  /** Item level, scales power. */
  ilvl: number;
  affixes: Partial<Record<StatKey, number>>;
  element: Element | null;
  /** Times upgraded at a forge. */
  upgrades: number;
}

export function itemPower(item: Item): number {
  const base = baseById(item.base);
  if (!base) return 0;
  const levelScale = 1 + (item.ilvl - 1) * 0.08;
  const rarityScale = { common: 1, rare: 1.12, epic: 1.25, legendary: 1.4, mythic: 1.6 }[item.rarity];
  const upgradeScale = 1 + item.upgrades * 0.1;
  const raw = base.power * levelScale * rarityScale * upgradeScale;
  return base.slot === 'weapon' ? Math.round(raw) : Math.round(raw * 10) / 10;
}

export function itemName(item: Item): string {
  const base = baseById(item.base);
  const name = base?.name ?? 'Unknown';
  const plus = item.upgrades > 0 ? ` +${item.upgrades}` : '';
  return name + plus;
}

export function meetsRequirements(item: Item, stats: Stats): boolean {
  const req = baseById(item.base)?.requires;
  if (!req) return true;
  return (Object.keys(req) as StatKey[]).every((k) => stats[k] >= (req[k] ?? 0));
}

export type Consumable = 'potion';
export type Material = 'satyr_horn' | 'harpy_feather' | 'shade_dust' | 'minotaur_horn';

export const MATERIAL_LABEL: Record<Material, string> = {
  satyr_horn: 'Satyr Horn',
  harpy_feather: 'Harpy Feather',
  shade_dust: 'Shade Dust',
  minotaur_horn: 'Minotaur Horn',
};

export const MATERIALS: readonly Material[] = ['satyr_horn', 'harpy_feather', 'shade_dust', 'minotaur_horn'];
