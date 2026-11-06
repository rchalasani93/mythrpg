import Phaser from 'phaser';
import { CLASSES, classById } from '../data/classes';
import { DIFFICULTIES, DIFFICULTY_DEFS, UNLOCKED_BY, type Difficulty } from '../data/difficulty';
import { MYTHS, PROTOTYPE_LAST_FLOOR } from '../data/myths';
import { randomSeed } from '../systems/rng';
import { newRun } from '../systems/run';
import { isDifficultyUnlocked } from '../systems/save';
import { session } from '../systems/session';
import { Button, COLOR, panel, text } from '../ui/theme';

export class MenuScene extends Phaser.Scene {
  private classId = 'warrior';
  private difficulty: Difficulty = 'medium';

  constructor() {
    super('menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLOR.bg);
    this.showTitle();
  }

  private clear(): void {
    this.children.removeAll(true);
  }

  private showTitle(): void {
    this.clear();
    const { width } = this.scale;
    text(this, width / 2, 70, 'TOWER OF AGES', 44, COLOR.ink, true).setOrigin(0.5);
    text(this, width / 2, 116, `Prototype: Greek myth, Act I, floors 1 to ${PROTOTYPE_LAST_FLOOR}`, 22, COLOR.inkDim).setOrigin(0.5);

    // The character, as a real preview of what you play.
    this.add.image(width / 2, 210, 'body_warrior');
    this.add.image(width / 2, 210, 'gear_robe').setTint(0xd9cfb4);
    this.add.image(width / 2, 210, 'gear_sandals').setTint(0x9b6a3a);
    this.add.image(width / 2 + 14, 222, 'gear_sword').setOrigin(0.5, 0.8).setAngle(20).setTint(0xc58b3a);

    let y = 290;
    const run = session.run;
    if (run) {
      const cls = classById(run.classId)?.name ?? run.classId;
      new Button(this, width / 2 - 150, y, `Continue: ${cls}, floor ${run.floor}, ${DIFFICULTY_DEFS[run.difficulty].name}`, () => {
        this.scene.start('game');
      }, { width: 300, accent: true, size: 20 });
      y += 52;
    }
    new Button(this, width / 2 - 150, y, run ? 'Start a new climb' : 'Start climbing', () => this.showSetup(), {
      width: 300,
      accent: !run,
    });

    const meta = session.save.meta;
    text(this, width / 2, 470, `Souls ${meta.souls}   Best floor ${meta.bestFloor}   Codex ${meta.codex.length} entries`, 20, COLOR.inkDim).setOrigin(0.5);
    text(
      this,
      width / 2,
      500,
      'Move WASD   Aim mouse   Attack click or J   Dodge Space   Skills 1 to 4   Potion Q   Bag I',
      18,
      COLOR.inkDim,
    ).setOrigin(0.5);
  }

  private showSetup(): void {
    this.clear();
    const { width } = this.scale;
    text(this, 40, 28, 'NEW CLIMB', 28, COLOR.ink, true);

    // Classes: one row each, so the summary has room to read.
    text(this, 40, 80, 'Class', 22, COLOR.accent);
    CLASSES.filter((c) => c.starter).forEach((c, i) => {
      const y = 108 + i * 50;
      const selected = c.id === this.classId;
      const box = panel(this, 40, y, 520, 44).setStrokeStyle(2, selected ? COLOR.accent : COLOR.line);
      this.add.image(66, y + 22, `body_${c.id}`).setScale(0.6);
      text(this, 92, y + 4, c.name, 22, c.playable ? COLOR.ink : COLOR.inkDim);
      text(this, 92, y + 22, c.playable ? c.summary : 'Designed, not in this prototype yet.', 18, COLOR.inkDim);
      if (c.playable) {
        box.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.classId = c.id;
          this.showSetup();
        });
      }
    });

    text(this, 600, 80, 'Difficulty', 22, COLOR.accent);
    DIFFICULTIES.forEach((d, i) => {
      const def = DIFFICULTY_DEFS[d];
      const unlocked = isDifficultyUnlocked(session.save.meta, d);
      const y = 108 + i * 50;
      const selected = d === this.difficulty;
      const box = panel(this, 600, y, 320, 44).setStrokeStyle(2, selected ? COLOR.accent : COLOR.line);
      text(this, 612, y + 4, def.name, 22, unlocked ? COLOR.ink : COLOR.inkDim);
      const below = UNLOCKED_BY[d];
      text(this, 612, y + 22, unlocked ? def.summary : `Clear Act I on ${below ? DIFFICULTY_DEFS[below].name : ''} to unlock.`, 16, COLOR.inkDim);
      if (unlocked) {
        box.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          this.difficulty = d;
          this.showSetup();
        });
      }
    });

    const others = MYTHS.filter((m) => !m.playable).map((m) => m.name).join(', ');
    text(this, 40, 330, 'Myth', 22, COLOR.accent);
    text(this, 40, 356, `Each climb rolls a myth. This prototype always rolls Greek. Still to come: ${others}.`, 18, COLOR.inkDim);

    new Button(this, 40, 440, 'Back', () => this.showTitle(), { width: 140 });
    new Button(this, width - 260, 440, 'Enter the Tower', () => this.start(), { width: 220, accent: true });
  }

  private start(): void {
    const run = newRun(this.classId, 'greek', this.difficulty, randomSeed());
    session.setRun(run);
    this.scene.start('game');
  }
}
