import { PixelGrid } from './pixel';
import type { LayerShape } from '../data/items';

/** Character grid: every body and gear layer is 16x20 so they stack exactly. */
export const CHAR_W = 16;
export const CHAR_H = 20;
export const PIXEL_SCALE = 3;

const OUTLINE = '#241c16';
// Gear layers are drawn in grays and tinted per item material.
const G = '#cfcfcf';
const K = '#ffffff';
const D = '#8c8c8c';
const GO = '#5a5a5a';

export function bodySprite(tunic: string, tunicDark: string): PixelGrid {
  const S = '#d6a67c';
  const SD = '#b9855e';
  const H = '#3b2618';
  const g = new PixelGrid(CHAR_W, CHAR_H);
  // hair
  g.hl(6, 2, 4, H).hl(5, 3, 6, H);
  // face
  g.rect(5, 4, 6, 3, S).hl(6, 7, 4, SD);
  g.px(5, 4, H).px(10, 4, H);
  g.px(6, 5, '#1a1410').px(9, 5, '#1a1410');
  // torso (tunic)
  g.rect(4, 8, 8, 6, tunic).vl(4, 9, 4, tunicDark).vl(11, 9, 4, tunicDark);
  g.hl(4, 13, 8, '#4a3020');
  // arms and hands
  g.vl(3, 9, 4, S).vl(12, 9, 4, S).px(3, 13, SD).px(12, 13, SD);
  // legs and feet
  g.rect(5, 14, 2, 4, S).rect(9, 14, 2, 4, S).vl(6, 14, 4, SD).vl(10, 14, 4, SD);
  g.rect(5, 18, 2, 2, '#4a3020').rect(9, 18, 2, 2, '#4a3020');
  return g.outline(OUTLINE);
}

export function gearSprite(shape: LayerShape): PixelGrid {
  const g = new PixelGrid(CHAR_W, CHAR_H);
  switch (shape) {
    case 'cap':
      g.hl(6, 1, 4, G).hl(5, 2, 6, K).hl(5, 3, 6, G).px(5, 4, D).px(10, 4, D);
      break;
    case 'helm':
      g.hl(6, 0, 4, '#b8b8b8').hl(5, 1, 6, G).rect(4, 2, 8, 2, G).hl(5, 2, 6, K);
      g.rect(4, 4, 2, 3, G).rect(10, 4, 2, 3, G).vl(4, 4, 3, D).vl(11, 4, 3, D);
      g.vl(7, 4, 2, D).vl(8, 4, 1, D);
      break;
    case 'robe':
      g.rect(4, 8, 8, 6, G).hl(4, 8, 8, K).px(3, 8, G).px(12, 8, G);
      g.vl(6, 9, 5, D).vl(9, 9, 5, D);
      g.rect(4, 14, 8, 2, G).px(5, 15, D).px(7, 15, D).px(9, 15, D);
      break;
    case 'cuirass':
      g.rect(3, 8, 10, 2, G).hl(3, 8, 10, K).rect(4, 10, 8, 3, G);
      g.px(7, 10, D).px(8, 10, D).hl(6, 12, 4, D).px(5, 11, K).px(10, 11, K);
      g.rect(4, 13, 8, 3, G).vl(5, 13, 3, D).vl(7, 13, 3, D).vl(9, 13, 3, D);
      break;
    case 'gloves':
      g.rect(3, 11, 1, 3, G).rect(12, 11, 1, 3, G).px(3, 11, K).px(12, 11, K);
      break;
    case 'trousers':
      g.hl(5, 14, 6, G).rect(5, 15, 2, 3, G).rect(9, 15, 2, 3, G).vl(6, 15, 3, D).vl(10, 15, 3, D);
      break;
    case 'greaves':
      g.rect(5, 15, 2, 3, G).rect(9, 15, 2, 3, G).vl(5, 15, 3, K).vl(9, 15, 3, K);
      break;
    case 'sandals':
      g.vl(6, 16, 2, D).vl(10, 16, 2, D).hl(5, 18, 2, D).hl(9, 18, 2, D);
      g.hl(5, 19, 2, G).hl(9, 19, 2, G);
      break;
    case 'boots':
      g.rect(4, 17, 3, 3, G).rect(9, 17, 3, 3, G).hl(4, 17, 3, K).hl(9, 17, 3, K);
      break;
    default:
      break;
  }
  return g.outline(GO);
}

