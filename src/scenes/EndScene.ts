import Phaser from 'phaser';
import { DIFFICULTY_DEFS, type Difficulty } from '../data/difficulty';
import { Button, COLOR, text } from '../ui/theme';

interface EndData {
  victory: boolean;
  abandoned?: boolean;
  floor: number;
  souls: number;
  kills: number;
  level: number;
  difficulty: Difficulty;
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super('end');
  }

  create(data: EndData): void {
    this.cameras.main.setBackgroundColor(COLOR.bg);
    const cx = this.scale.width / 2;
    const title = data.victory ? 'THE LABYRINTH IS OPEN' : data.abandoned ? 'YOU LEFT THE TOWER' : 'THE TOWER CASTS YOU OUT';
    text(this, cx, 120, title, 34, data.victory ? COLOR.accent : COLOR.ink, true).setOrigin(0.5);
    const line = data.victory
      ? 'Asterion is down and Act I is clear. The rest of the Greek climb is not built yet.'
      : 'You wake at the foot of the Tower, alive and weaker. Souls carry over.';
    text(this, cx, 172, line, 22, COLOR.inkDim).setOrigin(0.5);
    const stats = [
      `Difficulty   ${DIFFICULTY_DEFS[data.difficulty].name}`,
      `Reached floor   ${data.floor}`,
      `Level   ${data.level}`,
      `Monsters defeated   ${data.kills}`,
      `Souls earned   ${data.souls}`,
    ];
    stats.forEach((s, i) => text(this, cx, 230 + i * 30, s, 24, COLOR.ink).setOrigin(0.5));
    new Button(this, cx - 120, 420, 'Back to the camp', () => this.scene.start('menu'), { width: 240, accent: true });
  }
}
