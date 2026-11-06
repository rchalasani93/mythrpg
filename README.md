# Tower of Ages (mythrpg)

A browser-based, real-time action roguelite. Each run climbs 100 floors of a tower shaped by one of four mythologies (Greek, Norse, Hindu, Egyptian) and ends at that myth's final boss.

This branch is the first playable prototype: **one class (Warrior), Greek Act I, floors 1 to 10**, ending with Asterion the Minotaur.

## Run it

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (elements, combat, loot, saves)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

`dist/` is static files. It can be hosted on any static host (Cloudflare Pages, Netlify, GitHub Pages). `public/_headers` sets security headers on hosts that read that file.

## Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD or arrow keys | Left thumb stick |
| Aim | Mouse | Auto-aims at the nearest enemy |
| Attack | Hold left click or J | ATK |
| Dodge | Space or Shift | DASH |
| Skills | 1 to 4 | Skill buttons |
| Potion | Q | POT |
| Bag and stats | I or Tab | BAG |
| Use shrine | E | Tap the shrine |
| Pause | Esc | |

## What's in the prototype

- **Floors 1 to 10:** waves of Satyrs, Harpies and Shade Hoplites. Floor 5 is a shrine (heal, forge or Ares's gamble), floor 7 is an elite floor, and floor 10 is the Minotaur. He charges in straight lines, gets dazed if he hits a wall and calls in Satyrs at half HP. On Hell he gains a third phase.
- **Warrior:** 7 skills in the pool (Cleave, Iron Skin, War Cry, Leap Slam, Flame Cleave, Whirlwind, Earthshatter). Skills drop as scrolls, level up to 5 and go in 4 slots. Rage builds when you hit and when you're hit.
- **Stats:** STR, DEX, VIT, MAG. Each level gives class growth plus 2 free points.
- **Elements:** Water beats Fire, Fire beats Wind, Wind beats Earth, Earth beats Lightning and Lightning beats Water. Light and Dark beat each other. Ice beats Water and Poison beats Earth. Each element applies a status effect (burn, soak, knockback, stagger, chain lightning, chill, poison, blind or lifesteal).
- **Gear:** 7 slots (weapon, side weapon, helmet, armor, gloves, pants, boots). Every slot is a layer on the character sprite, so what you equip is what you see. Items roll a rarity, stat affixes and sometimes an element.
- **Drops:** gold, potions, monster materials, gear and skill scrolls. If no scroll drops for 5 floors, the next floor chest guarantees one.
- **Difficulty:** Easy, Medium, Hard and Hell. Hard unlocks after clearing Act I on Medium, and Hell unlocks after Hard.
- **Saves:** the run is saved at the start of every floor (except on Hell). Souls, best floor and the codex carry over between runs.

Not built yet: the other three starter classes, Acts II to V, the other myths, Summoner capture, and spending souls.

## Code layout

```
src/
  data/       classes, skills, items, monsters, myths, elements, difficulty (all content is data)
  systems/    run state, loot tables, combat math, seeded RNG, validated saves
  entities/   Enemy AI, CharacterView (layered paper-doll sprite)
  scenes/     Boot (draws all art), Menu, Game, Inventory, End
  input/      Touch controls
  art/        pixel-art sprites, drawn in code on a 16x20 grid
tests/        Vitest unit tests
```

All art is original pixel art drawn in code at boot. There are no image files, so no third-party art licenses apply yet.

## Security notes

The prototype is a static, single-player client: no server, accounts, database or API keys.

- Save data in `localStorage` is untrusted. `src/systems/save.ts` checks every field (types, ranges, known ids, size limit) and drops anything invalid instead of loading it.
- The production build ships a strict Content-Security-Policy (no inline scripts, no third-party origins), has no source maps, and inlines no assets.
- Text is drawn on the canvas, so no user content ever reaches `innerHTML`.
- Dependabot (npm and Actions), CodeQL and a CI workflow (`npm audit`, typecheck, tests, build) run on `main` and `develop`.