export function weaponSprite(shape: 'sword' | 'axe'): PixelGrid {
  if (shape === 'sword') {
    const g = new PixelGrid(5, 15);
    g.vl(2, 0, 10, K).vl(1, 1, 9, G).vl(3, 1, 9, D);
    g.hl(0, 10, 5, D).vl(2, 11, 3, '#5a3a20').px(2, 14, D);
    return g.outline(GO);
  }
  const g = new PixelGrid(11, 16);
  g.vl(5, 1, 15, '#6b4a2a');
  g.rect(1, 1, 4, 5, G).rect(6, 1, 4, 5, G).vl(1, 1, 5, K).vl(9, 1, 5, K);
  g.px(0, 2, K).px(0, 3, K).px(0, 4, K).px(10, 2, K).px(10, 3, K).px(10, 4, K);
  g.vl(4, 1, 5, D).vl(6, 1, 5, D);
  return g.outline(GO);
}

export function shieldSprite(): PixelGrid {
  const g = new PixelGrid(9, 10);
  g.rect(2, 0, 5, 10, G).rect(1, 1, 7, 8, G).rect(0, 2, 9, 6, G);
  g.rect(3, 3, 3, 4, K).rect(4, 4, 1, 2, D);
  g.hl(2, 0, 5, D).hl(2, 9, 5, D);
  return g.outline(GO);
}

// ---------- monsters ----------

export function satyrSprite(): PixelGrid {
  const skin = '#c9a27a';
  const fur = '#6b4a2e';
  const horn = '#e6dcc4';
  const g = new PixelGrid(14, 17);
  g.px(3, 0, horn).px(10, 0, horn).px(3, 1, horn).px(4, 1, horn).px(9, 1, horn).px(10, 1, horn);
  g.rect(4, 2, 6, 4, skin).px(5, 3, '#c33').px(8, 3, '#c33');
  g.px(3, 2, fur).px(10, 2, fur);
  g.rect(5, 5, 4, 2, '#5a3a22');
  g.rect(4, 7, 6, 4, skin).vl(3, 8, 3, skin).vl(10, 8, 3, skin);
  g.rect(4, 11, 6, 2, fur);
  g.rect(4, 13, 2, 2, fur).rect(8, 13, 2, 2, fur).px(5, 15, fur).px(8, 15, fur);
  g.px(4, 16, '#221').px(5, 16, '#221').px(8, 16, '#221').px(9, 16, '#221');
  return g.outline(OUTLINE);
}

export function harpySprite(): PixelGrid {
  const wing = '#8c7a5c';
  const tip = '#5e4f3a';
  const skin = '#d8b48c';
  const g = new PixelGrid(20, 14);
  for (let i = 0; i < 7; i++) {
    g.vl(i, 3 + Math.floor(i / 2), 6 - Math.floor(i / 2), i < 2 ? tip : wing);
    g.vl(19 - i, 3 + Math.floor(i / 2), 6 - Math.floor(i / 2), i < 2 ? tip : wing);
  }
  g.rect(8, 1, 4, 4, skin).hl(8, 1, 4, '#3a2a20').px(8, 2, '#3a2a20').px(11, 2, '#3a2a20');
  g.px(9, 3, '#c33').px(10, 3, '#c33');
  g.rect(8, 5, 4, 5, '#a88c66').hl(8, 9, 4, wing);
  g.vl(8, 10, 3, '#d8a030').vl(11, 10, 3, '#d8a030').px(7, 13, '#d8a030').px(12, 13, '#d8a030');
  return g.outline(OUTLINE);
}

export function hopliteSprite(): PixelGrid {
  const bone = '#d8d2c0';
  const bronze = '#7a5e34';
  const g = new PixelGrid(16, 19);
  g.hl(5, 0, 5, '#7a2a20').hl(4, 1, 7, '#7a2a20');
  g.rect(4, 2, 7, 4, bronze).rect(5, 4, 5, 3, bone).px(6, 5, '#000').px(8, 5, '#000');
  g.hl(6, 7, 3, bone);
  g.rect(5, 8, 5, 5, '#2c2a2e').hl(5, 9, 5, bone).hl(5, 11, 5, bone).vl(7, 8, 5, bone);
  g.rect(0, 8, 5, 7, '#6a5230').rect(1, 9, 3, 5, bronze).px(2, 11, bone);
  g.vl(14, 0, 19, '#7a6a50').px(14, 0, '#cfcfcf').px(13, 1, '#cfcfcf').px(15, 1, '#cfcfcf');
  g.vl(11, 9, 3, bone).px(12, 11, bone).px(13, 11, bone);
  g.rect(5, 13, 5, 2, '#3a2e24');
  g.vl(5, 15, 3, bone).vl(9, 15, 3, bone).hl(4, 18, 2, bronze).hl(9, 18, 2, bronze);
  return g.outline(OUTLINE);
}

