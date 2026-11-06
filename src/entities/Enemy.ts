import Phaser from 'phaser';
import type { Element } from '../data/elements';
import type { MonsterDef } from '../data/monsters';

export interface EnemyHost {
  readonly player: { x: number; y: number; r: number };
  /** Called when an enemy attack connects (range and timing already checked). */
  hurtPlayer(damage: number, source: Enemy, element: Element | null): void;
  spawnMinions(id: string, count: number, x: number, y: number): void;
  shake(intensity: number, ms: number): void;
  moveCircle(x: number, y: number, r: number, dx: number, dy: number): { x: number; y: number; hitWall: boolean };
  readonly extraBossPhase: boolean;
}

type State =
  | 'chase'
  | 'windup'
  | 'recover'
  | 'orbit'
  | 'dive_tele'
  | 'dive'
  | 'charge_tele'
  | 'charge'
  | 'dazed'
  | 'slam_tele'
  | 'roar';

interface Poison {
  t: number;
  dps: number;
}

/**
 * One monster in the arena. Movement and hits are simple circle math;
 * every dangerous attack is telegraphed on the floor before it lands.
 */
export class Enemy {
  readonly def: MonsterDef;
  readonly sprite: Phaser.GameObjects.Image;
  readonly r: number;
  readonly elite: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  dead = false;
  /** Seconds remaining for each status. */
  burnT = 0;
  burnDps = 0;
  poisons: Poison[] = [];
  chillT = 0;
  stunT = 0;
  soakT = 0;
  blindT = 0;

  private state: State = 'chase';
  private timer = 0;
  private attackCd = 0.6;
  private dirX = 0;
  private dirY = 0;
  private orbitSign = 1;
  private phase = 1;
  private chargesLeft = 0;
  private hpBar: Phaser.GameObjects.Graphics | null = null;
  private flashUntil = 0;

  constructor(scene: Phaser.Scene, def: MonsterDef, x: number, y: number, mult: number, elite: boolean) {
    this.def = def;
    this.elite = elite;
    this.x = x;
    this.y = y;
    const eliteHp = elite ? 2.4 : 1;
    const eliteDmg = elite ? 1.3 : 1;
    this.maxHp = Math.round(def.hp * mult * eliteHp);
    this.hp = this.maxHp;
    this.damage = def.damage * mult * eliteDmg;
    this.speed = def.speed * (elite ? 1.1 : 1);
    this.r = def.radius * (def.boss ? 1.6 : 1.5) * (elite ? 1.25 : 1);
    this.sprite = scene.add.image(x, y, def.texture).setOrigin(0.5, 0.8);
    if (elite) this.sprite.setScale(1.25).setTint(0xf2d48a);
    this.orbitSign = Math.random() < 0.5 ? 1 : -1;
    if (!def.boss) this.hpBar = scene.add.graphics();
    this.state = def.ai === 'swooper' ? 'orbit' : 'chase';
    this.timer = def.ai === 'swooper' ? 1.5 + Math.random() * 1.5 : 0;
  }

  get isBoss(): boolean {
    return !!this.def.boss;
  }

  get blinded(): boolean {
    return this.blindT > 0;
  }

