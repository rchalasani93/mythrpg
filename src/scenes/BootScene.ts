import Phaser from 'phaser';
import type { PixelGrid } from '../art/pixel';
import {
  PIXEL_SCALE,
  bodySprite,
  chestSprite,
  coinSprite,
  floorTile,
  gearDropSprite,
  gearSprite,
  harpySprite,
  hopliteSprite,
  materialSprite,
  minotaurSprite,
  pillarSprite,
  potionSprite,
  satyrSprite,
  scrollSprite,
  shieldSprite,
  skillIcon,
  stairsSprite,
  wallTile,
  weaponSprite,
} from '../art/sprites';
import { CLASSES } from '../data/classes';
import { MYTHS } from '../data/myths';
import { SKILLS } from '../data/skills';
import { HEX } from '../ui/theme';
import type { LayerShape } from '../data/items';

/** Draws a pixel grid into a canvas texture, scaled up so no sprite needs runtime scaling. */
export function registerGrid(scene: Phaser.Scene, key: string, grid: PixelGrid, scale = PIXEL_SCALE): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, grid.w * scale, grid.h * scale);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(scale, scale);
  grid.draw(ctx);
  ctx.restore();
  tex.refresh();
}

function darken(n: number, f: number): number {
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return (r << 16) | (g << 8) | b;
}

const GEAR_SHAPES: readonly LayerShape[] = ['cap', 'helm', 'robe', 'cuirass', 'gloves', 'trousers', 'greaves', 'sandals', 'boots'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    for (const c of CLASSES) registerGrid(this, `body_${c.id}`, bodySprite(HEX(c.tunic), HEX(darken(c.tunic, 0.7))));
    for (const s of GEAR_SHAPES) registerGrid(this, `gear_${s}`, gearSprite(s));
    registerGrid(this, 'gear_sword', weaponSprite('sword'));
    registerGrid(this, 'gear_axe', weaponSprite('axe'));
    registerGrid(this, 'gear_shield', shieldSprite());

    registerGrid(this, 'mon_satyr', satyrSprite());
    registerGrid(this, 'mon_harpy', harpySprite());
    registerGrid(this, 'mon_hoplite', hopliteSprite());
    registerGrid(this, 'mon_minotaur', minotaurSprite());

    for (const myth of MYTHS) {
      myth.acts.forEach((act, i) => {
        for (let v = 0; v < 4; v++) {
          registerGrid(this, `floor_${myth.id}_${i}_${v}`, floorTile(HEX(act.ground), HEX(act.groundAlt), v * 97 + 13));
        }
        registerGrid(this, `wall_${myth.id}_${i}`, wallTile(HEX(act.wall)));
      });
    }
    registerGrid(this, 'pillar', pillarSprite());
    registerGrid(this, 'stairs', stairsSprite());
    registerGrid(this, 'chest', chestSprite());
    registerGrid(this, 'drop_gold', coinSprite());
    registerGrid(this, 'drop_potion', potionSprite());
    registerGrid(this, 'drop_scroll', scrollSprite());
    registerGrid(this, 'drop_item', gearDropSprite());
    registerGrid(this, 'drop_material', materialSprite());
    for (const s of SKILLS) registerGrid(this, `skill_${s.id}`, skillIcon(s.id));

    // 1x1 white pixel for particles and flashes.
    const px = this.textures.createCanvas('px', 2, 2);
    if (px) {
      const ctx = px.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 2, 2);
      px.refresh();
    }

    this.scene.start('menu');
  }
}