export function minotaurSprite(): PixelGrid {
  const hide = '#6e4630';
  const hideD = '#4f3122';
  const horn = '#e8dcc0';
  const g = new PixelGrid(30, 31);
  // horns
  g.hl(3, 2, 6, horn).hl(21, 2, 6, horn).px(2, 1, horn).px(27, 1, horn).px(1, 0, horn).px(28, 0, horn);
  g.hl(8, 3, 3, horn).hl(19, 3, 3, horn);
  // head
  g.rect(10, 3, 10, 9, hide).rect(12, 9, 6, 4, '#8a6a52');
  g.px(12, 6, '#e23').px(17, 6, '#e23').px(13, 6, '#e23').px(16, 6, '#e23');
  g.px(13, 10, '#2a1a12').px(16, 10, '#2a1a12').hl(13, 12, 4, '#d8a030');
  g.px(9, 4, hide).px(20, 4, hide);
  // body
  g.rect(6, 13, 18, 9, hide).rect(8, 14, 6, 4, '#7d543b').rect(16, 14, 6, 4, '#7d543b');
  g.hl(10, 19, 10, hideD);
  g.rect(2, 13, 4, 9, hide).rect(24, 13, 4, 9, hide).rect(1, 21, 5, 3, hideD).rect(24, 21, 5, 3, hideD);
  // loincloth and legs
  g.rect(9, 22, 12, 3, '#8a2a20').hl(9, 22, 12, '#d8a030');
  g.rect(9, 25, 5, 4, hideD).rect(16, 25, 5, 4, hideD);
  g.rect(8, 29, 6, 2, '#1e1612').rect(16, 29, 6, 2, '#1e1612');
  return g.outline(OUTLINE);
}

// ---------- props and drops ----------

export function floorTile(base: string, alt: string, seed: number): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.rect(0, 0, 16, 16, base);
  // Simple deterministic speckle and a joint line so the floor reads as laid stone.
  let s = seed;
  for (let i = 0; i < 14; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    g.px(s % 16, (s >> 8) % 16, alt);
  }
  g.hl(0, 15, 16, alt).vl(15, 0, 16, alt);
  if (seed % 3 === 0) g.hl(3, 7, 5, alt).px(8, 8, alt);
  return g;
}

export function wallTile(c: string): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.rect(0, 0, 16, 16, c);
  g.hl(0, 4, 16, '#2a231c').hl(0, 10, 16, '#2a231c').vl(5, 0, 4, '#2a231c').vl(11, 4, 6, '#2a231c').vl(3, 10, 6, '#2a231c');
  g.hl(0, 0, 16, '#4c4034');
  return g;
}

export function pillarSprite(): PixelGrid {
  const m = '#e4dccb';
  const md = '#b8ad97';
  const g = new PixelGrid(14, 30);
  g.rect(0, 0, 14, 3, m).hl(0, 2, 14, md);
  g.rect(2, 3, 10, 24, m);
  for (let x = 3; x < 12; x += 2) g.vl(x, 3, 24, md);
  g.rect(0, 27, 14, 3, m).hl(0, 27, 14, md);
  return g.outline(OUTLINE);
}

export function stairsSprite(): PixelGrid {
  const g = new PixelGrid(18, 18);
  g.rect(0, 0, 18, 18, '#14100c');
  for (let i = 0; i < 4; i++) g.rect(1 + i * 2, 2 + i * 4, 16 - i * 4, 3, ['#8c7c62', '#6e604b', '#544937', '#3a3226'][i]!);
  return g.outline('#c8692b');
}

