import Phaser from 'phaser';
import { ELEMENT_COLOR, ELEMENT_LABEL } from '../data/elements';
import { MATERIALS, MATERIAL_LABEL, SLOTS, SLOT_LABEL, baseById, itemName, itemPower, meetsRequirements, type Item, type Slot } from '../data/items';
import { RARITY_COLOR, RARITY_LABEL, SKILL_SLOTS, skillById, skillCooldown, skillPower } from '../data/skills';
import { STAT_HELP, STAT_KEYS, STAT_LABEL, type StatKey } from '../data/stats';
import { CharacterView } from '../entities/CharacterView';
import {
  BAG_LIMIT,
  allocatePoint,
  assignSkill,
  derivedOf,
  equipFromBag,
  sellFromBag,
  sellValue,
  totalStats,
  unequip,
  weaponOf,
  type RunState,
} from '../systems/run';
import { session } from '../systems/session';
import { Button, COLOR, panel, text } from '../ui/theme';

type Selection = { from: 'bag'; uid: string } | { from: 'slot'; slot: Slot } | null;

export class InventoryScene extends Phaser.Scene {
  private run!: RunState;
  private selected: Selection = null;
  private pickedSkill: string | null = null;
  private message = '';

  constructor() {
    super('inventory');
  }

  create(): void {
    const run = session.run;
    if (!run) {
      this.close();
      return;
    }
    this.run = run;
    this.selected = null;
    this.pickedSkill = null;
    this.message = '';
    const kb = this.input.keyboard;
    kb?.on('keydown-I', () => this.close());
    kb?.on('keydown-TAB', () => this.close());
    kb?.on('keydown-ESC', () => this.close());
    this.render();
  }

  private close(): void {
    session.persist();
    this.scene.stop();
    this.scene.resume('game');
  }

  private render(): void {
    this.children.removeAll(true);
    this.add.rectangle(0, 0, 960, 540, 0x0e0c0a, 0.88).setOrigin(0, 0).setInteractive();
    this.drawEquipment();
    this.drawBag();
    this.drawDetails();
    this.drawStats();
    this.drawSkills();
    new Button(this, 840, 488, 'Close', () => this.close(), { width: 100, height: 36, accent: true });
    if (this.message) text(this, 340, 500, this.message, 18, COLOR.accent);
  }

  // ---------- equipment ----------

