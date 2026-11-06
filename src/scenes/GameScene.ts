import Phaser from 'phaser';
import { DIFFICULTY_DEFS } from '../data/difficulty';
import { ELEMENT_COLOR, ELEMENT_STATUS, type Element } from '../data/elements';
import { MATERIAL_LABEL, itemName } from '../data/items';
import { monsterById, type MonsterDef } from '../data/monsters';
import { floorKind, mythById, PROTOTYPE_LAST_FLOOR, type ActDef, type FloorKind, type MythDef } from '../data/myths';
import { RARITY_COLOR, skillById, skillCooldown, skillPower, type SkillDef } from '../data/skills';
import { mitigation, xpForLevel } from '../data/stats';
import { CharacterView } from '../entities/CharacterView';
import { Enemy, type EnemyHost } from '../entities/Enemy';
import { TouchControls } from '../input/TouchControls';
import { computeHit, floorScale } from '../systems/combat';
import { rollBossDrops, rollFloorChest, rollKillDrops, rollItem, type Drop } from '../systems/loot';
import { Rng } from '../systems/rng';
import {
  FORGE_MATERIAL_COST,
  addToBag,
  derivedOf,
  forgeCost,
  forgeUpgrade,
  gainXp,
  learnSkill,
  skillLevel,
  totalMaterials,
  weaponOf,
  type RunState,
} from '../systems/run';
import { session } from '../systems/session';
import { Button, COLOR, panel, text } from '../ui/theme';

interface Circle {
  x: number;
  y: number;
  r: number;
}

interface DropObj {
  drop: Drop;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  ready: number;
}

type FloorState = 'fight' | 'cleared' | 'event' | 'dead' | 'leaving';

const BOUNDS = { l: 48, r: 912, t: 112, b: 488 };
const TILE = 48;

export class GameScene extends Phaser.Scene implements EnemyHost {
  run!: RunState;
  rng!: Rng;
  private myth!: MythDef;
  private act!: ActDef;
  private kind!: FloorKind;
  readonly player = { x: 480, y: 420, r: 12 };
  private view!: CharacterView;
  private enemies: Enemy[] = [];
  private pillars: Circle[] = [];
  private drops: DropObj[] = [];
  private telegraph!: Phaser.GameObjects.Graphics;
  private state: FloorState = 'fight';
  private wavesLeft = 0;
  private pendingSpawns = 0;
  private boss: Enemy | null = null;

  // timers, in seconds
  private attackCd = 0;
  private dodgeCd = 0;
  private dodgeT = 0;
  private dodgeDir = new Phaser.Math.Vector2();
  private invulnT = 0;
  private potionCd = 0;
  private warCryT = 0;
  private ironSkinT = 0;
  private spinT = 0;
  private spinTick = 0;
  private spinSkill: { def: SkillDef; level: number } | null = null;
  private leaping = false;
  private sinceCombat = 0;
  private skillCds: Record<string, number> = {};
  private aim = new Phaser.Math.Vector2(1, 0);
  private moveDir = new Phaser.Math.Vector2(0, 1);

  // world objects
  private stairs: Phaser.GameObjects.Image | null = null;
  private chest: Phaser.GameObjects.Image | null = null;
  private altar: Phaser.GameObjects.Container | null = null;
  private altarUsed = false;
  private prompt!: Phaser.GameObjects.Text;
  private eventPanel: Phaser.GameObjects.Container | null = null;
  private pausePanel: Phaser.GameObjects.Container | null = null;

  // input
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touch: TouchControls | null = null;