  /** Damage over time and status timers. Returns DoT damage dealt this frame. */
  tickStatuses(dt: number): number {
    let dot = 0;
    if (this.burnT > 0) {
      this.burnT -= dt;
      dot += this.burnDps * dt;
    }
    for (const p of this.poisons) {
      p.t -= dt;
      dot += p.dps * dt;
    }
    this.poisons = this.poisons.filter((p) => p.t > 0);
    this.chillT = Math.max(0, this.chillT - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    this.soakT = Math.max(0, this.soakT - dt);
    this.blindT = Math.max(0, this.blindT - dt);
    return dot;
  }

  addPoison(dps: number): void {
    this.poisons.push({ t: 4, dps });
    if (this.poisons.length > 5) this.poisons.shift();
  }

  update(dt: number, host: EnemyHost): void {
    if (this.dead) return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    if (this.stunT > 0) {
      this.syncSprite();
      return;
    }
    const slow = this.chillT > 0 ? 0.6 : 1;
    const p = host.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    this.timer -= dt;

    switch (this.def.ai) {
      case 'chaser':
      case 'brute':
        this.meleeAI(dt, host, dist, nx, ny, slow);
        break;
      case 'swooper':
        this.swoopAI(dt, host, dist, nx, ny, slow);
        break;
      case 'minotaur':
        this.minotaurAI(dt, host, dist, nx, ny, slow);
        break;
    }
    this.syncSprite();
  }

  private move(host: EnemyHost, vx: number, vy: number, dt: number): boolean {
    const res = host.moveCircle(this.x, this.y, this.r, vx * dt, vy * dt);
    this.x = res.x;
    this.y = res.y;
    if (Math.abs(vx) > 1) this.sprite.setFlipX(vx < 0);
    return res.hitWall;
  }

  private meleeAI(dt: number, host: EnemyHost, dist: number, nx: number, ny: number, slow: number): void {
    const brute = this.def.ai === 'brute';
    const reach = this.r + host.player.r + (brute ? 22 : 14);
    const windup = brute ? 0.6 : 0.38;
    switch (this.state) {
      case 'chase':
        if (dist <= reach && this.attackCd <= 0) {
          this.state = 'windup';
          this.timer = windup;
          this.dirX = nx;
          this.dirY = ny;
        } else if (dist > reach * 0.8) {
          this.move(host, nx * this.speed * slow, ny * this.speed * slow, dt);
        }
        break;
      case 'windup':
        if (this.timer <= 0) {
          if (dist <= reach + 10) host.hurtPlayer(this.damage, this, this.def.elements[0] ?? null);
          this.state = 'recover';
          this.timer = brute ? 0.5 : 0.3;
          this.attackCd = brute ? 1.4 : 0.9;
        }
        break;
      default:
        if (this.timer <= 0) this.state = 'chase';
    }
  }

  private swoopAI(dt: number, host: EnemyHost, dist: number, nx: number, ny: number, slow: number): void {
    switch (this.state) {
      case 'orbit': {
        // Keep a ring distance and circle the player.
        const want = 170;
        const radial = (dist - want) / want;
        const tx = -ny * this.orbitSign;
        const ty = nx * this.orbitSign;
        const vx = (nx * radial * 1.6 + tx) * this.speed * slow;
        const vy = (ny * radial * 1.6 + ty) * this.speed * slow;
        if (this.move(host, vx, vy, dt)) this.orbitSign *= -1;
        if (this.timer <= 0) {
          this.state = 'dive_tele';
          this.timer = 0.45;
          this.dirX = nx;
          this.dirY = ny;
        }
        break;
      }
      case 'dive_tele':
        if (this.timer <= 0) {
          this.state = 'dive';
          this.timer = 0.5;
        }
        break;
      case 'dive': {
        const hit = this.move(host, this.dirX * 400 * slow, this.dirY * 400 * slow, dt);
        if (dist < this.r + host.player.r + 4 && this.attackCd <= 0) {
          host.hurtPlayer(this.damage, this, this.def.elements[0] ?? null);
          this.attackCd = 0.8;
        }
        if (this.timer <= 0 || hit) {
          this.state = 'orbit';
          this.timer = 2.2 + Math.random() * 1.6;
        }
        break;
      }
      default:
        this.state = 'orbit';
    }
  }

  private minotaurAI(dt: number, host: EnemyHost, dist: number, nx: number, ny: number, slow: number): void {
    const hpFrac = this.hp / this.maxHp;
    if (this.phase === 1 && hpFrac < 0.5) {
      this.phase = 2;
      this.state = 'roar';
      this.timer = 1;
      host.shake(0.01, 400);
      host.spawnMinions('satyr', 2, this.x, this.y);
      return;
    }
    if (this.phase === 2 && host.extraBossPhase && hpFrac < 0.25) {
      this.phase = 3;
      this.state = 'roar';
      this.timer = 1;
      host.shake(0.012, 500);
      host.spawnMinions('shade_hoplite', 2, this.x, this.y);
      return;
    }
    const pace = this.phase >= 2 ? 1.3 : 1;
    switch (this.state) {
      case 'roar':
        if (this.timer <= 0) this.state = 'chase';
        break;
      case 'chase': {
        this.move(host, nx * this.speed * pace * slow, ny * this.speed * pace * slow, dt);
        if (this.attackCd > 0) break;
        if (dist < 110) {
          this.state = 'slam_tele';
          this.timer = this.phase >= 2 ? 0.55 : 0.75;
        } else {
          this.state = 'charge_tele';
          this.timer = this.phase >= 2 ? 0.6 : 0.85;
          this.chargesLeft = this.phase >= 2 ? 2 : 1;
          this.dirX = nx;
          this.dirY = ny;
        }
        break;
      }
      case 'charge_tele':
        // Track the player while winding up, then lock the direction.
        if (this.timer > 0.25) {
          this.dirX = nx;
          this.dirY = ny;
        }
        if (this.timer <= 0) {
          this.state = 'charge';
          this.timer = 1.3;
        }
        break;
      case 'charge': {
        const wall = this.move(host, this.dirX * 520, this.dirY * 520, dt);
        if (dist < this.r + host.player.r + 6 && this.attackCd <= 0) {
          host.hurtPlayer(this.damage * 1.4, this, 'earth');
          this.attackCd = 0.5;
        }
        if (wall) {
          host.shake(0.012, 250);
          this.state = 'dazed';
          this.timer = 1.4;
          this.chargesLeft = 0;
        } else if (this.timer <= 0) {
          this.chargesLeft -= 1;
          if (this.chargesLeft > 0) {
            this.state = 'charge_tele';
            this.timer = 0.45;
          } else {
            this.state = 'recover';
            this.timer = 0.6;
            this.attackCd = 0.8;
          }
        }
        break;
      }
      case 'slam_tele':
        if (this.timer <= 0) {
          host.shake(0.01, 200);
          if (dist < this.slamRadius + host.player.r) host.hurtPlayer(this.damage * 1.2, this, 'earth');
          this.state = 'recover';
          this.timer = 0.7;
          this.attackCd = 1.2;
        }
        break;
      case 'dazed':
        if (this.timer <= 0) {
          this.state = 'chase';
          this.attackCd = 0.8;
        }
        break;
      default:
        if (this.timer <= 0) this.state = 'chase';
    }
  }

  private get slamRadius(): number {
    return this.phase >= 2 ? 120 : 100;
  }

  get isDazed(): boolean {
    return this.state === 'dazed';
  }

  /** Draws this enemy's warnings onto the shared telegraph layer. */
  drawTelegraph(g: Phaser.GameObjects.Graphics): void {
    if (this.dead) return;
    const red = 0xc0392b;
    switch (this.state) {
      case 'windup': {
        const reach = this.r + 20 + (this.def.ai === 'brute' ? 22 : 14);
        g.fillStyle(red, 0.28);
        g.slice(this.x, this.y, reach, Math.atan2(this.dirY, this.dirX) - 0.8, Math.atan2(this.dirY, this.dirX) + 0.8, false);
        g.fillPath();
        break;
      }
      case 'dive_tele':
        g.lineStyle(3, red, 0.6);
        g.lineBetween(this.x, this.y, this.x + this.dirX * 200, this.y + this.dirY * 200);
        break;
      case 'charge_tele': {
        const len = 560;
        const w = this.r * 2;
        const ang = Math.atan2(this.dirY, this.dirX);
        g.fillStyle(red, 0.22);
        const px = -Math.sin(ang) * (w / 2);
        const py = Math.cos(ang) * (w / 2);
        g.fillPoints(
          [
            new Phaser.Math.Vector2(this.x + px, this.y + py),
            new Phaser.Math.Vector2(this.x + px + Math.cos(ang) * len, this.y + py + Math.sin(ang) * len),
            new Phaser.Math.Vector2(this.x - px + Math.cos(ang) * len, this.y - py + Math.sin(ang) * len),
            new Phaser.Math.Vector2(this.x - px, this.y - py),
          ],
          true,
        );
        break;
      }
      case 'slam_tele':
        g.fillStyle(red, 0.25);
        g.fillCircle(this.x, this.y, this.slamRadius);
        g.lineStyle(2, red, 0.7);
        g.strokeCircle(this.x, this.y, this.slamRadius);
        break;
      case 'dazed':
        g.lineStyle(2, 0xe8dcc0, 0.8);
        g.strokeCircle(this.x, this.y - this.r * 2.4, 8);
        break;
      default:
        break;
    }
  }

  syncSprite(): void {
    this.sprite.setPosition(this.x, this.y + this.r * 0.6);
    this.sprite.setDepth(this.y);
    const now = this.sprite.scene.time.now;
    if (now > this.flashUntil && this.sprite.tintMode !== Phaser.TintModes.MULTIPLY) {
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY).setTint(this.elite ? 0xf2d48a : this.chillT > 0 ? 0xa8e0f0 : 0xffffff);
    } else if (now > this.flashUntil) {
      this.sprite.setTint(this.elite ? 0xf2d48a : this.chillT > 0 ? 0xa8e0f0 : this.poisons.length ? 0xb8d890 : 0xffffff);
    }
    if (this.hpBar) {
      this.hpBar.clear();
      if (this.hp < this.maxHp) {
        const w = 30;
        const top = this.y - this.sprite.displayHeight * 0.8 + this.r * 0.6 - 8;
        this.hpBar.fillStyle(0x000000, 0.6).fillRect(this.x - w / 2 - 1, top - 1, w + 2, 5);
        this.hpBar.fillStyle(0xb8402e, 1).fillRect(this.x - w / 2, top, w * (this.hp / this.maxHp), 3);
        this.hpBar.setDepth(this.y + 1);
      }
    }
  }

  flash(): void {
    this.flashUntil = this.sprite.scene.time.now + 70;
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  destroy(): void {
    this.dead = true;
    this.sprite.destroy();
    this.hpBar?.destroy();
  }
}