  private drawEquipment(): void {
    panel(this, 16, 16, 300, 508);
    text(this, 30, 24, 'EQUIPMENT', 18, COLOR.ink, true);
    const preview = new CharacterView(this, 166, 120, this.run).setScale(1.6);
    void preview;
    SLOTS.forEach((slot, i) => {
      const y = 214 + i * 42;
      const item = this.run.equipped[slot];
      const isSel = this.selected?.from === 'slot' && this.selected.slot === slot;
      const row = panel(this, 28, y, 276, 36).setStrokeStyle(2, isSel ? COLOR.accent : COLOR.line);
      text(this, 38, y + 2, SLOT_LABEL[slot], 16, COLOR.inkDim);
      text(this, 38, y + 16, item ? itemName(item) : 'Empty', 18, item ? RARITY_COLOR[item.rarity] : COLOR.line);
      if (item) text(this, 294, y + 10, `${itemPower(item)}`, 18, COLOR.ink).setOrigin(1, 0);
      row.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selected = item ? { from: 'slot', slot } : null;
        this.message = '';
        this.render();
      });
    });
  }

  // ---------- bag ----------

  private drawBag(): void {
    panel(this, 328, 16, 340, 268);
    text(this, 342, 24, `BAG ${this.run.bag.length}/${BAG_LIMIT}`, 18, COLOR.ink, true);
    const cell = 50;
    for (let i = 0; i < BAG_LIMIT; i++) {
      const x = 352 + (i % 5) * (cell + 12);
      const y = 52 + Math.floor(i / 5) * (cell + 6);
      const item = this.run.bag[i];
      const isSel = !!item && this.selected?.from === 'bag' && this.selected.uid === item.uid;
      const box = this.add.rectangle(x, y, cell, cell, COLOR.panelLight).setOrigin(0, 0).setStrokeStyle(2, isSel ? COLOR.accent : item ? RARITY_COLOR[item.rarity] : COLOR.line);
      if (!item) continue;
      const base = baseById(item.base);
      const icon = base?.slot === 'weapon' ? `gear_${base.shape === 'axe' ? 'axe' : 'sword'}` : base?.slot === 'side' ? 'gear_shield' : 'drop_item';
      const img = this.add.image(x + cell / 2, y + cell / 2, icon).setTint(base?.tint ?? 0xffffff);
      const s = Math.min(1, (cell - 12) / Math.max(img.width, img.height));
      img.setScale(s);
      if (!meetsRequirements(item, totalStats(this.run))) text(this, x + 4, y + 2, 'req', 14, COLOR.danger);
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selected = { from: 'bag', uid: item.uid };
        this.message = '';
        this.render();
      });
    }
  }

  private selectedItem(): Item | undefined {
    const s = this.selected;
    if (!s) return undefined;
    return s.from === 'bag' ? this.run.bag.find((i) => i.uid === s.uid) : this.run.equipped[s.slot];
  }

  private drawDetails(): void {
    panel(this, 328, 292, 340, 196);
    const item = this.selectedItem();
    if (!item) {
      text(this, 342, 300, 'Select an item to see it here.', 18, COLOR.inkDim);
      const mats = MATERIALS.map((m) => `${MATERIAL_LABEL[m]} ${this.run.materials[m]}`).join('   ');
      text(this, 342, 330, `Materials`, 18, COLOR.ink);
      text(this, 342, 350, mats, 16, COLOR.inkDim).setWordWrapWidth(310);
      text(this, 342, 400, `Gold ${this.run.gold}   Potions ${this.run.potions}`, 18, COLOR.ink);
      return;
    }
    const base = baseById(item.base);
    if (!base) return;
    text(this, 342, 298, itemName(item), 22, RARITY_COLOR[item.rarity]);
    text(this, 342, 320, `${RARITY_LABEL[item.rarity]} ${SLOT_LABEL[base.slot].toLowerCase()}, item level ${item.ilvl}`, 16, COLOR.inkDim);
    const lines: { t: string; c: number }[] = [];
    if (base.slot === 'weapon') {
      lines.push({ t: `Damage ${itemPower(item)}   Speed ${base.speed ?? 1}/s   Reach ${base.reach ?? 0}`, c: COLOR.ink });
    } else {
      lines.push({ t: `Defense ${itemPower(item)}`, c: COLOR.ink });
    }
    const aff = (Object.keys(item.affixes) as StatKey[]).map((k) => `+${item.affixes[k]} ${STAT_LABEL[k]}`).join('  ');
    if (aff) lines.push({ t: aff, c: COLOR.good });
    if (item.element) lines.push({ t: `${ELEMENT_LABEL[item.element]} element`, c: ELEMENT_COLOR[item.element] });
    if (base.requires) {
      const req = (Object.keys(base.requires) as StatKey[]).map((k) => `${STAT_LABEL[k]} ${base.requires?.[k]}`).join(', ');
      lines.push({ t: `Requires ${req}`, c: meetsRequirements(item, totalStats(this.run)) ? COLOR.inkDim : COLOR.danger });
    }
    const current = this.run.equipped[base.slot];
    if (this.selected?.from === 'bag' && current) {
      const diff = itemPower(item) - itemPower(current);
      const sign = diff > 0 ? '+' : '';
      lines.push({ t: `Compared to ${itemName(current)}: ${sign}${Math.round(diff * 10) / 10}`, c: diff >= 0 ? COLOR.good : COLOR.danger });
    }
    lines.forEach((l, i) => text(this, 342, 342 + i * 20, l.t, 18, l.c));

    const s = this.selected;
    if (s?.from === 'bag') {
      new Button(this, 342, 446, 'Equip', () => {
        const res = equipFromBag(this.run, item.uid);
        this.message = res === 'requirements' ? 'Stats too low to equip this.' : '';
        if (res === 'ok') this.selected = { from: 'slot', slot: base.slot };
        this.render();
      }, { width: 140, height: 34, accent: true });
      new Button(this, 494, 446, `Sell ${sellValue(item)}g`, () => {
        sellFromBag(this.run, item.uid);
        this.selected = null;
        this.render();
      }, { width: 140, height: 34 });
    } else if (s?.from === 'slot') {
      new Button(this, 342, 446, 'Unequip', () => {
        this.message = unequip(this.run, s.slot) ? '' : 'Bag is full.';
        this.selected = null;
        this.render();
      }, { width: 140, height: 34 });
    }
  }

  // ---------- stats ----------

  private drawStats(): void {
    panel(this, 680, 16, 264, 228);
    const pts = this.run.freePoints;
    text(this, 694, 24, 'STATS', 18, COLOR.ink, true);
    text(this, 930, 26, pts ? `${pts} points` : `Level ${this.run.level}`, 18, pts ? COLOR.accent : COLOR.inkDim).setOrigin(1, 0);
    const stats = totalStats(this.run);
    STAT_KEYS.forEach((k, i) => {
      const y = 52 + i * 30;
      text(this, 694, y, `${STAT_LABEL[k]} ${stats[k]}`, 20, COLOR.ink);
      text(this, 760, y + 3, STAT_HELP[k], 16, COLOR.inkDim);
      if (pts > 0) {
        new Button(this, 906, y, '+', () => {
          allocatePoint(this.run, k);
          this.render();
        }, { width: 28, height: 24, size: 20, accent: true });
      }
    });
    const d = derivedOf(this.run);
    const w = weaponOf(this.run);
    const lines = [
      `HP ${Math.ceil(this.run.hp)}/${d.maxHp}   Defense ${Math.round(d.defense * 10) / 10}`,
      `Hit ${Math.round(w.damage * d.physMult)}   Crit ${Math.round(d.critChance * 100)}%   Speed ${(w.speed * d.attackSpeed).toFixed(2)}/s`,
      `${w.favored ? 'Class weapon bonus: +10% damage' : 'No class weapon bonus'}`,
    ];
    lines.forEach((l, i) => text(this, 694, 176 + i * 20, l, 17, i === 2 ? COLOR.inkDim : COLOR.ink));
  }

  // ---------- skills ----------

  private drawSkills(): void {
    panel(this, 680, 252, 264, 226);
    text(this, 694, 260, 'SKILLS', 18, COLOR.ink, true);
    text(this, 930, 262, this.pickedSkill ? 'Pick a slot' : 'Pick a skill', 16, COLOR.inkDim).setOrigin(1, 0);
    for (let i = 0; i < SKILL_SLOTS; i++) {
      const x = 694 + i * 62;
      const y = 288;
      const id = this.run.skillSlots[i];
      const box = this.add.rectangle(x, y, 52, 52, COLOR.panelLight).setOrigin(0, 0).setStrokeStyle(2, this.pickedSkill ? COLOR.accent : COLOR.line);
      if (id) this.add.image(x + 26, y + 26, `skill_${id}`);
      text(this, x + 3, y + 1, `${i + 1}`, 14, COLOR.inkDim);
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.pickedSkill) {
          assignSkill(this.run, i, this.pickedSkill);
          this.pickedSkill = null;
          this.render();
        }
      });
    }
    this.run.skills.forEach((s, i) => {
      const def = skillById(s.id);
      if (!def) return;
      const y = 350 + i * 18;
      if (y > 462) return;
      const picked = this.pickedSkill === s.id;
      const t = text(
        this,
        694,
        y,
        `${def.name} ${s.level}   ${def.power > 0 ? `${Math.round(skillPower(def, s.level) * 100)}%` : 'Buff'}  ${skillCooldown(def, s.level).toFixed(1)}s${def.rageCost ? `  ${def.rageCost} Rage` : ''}`,
        17,
        picked ? COLOR.accent : RARITY_COLOR[def.rarity],
      );
      t.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.pickedSkill = picked ? null : s.id;
        this.render();
      });
    });

  }
}