  // hud
  private hud!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private bossName: Phaser.GameObjects.Text | null = null;
  private skillIcons: Phaser.GameObjects.Image[] = [];
  private skillKeys: Phaser.GameObjects.Text[] = [];
  private toasts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('game');
  }

  get extraBossPhase(): boolean {
    return DIFFICULTY_DEFS[this.run.difficulty].extraBossPhase;
  }

  create(): void {
    const run = session.run;
    if (!run) {
      this.scene.start('menu');
      return;
    }
    this.run = run;
    this.rng = new Rng(run.rngState);
    const myth = mythById(run.mythId);
    if (!myth || !myth.acts[0]) {
      this.scene.start('menu');
      return;
    }
    this.myth = myth;
    this.act = myth.acts[Math.min(myth.acts.length - 1, Math.floor((run.floor - 1) / 20))]!;
    this.kind = floorKind(run.floor, myth);
    this.resetFields();

    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.buildArena();
    this.telegraph = this.add.graphics().setDepth(2);
    this.view = new CharacterView(this, this.player.x, this.player.y, run);
    this.prompt = text(this, 0, 0, '', 18, COLOR.ink).setOrigin(0.5).setDepth(9500).setVisible(false);
    if (this.sys.game.device.input.touch) {
      this.touch = new TouchControls(this, this.run.skillSlots.map((s) => (s ? `skill_${s}` : null)));
    }
    this.buildHud();
    this.bindKeys();

    const diff = DIFFICULTY_DEFS[run.difficulty];
    if (this.kind === 'boss' && diff.healOnBossFloor) run.hp = derivedOf(run).maxHp;
    run.hp = Math.min(run.hp, derivedOf(run).maxHp);

    this.banner();
    this.startFloor();
    this.events.off('resume');
    this.events.on('resume', () => this.onResume());
    this.checkpoint();
  }

  private resetFields(): void {
    this.enemies = [];
    this.pillars = [];
    this.drops = [];
    this.state = 'fight';
    this.boss = null;
    this.bossName = null;
    this.stairs = null;
    this.chest = null;
    this.altar = null;
    this.altarUsed = false;
    this.eventPanel = null;
    this.pausePanel = null;
    this.skillCds = {};
    this.attackCd = this.dodgeCd = this.dodgeT = this.invulnT = this.potionCd = 0;
    this.warCryT = this.ironSkinT = this.spinT = 0;
    this.spinSkill = null;
    this.leaping = false;
    this.toasts = [];
    this.skillIcons = [];
    this.skillKeys = [];
    this.touch = null;
    this.player.x = 480;
    this.player.y = 430;
  }

  private checkpoint(): void {
    this.run.rngState = this.rng.seed;
    session.checkpoint();
  }

  // ---------------------------------------------------------------- arena

  private buildArena(): void {
    const actIndex = this.myth.acts.indexOf(this.act);
    const cols = Math.ceil(960 / TILE);
    const rows = Math.ceil(540 / TILE);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = x * TILE;
        const py = y * TILE;
        const wall = py < BOUNDS.t - 16 || px < BOUNDS.l || px >= BOUNDS.r || py >= BOUNDS.b;
        const key = wall ? `wall_${this.myth.id}_${actIndex}` : `floor_${this.myth.id}_${actIndex}_${(x * 7 + y * 13) % 4}`;
        this.add.image(px, py, key).setOrigin(0, 0).setDepth(0);
      }
    }
    // A darker strip under the HUD keeps the top bar readable.
    this.add.rectangle(0, 0, 960, 52, COLOR.bg, 0.92).setOrigin(0, 0).setDepth(9000);

    if (this.kind === 'boss') return; // open arena for the charge
    const count = this.rng.int(2, 4);
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const x = this.rng.int(BOUNDS.l + 90, BOUNDS.r - 90);
        const y = this.rng.int(BOUNDS.t + 70, BOUNDS.b - 90);
        if (Math.hypot(x - 480, y - 430) < 120 || Math.hypot(x - 480, y - 160) < 90 || Math.hypot(x - 480, y - 270) < 80) continue;
        if (this.pillars.some((p) => Math.hypot(p.x - x, p.y - y) < 140)) continue;
        this.pillars.push({ x, y, r: 20 });
        this.add.image(x, y + 14, 'pillar').setOrigin(0.5, 1).setDepth(y + 14);
        break;
      }
    }
  }

  moveCircle(x: number, y: number, r: number, dx: number, dy: number): { x: number; y: number; hitWall: boolean } {
    let nx = x + dx;
    let ny = y + dy;
    let hitWall = false;
    if (nx < BOUNDS.l + r) {
      nx = BOUNDS.l + r;
      hitWall = true;
    }
    if (nx > BOUNDS.r - r) {
      nx = BOUNDS.r - r;
      hitWall = true;
    }
    if (ny < BOUNDS.t + r) {
      ny = BOUNDS.t + r;
      hitWall = true;
    }
    if (ny > BOUNDS.b - r) {
      ny = BOUNDS.b - r;
      hitWall = true;
    }
    for (const p of this.pillars) {
      const ddx = nx - p.x;
      const ddy = ny - p.y;
      const d = Math.hypot(ddx, ddy);
      const min = p.r + r;
      if (d < min && d > 0.001) {
        nx = p.x + (ddx / d) * min;
        ny = p.y + (ddy / d) * min;
        hitWall = true;
      }
    }
    return { x: nx, y: ny, hitWall };
  }

  // ---------------------------------------------------------------- floor flow

  private banner(): void {
    const { width } = this.scale;
    const kindLabel = { normal: '', elite: 'Elite floor', event: 'Shrine', boss: 'Guardian' }[this.kind];
    const title = text(this, width / 2, 220, `Floor ${this.run.floor}`, 36, COLOR.ink, true).setOrigin(0.5).setDepth(9600);
    const sub = text(this, width / 2, 262, kindLabel || this.act.name, 22, COLOR.accent).setOrigin(0.5).setDepth(9600);
    this.tweens.add({ targets: [title, sub], alpha: 0, delay: 1100, duration: 600, onComplete: () => { title.destroy(); sub.destroy(); } });
  }

  private startFloor(): void {
    switch (this.kind) {
      case 'normal':
      case 'elite':
        this.wavesLeft = 2 + Math.floor(this.run.floor / 4);
        this.time.delayedCall(900, () => this.spawnWave());
        break;
      case 'boss':
        this.wavesLeft = 0;
        this.time.delayedCall(1300, () => this.spawnBoss());
        break;
      case 'event':
        this.state = 'event';
        this.buildAltar();
        break;
    }
  }

  private monsterPool(): MonsterDef[] {
    const ids = this.act.monsters.filter((_id, i) => i === 0 || this.run.floor >= i + 1);
    return ids.map((id) => monsterById(id)).filter((m): m is MonsterDef => !!m && !m.boss);
  }

  private enemyMult(): number {
    return floorScale(this.run.floor) * DIFFICULTY_DEFS[this.run.difficulty].enemyMult;
  }

  private spawnWave(): void {
    if (this.state !== 'fight') return;
    this.wavesLeft -= 1;
    const pool = this.monsterPool();
    const count = 3 + Math.floor(this.run.floor * 0.7);
    const diff = DIFFICULTY_DEFS[this.run.difficulty];
    let elites = this.kind === 'elite' ? 1 + Math.floor(this.run.floor / 8) : 0;
    for (let i = 0; i < count; i++) {
      const def = this.rng.pick(pool);
      const elite = elites > 0 || (this.run.floor >= 3 && this.rng.chance(diff.eliteChance));
      if (elites > 0) elites -= 1;
      const pos = this.spawnPoint();
      this.spawnWithMarker(def, pos.x, pos.y, elite, 0.15 * i);
    }
  }

  private spawnPoint(): { x: number; y: number } {
    for (let i = 0; i < 30; i++) {
      const x = this.rng.int(BOUNDS.l + 30, BOUNDS.r - 30);
      const y = this.rng.int(BOUNDS.t + 30, BOUNDS.b - 30);
      if (Math.hypot(x - this.player.x, y - this.player.y) < 220) continue;
      if (this.pillars.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + 30)) continue;
      return { x, y };
    }
    return { x: BOUNDS.l + 60, y: BOUNDS.t + 60 };
  }

  private spawnWithMarker(def: MonsterDef, x: number, y: number, elite: boolean, delay: number): void {
    this.pendingSpawns += 1;
    const ring = this.add.circle(x, y, 18).setStrokeStyle(2, COLOR.danger, 0.8).setDepth(3).setAlpha(0);
    this.tweens.add({ targets: ring, alpha: 1, scale: 0.5, delay: delay * 1000, duration: 650, onComplete: () => {
      ring.destroy();
      this.pendingSpawns -= 1;
      if (this.state === 'dead' || this.state === 'leaving') return;
      this.addEnemy(def, x, y, elite);
    } });
  }

  private addEnemy(def: MonsterDef, x: number, y: number, elite: boolean): Enemy {
    const e = new Enemy(this, def, x, y, this.enemyMult(), elite);
    this.enemies.push(e);
    if (!session.save.meta.codex.includes(def.id)) {
      session.addToCodex(def.id);
      this.toast(`Codex: ${def.name}`, COLOR.accent);
    }
    return e;
  }

  private spawnBoss(): void {
    const id = this.myth.bosses[this.run.floor];
    const def = id ? monsterById(id) : undefined;
    if (!def) return;
    this.boss = this.addEnemy(def, 480, 200, false);
    this.bossName = text(this, 480, 60, def.name, 18, COLOR.ink, true).setOrigin(0.5, 0).setDepth(9100);
    this.shake(0.008, 300);
  }

  spawnMinions(id: string, count: number, x: number, y: number): void {
    const def = monsterById(id);
    if (!def) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const pos = this.moveCircle(x, y, def.radius, Math.cos(a) * 80, Math.sin(a) * 80);
      this.spawnWithMarker(def, pos.x, pos.y, false, 0.1 * i);
    }
  }

  private checkCleared(): void {
    if (this.state !== 'fight' || this.pendingSpawns > 0) return;
    if (this.enemies.some((e) => !e.dead)) return;
    if (this.kind === 'boss' && !this.boss) return;
    if (this.wavesLeft > 0) {
      this.time.delayedCall(600, () => this.spawnWave());
      this.pendingSpawns += 1;
      this.time.delayedCall(600, () => { this.pendingSpawns -= 1; });
      return;
    }
    this.floorCleared();
  }

  private floorCleared(): void {
    this.state = 'cleared';
    this.toast('Floor cleared', COLOR.good);
    if (this.kind !== 'boss') {
      this.chest = this.add.image(480, 280, 'chest').setDepth(280);
    }
    this.showStairs();
  }

  private showStairs(): void {
    this.stairs = this.add.image(480, 150, 'stairs').setDepth(1).setAlpha(0);
    this.tweens.add({ targets: this.stairs, alpha: 1, duration: 400 });
  }

  // ---------------------------------------------------------------- event floor

  private buildAltar(): void {
    const c = this.add.container(480, 270).setDepth(270);
    const base = this.add.rectangle(0, 0, 60, 36, 0x8c7c62).setStrokeStyle(3, 0x241c16);
    const top = this.add.rectangle(0, -22, 72, 12, 0xb8ad97).setStrokeStyle(3, 0x241c16);
    const flame = this.add.rectangle(0, -36, 10, 14, 0xe2582c);
    this.tweens.add({ targets: flame, scaleY: 1.4, yoyo: true, repeat: -1, duration: 300 });
    c.add([base, top, flame]);
    this.altar = c;
    this.toast('A shrine. Walk up to it.', COLOR.inkDim);
  }

  private openEvent(): void {
    if (this.eventPanel || this.altarUsed) return;
    const run = this.run;
    const c = this.add.container(0, 0).setDepth(9800);
    c.add(this.add.rectangle(0, 0, 960, 540, 0x000000, 0.55).setOrigin(0, 0).setInteractive());
    c.add(panel(this, 180, 110, 600, 330));
    c.add(text(this, 480, 130, 'SHRINE OF THE CROSSROADS', 22, COLOR.ink, true).setOrigin(0.5, 0));
    c.add(text(this, 480, 162, 'Choose one blessing. The others fade.', 20, COLOR.inkDim).setOrigin(0.5, 0));

    const maxHp = derivedOf(run).maxHp;
    const weapon = run.equipped.weapon;
    const gold = weapon ? forgeCost(weapon) : 0;
    const canForge = !!weapon && run.gold >= gold && totalMaterials(run) >= FORGE_MATERIAL_COST && weapon.upgrades < 5;
    const forgeLine = weapon
      ? `${itemName(weapon)} gets +1 for ${gold} gold and ${FORGE_MATERIAL_COST} materials. You have ${run.gold} gold, ${totalMaterials(run)} materials.`
      : 'No weapon to upgrade.';
    const options: { label: string; detail: string; enabled: boolean; act: () => void }[] = [
      {
        label: 'Spring of Asclepius',
        detail: `Heal to full (${Math.ceil(run.hp)} to ${maxHp} HP).`,
        enabled: true,
        act: () => {
          run.hp = maxHp;
          this.toast('Healed to full', COLOR.good);
        },
      },
      {
        label: 'Forge of Hephaestus',
        detail: forgeLine,
        enabled: canForge,
        act: () => {
          if (forgeUpgrade(run, 'weapon')) {
            this.toast(`Forged: ${weapon ? itemName(weapon) : ''}`, COLOR.accent);
            this.view.refresh(run);
          }
        },
      },
      {
        label: 'Altar of Ares',
        detail: 'Give 25% of your current HP. Receive a strong piece of gear.',
        enabled: run.hp > 10,
        act: () => {
          run.hp = Math.max(1, run.hp * 0.75);
          const item = rollItem(run, this.rng, run.floor + 2, 3);
          this.spawnDrop({ kind: 'item', item }, 480, 330);
        },
      },
    ];
    options.forEach((o, i) => {
      const y = 200 + i * 76;
      c.add(new Button(this, 210, y, o.label, () => {
        o.act();
        this.altarUsed = true;
        c.destroy();
        this.eventPanel = null;
        this.state = 'cleared';
        this.showStairs();
      }, { width: 220, disabled: !o.enabled, size: 20 }));
      c.add(text(this, 444, y + 2, o.detail, 18, o.enabled ? COLOR.ink : COLOR.inkDim).setWordWrapWidth(320));
    });
    c.add(new Button(this, 680, 400, 'Later', () => {
      c.destroy();
      this.eventPanel = null;
    }, { width: 80, height: 30, size: 18 }));
    this.eventPanel = c;
  }

  // ---------------------------------------------------------------- input

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) {
      this.keys = {};
      return;
    }
    this.keys = kb.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
      attack: 'J', dodge: 'SPACE', dodge2: 'SHIFT',
      s1: 'ONE', s2: 'TWO', s3: 'THREE', s4: 'FOUR',
      potion: 'Q', bag: 'I', bag2: 'TAB', use: 'E', esc: 'ESC',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture(['TAB', 'SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
  }

  private down(...names: string[]): boolean {
    return names.some((n) => this.keys[n]?.isDown);
  }

  private pressed(...names: string[]): boolean {
    return names.some((n) => {
      const k = this.keys[n];
      return k ? Phaser.Input.Keyboard.JustDown(k) : false;
    });
  }

  private openBag(): void {
    if (this.state === 'dead' || this.state === 'leaving') return;
    this.scene.pause();
    this.scene.launch('inventory');
  }

  private onResume(): void {
    this.view.refresh(this.run);
    this.refreshSkillBar();
    this.input.keyboard?.resetKeys();
  }

  private togglePause(): void {
    if (this.pausePanel) {
      this.pausePanel.destroy();
      this.pausePanel = null;
      this.physicsPaused = false;
      return;
    }
    const c = this.add.container(0, 0).setDepth(9900);
    c.add(this.add.rectangle(0, 0, 960, 540, 0x000000, 0.6).setOrigin(0, 0).setInteractive());
    c.add(panel(this, 330, 160, 300, 230));
    c.add(text(this, 480, 180, 'PAUSED', 26, COLOR.ink, true).setOrigin(0.5, 0));
    c.add(new Button(this, 370, 230, 'Resume', () => this.togglePause(), { width: 220, accent: true }));
    c.add(new Button(this, 370, 282, 'Save and quit', () => {
      this.checkpoint();
      this.scene.start('menu');
    }, { width: 220 }));
    c.add(new Button(this, 370, 334, 'Abandon climb', () => {
      this.pausePanel = null;
      this.die(true);
    }, { width: 220 }));
    this.pausePanel = c;
    this.physicsPaused = true;
  }

  private physicsPaused = false;

  // ---------------------------------------------------------------- update

  override update(_time: number, delta: number): void {
    if (!this.run) return;
    const dt = Math.min(delta / 1000, 0.05);
    if (this.pressed('esc') && this.state !== 'dead') this.togglePause();
    if (this.physicsPaused || this.eventPanel) {
      this.drawHud();
      return;
    }
    if (this.state === 'dead' || this.state === 'leaving') return;

    if (this.pressed('bag', 'bag2') || this.touch?.consume('bag')) {
      this.openBag();
      return;
    }

    this.tickTimers(dt);
    this.handleMovement(dt);
    this.updateAim();
    this.handleCombatInput(dt);
    this.updateEnemies(dt);
    this.updateDrops(dt);
    this.updateInteractables();
    this.checkCleared();
    this.drawTelegraphs();
    this.view.setPosition(this.player.x, this.player.y - 18).setDepth(this.player.y + 2);
    this.view.setAlpha(this.invulnT > 0 && Math.floor(this.time.now / 60) % 2 === 0 ? 0.55 : 1);
    this.drawHud();
  }

  private tickTimers(dt: number): void {
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.warCryT = Math.max(0, this.warCryT - dt);
    this.ironSkinT = Math.max(0, this.ironSkinT - dt);
    for (const k of Object.keys(this.skillCds)) this.skillCds[k] = Math.max(0, (this.skillCds[k] ?? 0) - dt);
    this.sinceCombat += dt;
    if (this.sinceCombat > 4) this.run.rage = Math.max(0, this.run.rage - 4 * dt);
    if (this.spinT > 0) {
      this.spinT -= dt;
      this.spinTick -= dt;
      if (this.spinTick <= 0 && this.spinSkill) {
        const shape = this.spinSkill.def.shape;
        if (shape.kind === 'spin') {
          this.spinTick = shape.duration / shape.ticks;
          this.hitCircle(this.player.x, this.player.y, shape.radius, this.skillRaw(this.spinSkill.def, this.spinSkill.level), this.spinSkill.def.element, 1);
          this.ring(this.player.x, this.player.y, shape.radius, ELEMENT_COLOR.wind);
        }
      }
    }
  }

  private handleMovement(dt: number): void {
    if (this.leaping) return;
    const d = derivedOf(this.run);
    const v = new Phaser.Math.Vector2(0, 0);
    if (this.down('left', 'left2')) v.x -= 1;
    if (this.down('right', 'right2')) v.x += 1;
    if (this.down('up', 'up2')) v.y -= 1;
    if (this.down('down', 'down2')) v.y += 1;
    if (this.touch && this.touch.move.lengthSq() > 0) v.copy(this.touch.move);
    if (v.lengthSq() > 1) v.normalize();
    if (v.lengthSq() > 0.01) this.moveDir.copy(v).normalize();

    if ((this.pressed('dodge', 'dodge2') || this.touch?.consume('dodge')) && this.dodgeCd <= 0) {
      this.dodgeT = 0.18;
      this.dodgeCd = d.dodgeCooldown;
      this.invulnT = Math.max(this.invulnT, 0.28);
      this.dodgeDir.copy(v.lengthSq() > 0.01 ? v.clone().normalize() : this.moveDir);
    }
    let speed = d.moveSpeed * (this.spinT > 0 ? 0.75 : 1);
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      v.copy(this.dodgeDir);
      speed = 560;
      this.trail();
    }
    const res = this.moveCircle(this.player.x, this.player.y, this.player.r, v.x * speed * dt, v.y * speed * dt);
    this.player.x = res.x;
    this.player.y = res.y;
  }

  private updateAim(): void {
    if (this.touch) {
      const target = this.nearestEnemy(280);
      if (target) this.aim.set(target.x - this.player.x, target.y - this.player.y).normalize();
      else if (this.moveDir.lengthSq() > 0) this.aim.copy(this.moveDir);
    } else {
      const p = this.input.activePointer;
      const dx = p.worldX - this.player.x;
      const dy = p.worldY - this.player.y;
      if (Math.hypot(dx, dy) > 4) this.aim.set(dx, dy).normalize();
    }
    if (Math.abs(this.aim.x) > 0.15) this.view.setFacing(this.aim.x >= 0 ? 1 : -1);
  }

  private nearestEnemy(range: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private handleCombatInput(_dt: number): void {
    if (this.leaping) return;
    const pointerAttack = !this.touch && this.input.activePointer.leftButtonDown() && !this.input.activePointer.wasTouch;
    if ((pointerAttack || this.down('attack') || this.touch?.isHeld('attack')) && this.attackCd <= 0 && this.spinT <= 0) {
      this.basicAttack();
    }
    const skillPress = [this.pressed('s1'), this.pressed('s2'), this.pressed('s3'), this.pressed('s4')];
    for (let i = 0; i < 4; i++) {
      if (skillPress[i] || this.touch?.consume(`skill${i}`)) this.useSkill(i);
    }
    if ((this.pressed('potion') || this.touch?.consume('potion')) && this.potionCd <= 0) this.drinkPotion();
  }

  // ---------------------------------------------------------------- player actions

  private damageBonus(): number {
    return this.warCryT > 0 ? 1.35 : 1;
  }

  private basicAttack(): void {
    const w = weaponOf(this.run);
    const d = derivedOf(this.run);
    const interval = 1 / (w.speed * d.attackSpeed);
    this.attackCd = interval;
    this.view.swing(interval * 1000 * 0.9);
    const raw = w.damage * d.physMult;
    const hits = this.hitArc(w.reach, 120, raw, w.element, w.element ? 0.3 : 0);
    this.slash(w.reach, 120, w.element ? ELEMENT_COLOR[w.element] : COLOR.ink);
    if (hits > 0) this.addRage(5);
  }

  private skillRaw(def: SkillDef, level: number): number {
    const w = weaponOf(this.run);
    const d = derivedOf(this.run);
    const elem = def.element ? d.elemMult : 1;
    return w.damage * d.physMult * skillPower(def, level) * elem;
  }

  private useSkill(index: number): void {
    const id = this.run.skillSlots[index];
    if (!id) return;
    const def = skillById(id);
    if (!def) return;
    const level = skillLevel(this.run, id);
    if ((this.skillCds[id] ?? 0) > 0) return;
    if (this.run.rage < def.rageCost) {
      this.floatText(this.player.x, this.player.y - 50, 'Not enough Rage', COLOR.inkDim);
      return;
    }
    this.run.rage -= def.rageCost;
    this.skillCds[id] = skillCooldown(def, level);
    const raw = this.skillRaw(def, level);
    const shape = def.shape;
    const color = def.element ? ELEMENT_COLOR[def.element] : COLOR.ink;
    switch (shape.kind) {
      case 'arc': {
        this.view.swing(220);
        const hits = this.hitArc(shape.radius, shape.angle, raw, def.element, 1);
        this.slash(shape.radius, shape.angle, color);
        if (hits) this.addRage(3);
        break;
      }
      case 'buff':
        if (shape.damageBonus) this.warCryT = shape.duration;
        if (shape.damageTaken) this.ironSkinT = shape.duration;
        this.ring(this.player.x, this.player.y, 40, shape.damageTaken ? 0xa7adb3 : COLOR.accent);
        this.toast(def.name, COLOR.accent);
        break;
      case 'leap': {
        this.leaping = true;
        this.invulnT = Math.max(this.invulnT, 0.35);
        const target = this.moveCircle(this.player.x, this.player.y, this.player.r, this.aim.x * shape.distance, this.aim.y * shape.distance);
        this.tweens.add({
          targets: this.player,
          x: target.x,
          y: target.y,
          duration: 260,
          ease: 'Sine.easeInOut',
          onUpdate: (tw) => {
            this.view.setScale(1 + Math.sin(tw.progress * Math.PI) * 0.25);
          },
          onComplete: () => {
            this.view.setScale(1);
            this.leaping = false;
            this.shake(0.006, 150);
            const hits = this.hitCircle(this.player.x, this.player.y, shape.radius, raw, def.element, 1);
            this.ring(this.player.x, this.player.y, shape.radius, color);
            if (hits) this.addRage(3);
          },
        });
        break;
      }
      case 'line': {
        const hits = this.hitLine(shape.length, shape.width, raw, def.element);
        for (let i = 1; i <= 8; i++) {
          const t = (i / 8) * shape.length;
          const rock = this.add.rectangle(this.player.x + this.aim.x * t, this.player.y + this.aim.y * t, 18, 18, color).setDepth(3).setAngle(this.rng.int(0, 90));
          this.tweens.add({ targets: rock, alpha: 0, scale: 0.4, delay: i * 25, duration: 380, onComplete: () => rock.destroy() });
        }
        this.shake(0.005, 120);
        if (hits) this.addRage(3);
        break;
      }
      case 'spin':
        this.spinT = shape.duration;
        this.spinTick = 0;
        this.spinSkill = { def, level };
        this.view.spin(shape.duration * 1000);
        break;
    }
  }

  private drinkPotion(): void {
    if (this.run.potions <= 0) {
      this.floatText(this.player.x, this.player.y - 50, 'No potions', COLOR.inkDim);
      return;
    }
    const max = derivedOf(this.run).maxHp;
    if (this.run.hp >= max) return;
    this.run.potions -= 1;
    this.potionCd = 1;
    const heal = Math.round(max * 0.35);
    this.run.hp = Math.min(max, this.run.hp + heal);
    this.floatText(this.player.x, this.player.y - 50, `+${heal}`, COLOR.good);
  }

  private addRage(n: number): void {
    this.run.rage = Math.min(100, this.run.rage + n);
    this.sinceCombat = 0;
  }

  // ---------------------------------------------------------------- hit tests

  private hitArc(radius: number, angleDeg: number, raw: number, element: Element | null, statusChance: number): number {
    const half = Phaser.Math.DegToRad(angleDeg / 2);
    const aimAng = Math.atan2(this.aim.y, this.aim.x);
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > radius + e.r) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - aimAng));
      if (dist > e.r + this.player.r && diff > half) continue;
      this.damageEnemy(e, raw, element, statusChance);
      hits += 1;
    }
    return hits;
  }

  private hitCircle(x: number, y: number, radius: number, raw: number, element: Element | null, statusChance: number): number {
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) > radius + e.r) continue;
      this.damageEnemy(e, raw, element, statusChance);
      hits += 1;
    }
    return hits;
  }

  private hitLine(length: number, width: number, raw: number, element: Element | null): number {
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const along = dx * this.aim.x + dy * this.aim.y;
      const perp = Math.abs(-dx * this.aim.y + dy * this.aim.x);
      if (along < -e.r || along > length + e.r || perp > width / 2 + e.r) continue;
      this.damageEnemy(e, raw, element, 1);
      hits += 1;
    }
    return hits;
  }

  private damageEnemy(e: Enemy, raw: number, element: Element | null, statusChance: number, chained = false): void {
    if (e.dead) return;
    const d = derivedOf(this.run);
    let bonus = this.damageBonus();
    if (element === 'lightning' && e.soakT > 0) bonus *= 1.5;
    if (e.isDazed) bonus *= 1.5;
    const hit = computeHit({
      raw,
      element,
      defenderElements: e.def.elements,
      defense: e.elite ? 6 : e.isBoss ? 10 : 0,
      critChance: d.critChance,
      roll: this.rng.next(),
      bonus,
    });
    e.hp -= hit.damage;
    e.flash();
    this.sinceCombat = 0;
    const color = hit.crit ? COLOR.accent : hit.effectiveness === 'strong' ? 0xf2d23c : hit.effectiveness === 'weak' ? COLOR.inkDim : COLOR.ink;
    this.floatText(e.x, e.y - e.r * 2.2, `${hit.damage}${hit.crit ? '!' : ''}`, color, hit.crit ? 22 : 18);
    if (element && this.rng.chance(statusChance)) this.applyStatus(e, element, hit.damage, chained);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private applyStatus(e: Enemy, element: Element, dealt: number, chained: boolean): void {
    switch (ELEMENT_STATUS[element]) {
      case 'burn':
        e.burnT = 3;
        e.burnDps = Math.max(e.burnDps, dealt * 0.25);
        break;
      case 'poison':
        e.addPoison(dealt * 0.12);
        break;
      case 'chill':
        e.chillT = 2;
        break;
      case 'stagger':
        e.stunT = Math.max(e.stunT, e.isBoss ? 0.15 : 0.5);
        break;
      case 'soak':
        e.soakT = 3;
        break;
      case 'blind':
        e.blindT = 3;
        break;
      case 'knockback': {
        if (e.isBoss) break;
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const len = Math.hypot(dx, dy) || 1;
        const res = this.moveCircle(e.x, e.y, e.r, (dx / len) * 40, (dy / len) * 40);
        e.x = res.x;
        e.y = res.y;
        break;
      }
      case 'shock':
        if (chained) break;
        this.enemies
          .filter((o) => o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 130)
          .slice(0, 2)
          .forEach((o) => {
            this.zap(e.x, e.y, o.x, o.y);
            this.damageEnemy(o, dealt * 0.5, 'lightning', 0.5, true);
          });
        break;
      case 'drain': {
        const max = derivedOf(this.run).maxHp;
        this.run.hp = Math.min(max, this.run.hp + dealt * 0.08);
        break;
      }
    }
  }

  private killEnemy(e: Enemy): void {
    e.destroy();
    this.run.kills += 1;
    const levels = gainXp(this.run, Math.round(e.def.xp * (e.elite ? 2.5 : 1)));
    if (levels > 0) {
      this.toast(`Level ${this.run.level}. Spend stat points in the Bag (I).`, COLOR.good);
      this.ring(this.player.x, this.player.y, 50, COLOR.good);
    }
    const drops = e.isBoss ? rollBossDrops(this.run, this.rng, e.def) : rollKillDrops(this.run, this.rng, e.def, e.elite);
    drops.forEach((drop, i) => {
      const a = (i / Math.max(1, drops.length)) * Math.PI * 2 + this.rng.next();
      const dist = drops.length > 1 ? 26 : 0;
      this.spawnDrop(drop, e.x + Math.cos(a) * dist, e.y + Math.sin(a) * dist);
    });
    if (e === this.boss) {
      this.bossName?.destroy();
      this.bossName = null;
      this.shake(0.015, 500);
      this.toast(`${e.def.name} falls`, COLOR.accent);
      // Clear any minions with the boss.
      for (const o of this.enemies) if (!o.dead) this.killEnemy(o);
      this.boss = null;
      this.floorCleared();
    }
  }

  // ---------------------------------------------------------------- enemies

  hurtPlayer(damage: number, source: Enemy, element: Element | null): void {
    if (this.invulnT > 0 || this.state === 'dead') return;
    if (source.blinded && this.rng.chance(0.35)) {
      this.floatText(this.player.x, this.player.y - 50, 'Miss', COLOR.inkDim);
      return;
    }
    const d = derivedOf(this.run);
    const taken = this.ironSkinT > 0 ? 0.5 : 1;
    void element;
    const dmg = Math.max(1, Math.round(damage * taken * mitigation(d.defense)));
    this.run.hp -= dmg;
    this.invulnT = 0.45;
    this.addRage(4);
    this.view.flash(0xffffff);
    this.shake(0.004, 100);
    this.floatText(this.player.x, this.player.y - 50, `-${dmg}`, COLOR.danger, 20);
    if (this.run.hp <= 0) {
      this.run.hp = 0;
      this.die(false);
    }
  }

  shake(intensity: number, ms: number): void {
    this.cameras.main.shake(ms, intensity);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(dt, this);
      const dot = e.tickStatuses(dt);
      if (dot > 0) {
        e.hp -= dot;
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
    // Keep enemies from stacking on one spot.
    const alive = this.enemies.filter((e) => !e.dead);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i]!;
        const b = alive[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (d < min && d > 0.01) {
          const push = (min - d) / 2;
          const ra = this.moveCircle(a.x, a.y, a.r, (-dx / d) * push, (-dy / d) * push);
          const rb = this.moveCircle(b.x, b.y, b.r, (dx / d) * push, (dy / d) * push);
          a.x = ra.x; a.y = ra.y; b.x = rb.x; b.y = rb.y;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private drawTelegraphs(): void {
    const g = this.telegraph;
    g.clear();
    for (const e of this.enemies) e.drawTelegraph(g);
  }

  // ---------------------------------------------------------------- drops

  private spawnDrop(drop: Drop, x: number, y: number): void {
    const key = { gold: 'drop_gold', potion: 'drop_potion', material: 'drop_material', item: 'drop_item', scroll: 'drop_scroll' }[drop.kind];
    const pos = this.moveCircle(x, y, 8, 0, 0);
    const sprite = this.add.image(pos.x, pos.y, key).setDepth(pos.y - 1);
    if (drop.kind === 'item') sprite.setTint(RARITY_COLOR[drop.item.rarity]);
    if (drop.kind === 'material') sprite.setTint(0xb8ad97);
    this.tweens.add({ targets: sprite, y: pos.y - 14, yoyo: true, duration: 180, ease: 'Quad.easeOut' });
    this.drops.push({ drop, sprite, x: pos.x, y: pos.y, ready: this.time.now + 350 });
  }

  private updateDrops(dt: number): void {
    const now = this.time.now;
    for (const d of this.drops) {
      if (now < d.ready) continue;
      const dx = this.player.x - d.x;
      const dy = this.player.y - d.y;
      const dist = Math.hypot(dx, dy);
      const magnet = d.drop.kind === 'gold' || d.drop.kind === 'material' || d.drop.kind === 'potion' ? 90 : 0;
      if (dist < magnet && dist > 1) {
        d.x += (dx / dist) * 320 * dt;
        d.y += (dy / dist) * 320 * dt;
        d.sprite.setPosition(d.x, d.y);
      }
      if (dist < this.player.r + 14) this.collect(d);
    }
    this.drops = this.drops.filter((d) => d.sprite.active);
  }

  private collect(d: DropObj): void {
    const run = this.run;
    const drop = d.drop;
    switch (drop.kind) {
      case 'gold':
        run.gold += drop.amount;
        this.floatText(d.x, d.y - 20, `+${drop.amount}g`, 0xe8b830, 16);
        break;
      case 'potion':
        run.potions = Math.min(9, run.potions + 1);
        this.toast('Potion', COLOR.good);
        break;
      case 'material':
        run.materials[drop.material] += 1;
        this.toast(MATERIAL_LABEL[drop.material], COLOR.inkDim);
        break;
      case 'item': {
        const sold = addToBag(run, drop.item);
        this.toast(sold ? `Bag full: sold ${itemName(drop.item)} for ${sold}g` : itemName(drop.item), RARITY_COLOR[drop.item.rarity]);
        break;
      }
      case 'scroll': {
        const def = skillById(drop.skillId);
        const res = learnSkill(run, drop.skillId);
        run.floorsSinceSkill = 0;
        const msg = res === 'learned' ? `New skill: ${def?.name}` : res === 'upgraded' ? `${def?.name} upgraded` : `${def?.name} is already at max level`;
        this.toast(msg, def ? RARITY_COLOR[def.rarity] : COLOR.ink);
        if (res === 'maxed') run.gold += 25;
        this.refreshSkillBar();
        break;
      }
    }
    d.sprite.destroy();
  }

  // ---------------------------------------------------------------- interactables

  private updateInteractables(): void {
    let promptText = '';
    let px = 0;
    let py = 0;
    if (this.chest && Math.hypot(this.player.x - this.chest.x, this.player.y - this.chest.y) < 34) {
      const drops = rollFloorChest(this.run, this.rng);
      const cx = this.chest.x;
      const cy = this.chest.y;
      this.chest.destroy();
      this.chest = null;
      drops.forEach((drop, i) => this.spawnDrop(drop, cx - 20 + i * 40, cy + 30));
    }
    if (this.altar && !this.altarUsed) {
      const d = Math.hypot(this.player.x - this.altar.x, this.player.y - this.altar.y);
      if (d < 70) {
        promptText = this.touch ? 'Tap the shrine' : 'Press E';
        px = this.altar.x;
        py = this.altar.y - 70;
        const tapped = this.touch && this.input.activePointer.isDown && Math.hypot(this.input.activePointer.x - this.altar.x, this.input.activePointer.y - this.altar.y) < 50;
        if (this.pressed('use') || tapped) this.openEvent();
      }
    }
    if (this.stairs && this.stairs.alpha > 0.9 && Math.hypot(this.player.x - this.stairs.x, this.player.y - this.stairs.y) < 26) {
      this.leaveFloor();
    } else if (this.stairs && !promptText && Math.hypot(this.player.x - this.stairs.x, this.player.y - this.stairs.y) < 90) {
      promptText = this.run.floor >= PROTOTYPE_LAST_FLOOR ? 'Leave the Labyrinth' : `Stairs to floor ${this.run.floor + 1}`;
      px = this.stairs.x;
      py = this.stairs.y - 44;
    }
    this.prompt.setVisible(!!promptText).setText(promptText).setPosition(px, py);
  }

  private leaveFloor(): void {
    if (this.state === 'leaving') return;
    this.state = 'leaving';
    const run = this.run;
    // Unopened drops on the floor are picked up on the way out, so nothing is lost by hurrying.
    for (const d of this.drops) if (d.sprite.active) this.collect(d);
    if (run.floor >= PROTOTYPE_LAST_FLOOR) {
      this.victory();
      return;
    }
    run.floor += 1;
    run.floorsSinceSkill += 1;
    this.cameras.main.fadeOut(300, 0x1c, 0x18, 0x14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.run.rngState = this.rng.seed;
      this.scene.restart();
    });
  }

  private victory(): void {
    const run = this.run;
    const meta = session.save.meta;
    const diff = DIFFICULTY_DEFS[run.difficulty];
    const souls = Math.round((60 + run.floor * 5) * diff.rewardMult);
    meta.souls += souls;
    meta.actClears[run.difficulty] += 1;
    meta.bestFloor = Math.max(meta.bestFloor, run.floor);
    session.setRun(null);
    this.cameras.main.fadeOut(500, 0x1c, 0x18, 0x14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('end', { victory: true, floor: run.floor, souls, kills: run.kills, level: run.level, difficulty: run.difficulty });
    });
  }

  private die(abandoned: boolean): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.pausePanel?.destroy();
    this.pausePanel = null;
    this.physicsPaused = false;
    const run = this.run;
    const meta = session.save.meta;
    const souls = Math.round(run.floor * 5 * DIFFICULTY_DEFS[run.difficulty].rewardMult);
    meta.souls += souls;
    meta.bestFloor = Math.max(meta.bestFloor, run.floor);
    session.setRun(null);
    this.view.flash(COLOR.danger);
    this.cameras.main.fadeOut(700, 0x1c, 0x18, 0x14);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('end', { victory: false, abandoned, floor: run.floor, souls, kills: run.kills, level: run.level, difficulty: run.difficulty });
    });
  }

  // ---------------------------------------------------------------- effects

  private slash(radius: number, angleDeg: number, color: number): void {
    const g = this.add.graphics().setDepth(this.player.y + 5);
    const a = Math.atan2(this.aim.y, this.aim.x);
    const half = Phaser.Math.DegToRad(angleDeg / 2);
    g.lineStyle(4, color, 0.85);
    g.beginPath();
    g.arc(this.player.x, this.player.y - 6, radius * 0.85, a - half, a + half, false);
    g.strokePath();
    g.lineStyle(2, color, 0.4);
    g.beginPath();
    g.arc(this.player.x, this.player.y - 6, radius * 0.6, a - half * 0.8, a + half * 0.8, false);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  private ring(x: number, y: number, r: number, color: number): void {
    const c = this.add.circle(x, y, r).setStrokeStyle(3, color, 0.9).setDepth(4);
    c.setScale(0.4);
    this.tweens.add({ targets: c, scale: 1, alpha: 0, duration: 280, onComplete: () => c.destroy() });
  }

  private zap(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.add.graphics().setDepth(9000);
    g.lineStyle(2, ELEMENT_COLOR.lightning, 1).lineBetween(x1, y1 - 10, x2, y2 - 10);
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  private trail(): void {
    const ghost = this.add.circle(this.player.x, this.player.y - 18, 12, COLOR.ink, 0.25).setDepth(this.player.y);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 180, onComplete: () => ghost.destroy() });
  }

  private floatText(x: number, y: number, value: string, color: number, size = 18): void {
    const t = text(this, x, y, value, size, color).setOrigin(0.5).setDepth(9400);
    t.setStroke('#1c1814', 4);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  private toast(message: string, color: number): void {
    const t = text(this, 940, 0, message, 20, color).setOrigin(1, 0).setDepth(9500);
    t.setStroke('#1c1814', 4);
    this.toasts.unshift(t);
    this.toasts = this.toasts.slice(0, 5);
    this.toasts.forEach((o, i) => o.setY(64 + i * 22));
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2200,
      duration: 500,
      onComplete: () => {
        this.toasts = this.toasts.filter((o) => o !== t);
        t.destroy();
      },
    });
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    this.hud = this.add.graphics().setDepth(9100);
    this.hpText = text(this, 24, 10, '', 18, COLOR.ink).setDepth(9200);
    this.levelText = text(this, 24, 34, '', 16, COLOR.inkDim).setDepth(9200);
    this.infoText = text(this, 940, 8, '', 20, COLOR.ink).setOrigin(1, 0).setDepth(9200);
    text(this, 480, 8, `${this.myth.name}  ${this.act.name}  Floor ${this.run.floor}/${PROTOTYPE_LAST_FLOOR}`, 20, COLOR.ink)
      .setOrigin(0.5, 0)
      .setDepth(9200);
    this.refreshSkillBar();
  }

  private refreshSkillBar(): void {
    for (const i of this.skillIcons) i.destroy();
    for (const k of this.skillKeys) k.destroy();
    this.skillIcons = [];
    this.skillKeys = [];
    if (this.touch) {
      this.touch.setIcons(this.run.skillSlots.map((s) => (s ? `skill_${s}` : null)));
      return;
    }
    this.run.skillSlots.forEach((id, i) => {
      const x = 480 - 102 + i * 68;
      const y = 514;
      if (id) this.skillIcons.push(this.add.image(x, y, `skill_${id}`).setDepth(9201));
      this.skillKeys.push(text(this, x - 26, y - 26, `${i + 1}`, 16, COLOR.inkDim).setDepth(9202));
    });
  }

  private drawHud(): void {
    const run = this.run;
    const d = derivedOf(run);
    const g = this.hud;
    g.clear();
    // HP
    g.fillStyle(0x000000, 0.5).fillRect(120, 12, 200, 14);
    g.fillStyle(COLOR.hp, 1).fillRect(120, 12, 200 * Math.max(0, run.hp / d.maxHp), 14);
    g.lineStyle(2, COLOR.line).strokeRect(120, 12, 200, 14);
    // Rage
    g.fillStyle(0x000000, 0.5).fillRect(120, 30, 200, 6);
    g.fillStyle(COLOR.rage, 1).fillRect(120, 30, 2 * run.rage, 6);
    // XP
    g.fillStyle(0x000000, 0.5).fillRect(120, 40, 200, 4);
    g.fillStyle(COLOR.xp, 1).fillRect(120, 40, 200 * (run.xp / xpForLevel(run.level)), 4);
    this.hpText.setText(`HP ${Math.ceil(run.hp)}/${d.maxHp}`);
    this.levelText.setText(`Lv ${run.level}${run.freePoints ? `  +${run.freePoints} pts` : ''}`);
    this.infoText.setText(`${run.gold}g   Potions ${run.potions}${this.touch ? '' : '   Bag I'}`);

    // Boss bar
    if (this.boss && !this.boss.dead) {
      g.fillStyle(0x000000, 0.6).fillRect(280, 82, 400, 10);
      g.fillStyle(COLOR.hp, 1).fillRect(280, 82, 400 * (this.boss.hp / this.boss.maxHp), 10);
      g.lineStyle(2, COLOR.line).strokeRect(280, 82, 400, 10);
    }

    // Buff indicators
    let bx = 330;
    if (this.warCryT > 0) {
      g.fillStyle(COLOR.accent, 1).fillRect(bx, 12, 10, 10);
      bx += 14;
    }
    if (this.ironSkinT > 0) g.fillStyle(0xa7adb3, 1).fillRect(bx, 12, 10, 10);

    const fracs: Record<string, number> = {};
    run.skillSlots.forEach((id, i) => {
      if (!id) return;
      const def = skillById(id);
      if (!def) return;
      const cd = this.skillCds[id] ?? 0;
      const total = skillCooldown(def, skillLevel(run, id));
      fracs[`skill${i}`] = cd > 0 ? cd / total : run.rage < def.rageCost ? 1 : 0;
    });
    fracs.dodge = this.dodgeCd > 0 ? this.dodgeCd / d.dodgeCooldown : 0;
    fracs.potion = run.potions > 0 ? 0 : 1;

    if (this.touch) {
      this.touch.drawCooldowns(fracs);
      return;
    }
    // Desktop skill bar
    run.skillSlots.forEach((id, i) => {
      const x = 480 - 102 + i * 68;
      const y = 514;
      g.fillStyle(COLOR.panel, 0.9).fillRect(x - 24, y - 24, 48, 48);
      g.lineStyle(2, id ? COLOR.inkDim : COLOR.line).strokeRect(x - 24, y - 24, 48, 48);
      const f = fracs[`skill${i}`] ?? 0;
      if (f > 0) g.fillStyle(0x000000, 0.6).fillRect(x - 24, y - 24 + 48 * (1 - f), 48, 48 * f);
    });
  }
}