export function chestSprite(): PixelGrid {
  const g = new PixelGrid(14, 11);
  g.rect(0, 3, 14, 8, '#7a4e2a').rect(1, 0, 12, 4, '#8f5d33');
  g.hl(0, 4, 14, '#c58b3a').vl(3, 0, 11, '#c58b3a').vl(10, 0, 11, '#c58b3a');
  g.rect(6, 4, 2, 3, '#e8c060');
  return g.outline(OUTLINE);
}

export function coinSprite(): PixelGrid {
  const g = new PixelGrid(6, 6);
  g.rect(1, 0, 4, 6, '#e8b830').rect(0, 1, 6, 4, '#e8b830').rect(2, 1, 2, 4, '#fbe27a');
  return g.outline(OUTLINE);
}

export function potionSprite(): PixelGrid {
  const g = new PixelGrid(6, 8);
  g.rect(2, 0, 2, 2, '#c8b89a').rect(1, 2, 4, 1, '#e8e0d0').rect(0, 3, 6, 5, '#c0302a').rect(1, 4, 1, 2, '#f08070');
  return g.outline(OUTLINE);
}

export function scrollSprite(): PixelGrid {
  const g = new PixelGrid(9, 7);
  g.rect(1, 1, 7, 5, '#e8dcc0').vl(0, 0, 7, '#a88c5a').vl(8, 0, 7, '#a88c5a');
  g.hl(2, 2, 5, '#8a6a3a').hl(2, 4, 4, '#8a6a3a');
  return g.outline(OUTLINE);
}

export function gearDropSprite(): PixelGrid {
  const g = new PixelGrid(8, 8);
  g.rect(1, 2, 6, 6, G).rect(2, 0, 4, 2, D).hl(1, 2, 6, K).px(3, 4, D).px(4, 4, D);
  return g.outline(OUTLINE);
}

export function materialSprite(): PixelGrid {
  const g = new PixelGrid(6, 6);
  g.rect(1, 0, 4, 6, G).rect(0, 1, 6, 4, G).px(2, 1, K).px(1, 2, K);
  return g.outline(OUTLINE);
}

// ---------- skill icons (12x12, ink on transparent) ----------

export function skillIcon(id: string): PixelGrid {
  const g = new PixelGrid(12, 12);
  const c = '#e8dcc0';
  switch (id) {
    case 'cleave':
    case 'flame_cleave': {
      const col = id === 'flame_cleave' ? '#e2582c' : c;
      for (let i = 0; i < 9; i++) g.px(1 + i, 9 - Math.round(Math.sin((i / 8) * Math.PI) * 6), col);
      g.vl(9, 2, 8, col).px(10, 1, col);
      break;
    }
    case 'iron_skin':
      g.rect(2, 1, 8, 7, c).rect(3, 8, 6, 2, c).rect(4, 10, 4, 1, c).rect(4, 3, 4, 4, '#1c1814');
      break;
    case 'war_cry':
      g.rect(1, 4, 3, 4, c).rect(4, 3, 2, 6, c).px(6, 2, c).px(6, 9, c);
      g.px(8, 3, c).px(9, 2, c).px(8, 6, c).px(10, 6, c).px(8, 8, c).px(9, 9, c);
      break;
    case 'leap_slam':
      g.vl(5, 0, 7, c).vl(6, 0, 7, c).px(4, 5, c).px(7, 5, c).px(3, 4, c).px(8, 4, c);
      g.hl(0, 10, 12, '#a9773f').px(2, 9, '#a9773f').px(9, 9, '#a9773f');
      break;
    case 'whirlwind':
      g.hl(3, 1, 6, '#9fd0a8').vl(9, 2, 6, '#9fd0a8').hl(3, 8, 6, '#9fd0a8').vl(2, 4, 4, '#9fd0a8').hl(5, 4, 3, '#9fd0a8').px(5, 5, '#9fd0a8');
      break;
    case 'earthshatter':
      g.px(1, 10, '#a9773f').px(2, 9, '#a9773f').px(3, 9, '#a9773f').px(4, 7, '#a9773f').px(5, 6, '#a9773f');
      g.px(6, 6, '#a9773f').px(7, 4, '#a9773f').px(8, 3, '#a9773f').px(9, 2, '#a9773f').px(10, 1, '#a9773f');
      g.hl(0, 11, 12, c);
      break;
    default:
      g.rect(3, 3, 6, 6, c);
  }
  return g;
}
