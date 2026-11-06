import Phaser from 'phaser';
import '@fontsource/silkscreen/400.css';
import '@fontsource/vt323/400.css';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { InventoryScene } from './scenes/InventoryScene';
import { EndScene } from './scenes/EndScene';
import { COLOR } from './ui/theme';

async function start(): Promise<void> {
  // Canvas text can't use a web font until it has loaded.
  try {
    await Promise.all([document.fonts.load('20px Silkscreen'), document.fonts.load('20px VT323')]);
  } catch {
    // Fall back to monospace if fonts fail.
  }
  document.getElementById('loading')?.remove();

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: 960,
    height: 540,
    backgroundColor: COLOR.bg,
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { activePointers: 4 },
    disableContextMenu: true,
    banner: false,
    scene: [BootScene, MenuScene, GameScene, InventoryScene, EndScene],
  });
}

void start();
