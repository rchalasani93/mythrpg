import Phaser from 'phaser';
import { baseById, type Slot } from '../data/items';
import { PIXEL_SCALE, CHAR_W, CHAR_H } from '../art/sprites';
import type { RunState } from '../systems/run';

/** Hand positions on the 16x20 grid, converted to offsets from the sprite center. */
const HAND_RIGHT = { x: (12.5 - CHAR_W / 2) * PIXEL_SCALE, y: (13 - CHAR_H / 2) * PIXEL_SCALE };
const HAND_LEFT = { x: (3.5 - CHAR_W / 2) * PIXEL_SCALE, y: (12 - CHAR_H / 2) * PIXEL_SCALE };

/** Draw order for gear layers, bottom to top. */
const LAYER_ORDER: readonly Slot[] = ['pants', 'boots', 'armor', 'gloves', 'helmet'];

/**
 * The paper-doll character: a body plus one image per equipped slot, all on the same grid,
 * so whatever is equipped shows on the sprite.
 */
export class CharacterView extends Phaser.GameObjects.Container {
  private body_: Phaser.GameObjects.Image;
  private layers = new Map<Slot, Phaser.GameObjects.Image>();
  private weapon: Phaser.GameObjects.Image | null = null;
  private shield: Phaser.GameObjects.Image | null = null;
  private facing: 1 | -1 = 1;
  private swinging = false;
  private restAngle = 25;

  constructor(scene: Phaser.Scene, x: number, y: number, run: RunState) {
    super(scene, x, y);
    this.body_ = scene.add.image(0, 0, `body_${run.classId}`);
    this.add(this.body_);
    this.refresh(run);
    scene.add.existing(this);
  }

  refresh(run: RunState): void {
    for (const img of this.layers.values()) img.destroy();
    this.layers.clear();
    this.weapon?.destroy();
    this.shield?.destroy();
    this.weapon = null;
    this.shield = null;

    const side = run.equipped.side;
    const sideBase = side ? baseById(side.base) : undefined;
    if (sideBase) {
      this.shield = this.scene.add.image(HAND_LEFT.x, HAND_LEFT.y, 'gear_shield').setTint(sideBase.tint);
      this.add(this.shield);
    }
    for (const slot of LAYER_ORDER) {
      const item = run.equipped[slot];
      const base = item ? baseById(item.base) : undefined;
      if (!base) continue;
      const img = this.scene.add.image(0, 0, `gear_${base.shape}`).setTint(base.tint);
      this.layers.set(slot, img);
      this.add(img);
    }
    const weapon = run.equipped.weapon;
    const weaponBase = weapon ? baseById(weapon.base) : undefined;
    if (weaponBase) {
      this.weapon = this.scene.add
        .image(HAND_RIGHT.x, HAND_RIGHT.y, `gear_${weaponBase.shape === 'axe' ? 'axe' : 'sword'}`)
        .setOrigin(0.5, 0.82)
        .setTint(weaponBase.tint);
      this.add(this.weapon);
    }
    this.applyFacing();
  }

  setFacing(dir: 1 | -1): void {
    if (dir === this.facing) return;
    this.facing = dir;
    this.applyFacing();
  }

  private applyFacing(): void {
    const flip = this.facing === -1;
    this.body_.setFlipX(flip);
    for (const img of this.layers.values()) img.setFlipX(flip);
    if (this.shield) this.shield.setX(HAND_LEFT.x * this.facing).setFlipX(flip);
    if (this.weapon) {
      this.weapon.setX(HAND_RIGHT.x * this.facing).setFlipX(flip);
      if (!this.swinging) this.weapon.setAngle(this.restAngle * this.facing);
    }
  }

  /** A quick swing from over the shoulder to the front, in the facing direction. */
  swing(duration: number): void {
    if (!this.weapon) return;
    this.swinging = true;
    const w = this.weapon;
    this.scene.tweens.killTweensOf(w);
    w.setAngle(-70 * this.facing);
    this.scene.tweens.add({
      targets: w,
      angle: 115 * this.facing,
      duration: Math.max(60, duration * 0.6),
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: w,
          angle: this.restAngle * this.facing,
          duration: Math.max(60, duration * 0.4),
          onComplete: () => {
            this.swinging = false;
          },
        });
      },
    });
  }

  /** Spin the weapon a full circle (Whirlwind). */
  spin(duration: number): void {
    if (!this.weapon) return;
    this.swinging = true;
    const w = this.weapon;
    this.scene.tweens.killTweensOf(w);
    this.scene.tweens.add({
      targets: w,
      angle: { from: 0, to: 360 * 4 * this.facing },
      duration,
      onComplete: () => {
        this.swinging = false;
        w.setAngle(this.restAngle * this.facing);
      },
    });
  }

  flash(color: number): void {
    const parts: Phaser.GameObjects.Image[] = [this.body_, ...this.layers.values()];
    for (const p of parts) {
      p.setData('baseTint', p.tint);
      p.setTint(color).setTintMode(Phaser.TintModes.FILL);
    }
    this.scene.time.delayedCall(80, () => {
      for (const p of parts) {
        if (!p.active) continue;
        p.setTintMode(Phaser.TintModes.MULTIPLY).setTint((p.getData('baseTint') as number | undefined) ?? 0xffffff);
      }
    });
  }
}
