import Phaser from 'phaser';
import { COLOR, text } from '../ui/theme';

export interface TouchButton {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
}

/**
 * Virtual joystick on the left half of the screen, round buttons on the right.
 * Each pointer is tracked on its own, so moving and attacking work at the same time.
 */
export class TouchControls {
  readonly move = new Phaser.Math.Vector2(0, 0);
  private held = new Set<string>();
  private pressed = new Set<string>();
  private stickPointer: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private buttonPointers = new Map<number, string>();
  private gfx: Phaser.GameObjects.Graphics;
  private cooldownGfx: Phaser.GameObjects.Graphics;
  private stickKnob = new Phaser.Math.Vector2();
  readonly buttons: TouchButton[];
  private readonly stickRadius = 56;

  constructor(private scene: Phaser.Scene, skillIcons: (string | null)[]) {
    const { width, height } = scene.scale;
    const bx = width - 80;
    const by = height - 86;
    this.buttons = [
      { id: 'attack', x: bx, y: by, r: 42, label: 'ATK' },
      { id: 'dodge', x: bx - 100, y: by + 26, r: 30, label: 'DASH' },
      { id: 'skill0', x: bx - 92, y: by - 62, r: 28, label: '1' },
      { id: 'skill1', x: bx - 30, y: by - 108, r: 28, label: '2' },
      { id: 'skill2', x: bx + 44, y: by - 104, r: 28, label: '3' },
      { id: 'skill3', x: bx - 160, y: by - 30, r: 28, label: '4' },
      { id: 'potion', x: bx - 190, y: by + 40, r: 24, label: 'POT' },
      { id: 'bag', x: 34, y: 92, r: 22, label: 'BAG' },
    ];
    scene.input.addPointer(3);
    this.gfx = scene.add.graphics().setDepth(5000).setScrollFactor(0);
    this.cooldownGfx = scene.add.graphics().setDepth(5002).setScrollFactor(0);
    for (const b of this.buttons) {
      if (b.id.startsWith('skill')) continue;
      text(scene, b.x, b.y, b.label, b.r > 30 ? 22 : 16, COLOR.ink).setOrigin(0.5).setDepth(5001);
    }
    this.setIcons(skillIcons);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('pointerupoutside', this.onUp, this);
    });
    this.draw();
  }

  private icons: Phaser.GameObjects.GameObject[] = [];

  /** Skill buttons show the skill's icon, or the slot number when empty. */
  setIcons(skillIcons: (string | null)[]): void {
    for (const o of this.icons) o.destroy();
    this.icons = [];
    for (const b of this.buttons) {
      if (!b.id.startsWith('skill')) continue;
      const icon = skillIcons[Number(b.id.slice(5))];
      this.icons.push(
        icon
          ? this.scene.add.image(b.x, b.y, icon).setDepth(5001).setAlpha(0.9)
          : text(this.scene, b.x, b.y, b.label, 16, COLOR.inkDim).setOrigin(0.5).setDepth(5001),
      );
    }
  }

  isHeld(id: string): boolean {
    return this.held.has(id);
  }

  /** True once per press. */
  consume(id: string): boolean {
    if (this.pressed.has(id)) {
      this.pressed.delete(id);
      return true;
    }
    return false;
  }

  private buttonAt(x: number, y: number): TouchButton | undefined {
    return this.buttons.find((b) => Phaser.Math.Distance.Between(x, y, b.x, b.y) <= b.r + 10);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!p.wasTouch) return;
    const b = this.buttonAt(p.x, p.y);
    if (b) {
      this.buttonPointers.set(p.id, b.id);
      this.held.add(b.id);
      this.pressed.add(b.id);
    } else if (p.x < this.scene.scale.width * 0.45 && this.stickPointer === null) {
      this.stickPointer = p.id;
      this.stickOrigin.set(p.x, p.y);
      this.stickKnob.set(p.x, p.y);
    }
    this.draw();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.stickPointer) return;
    const dx = p.x - this.stickOrigin.x;
    const dy = p.y - this.stickOrigin.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.stickRadius);
    if (len > 6) {
      this.move.set(dx / len, dy / len).scale(Math.min(1, clamped / (this.stickRadius * 0.6)));
      this.stickKnob.set(this.stickOrigin.x + (dx / len) * clamped, this.stickOrigin.y + (dy / len) * clamped);
    } else {
      this.move.set(0, 0);
      this.stickKnob.copy(this.stickOrigin);
    }
    this.draw();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      this.move.set(0, 0);
    }
    const id = this.buttonPointers.get(p.id);
    if (id) {
      this.held.delete(id);
      this.buttonPointers.delete(p.id);
    }
    this.draw();
  }

  /** Cooldown fractions (0 ready, 1 just used) keyed by button id. */
  drawCooldowns(fracs: Record<string, number>): void {
    const g = this.cooldownGfx;
    g.clear();
    for (const b of this.buttons) {
      const f = fracs[b.id] ?? 0;
      if (f <= 0) continue;
      g.fillStyle(0x000000, 0.55);
      g.slice(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false);
      g.fillPath();
    }
  }

  private draw(): void {
    const g = this.gfx;
    g.clear();
    for (const b of this.buttons) {
      const on = this.held.has(b.id);
      g.fillStyle(on ? COLOR.accent : COLOR.panel, on ? 0.6 : 0.55);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(2, on ? COLOR.accent : COLOR.inkDim, 0.9);
      g.strokeCircle(b.x, b.y, b.r);
    }
    if (this.stickPointer !== null) {
      g.lineStyle(2, COLOR.inkDim, 0.6);
      g.strokeCircle(this.stickOrigin.x, this.stickOrigin.y, this.stickRadius);
      g.fillStyle(COLOR.ink, 0.5);
      g.fillCircle(this.stickKnob.x, this.stickKnob.y, 22);
    } else {
      // Hint where the stick lives.
      const { height } = this.scene.scale;
      g.lineStyle(2, COLOR.inkDim, 0.25);
      g.strokeCircle(110, height - 110, this.stickRadius);
    }
  }
}
