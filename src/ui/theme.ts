import Phaser from 'phaser';

/** Palette: stone background, parchment ink, one bronze accent. */
export const COLOR = {
  bg: 0x1c1814,
  panel: 0x26201a,
  panelLight: 0x2f281f,
  line: 0x5a4a36,
  ink: 0xe8dcc0,
  inkDim: 0x9c8f78,
  accent: 0xc8692b,
  danger: 0xc0392b,
  hp: 0xb8402e,
  rage: 0xd08a2a,
  xp: 0x8fb06a,
  good: 0x8fb06a,
};

export const HEX = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export const FONT_HEAD = 'Silkscreen, monospace';
export const FONT_BODY = 'VT323, monospace';

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size = 20,
  color: number = COLOR.ink,
  head = false,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, {
    fontFamily: head ? FONT_HEAD : FONT_BODY,
    fontSize: `${size}px`,
    color: HEX(color),
  });
}

export interface ButtonOptions {
  width: number;
  height?: number;
  size?: number;
  disabled?: boolean;
  accent?: boolean;
}

/** Flat button: a bordered box. Hover changes only the border and text color. */
export class Button extends Phaser.GameObjects.Container {
  private box: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private disabled: boolean;
  private accent: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, caption: string, onClick: () => void, opts: ButtonOptions) {
    super(scene, x, y);
    const h = opts.height ?? 40;
    this.disabled = !!opts.disabled;
    this.accent = !!opts.accent;
    this.box = scene.add.rectangle(0, 0, opts.width, h, this.accent ? 0x3a2416 : COLOR.panel).setOrigin(0, 0);
    this.box.setStrokeStyle(2, this.disabled ? COLOR.line : this.accent ? COLOR.accent : COLOR.inkDim);
    this.label = text(scene, opts.width / 2, h / 2, caption, opts.size ?? 22, this.disabled ? COLOR.inkDim : COLOR.ink).setOrigin(0.5);
    this.add([this.box, this.label]);
    this.setSize(opts.width, h);
    if (!this.disabled) {
      this.box.setInteractive({ useHandCursor: true });
      this.box.on('pointerover', () => {
        this.box.setStrokeStyle(2, COLOR.accent);
        this.label.setColor(HEX(COLOR.accent));
      });
      this.box.on('pointerout', () => {
        this.box.setStrokeStyle(2, this.accent ? COLOR.accent : COLOR.inkDim);
        this.label.setColor(HEX(COLOR.ink));
      });
      this.box.on('pointerup', () => onClick());
    }
    scene.add.existing(this);
  }

  setCaption(value: string): this {
    this.label.setText(value);
    return this;
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(x, y, w, h, COLOR.panel).setOrigin(0, 0).setStrokeStyle(2, COLOR.line);
}
