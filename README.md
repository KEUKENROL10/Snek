# 🐍 SNEK — a sophisticated snake

A polished, dependency-free Snake game for the browser. Just open `index.html` — no build step, no assets, everything (including sound) is generated in-page.

## Play

- **Steer** — Arrow keys / WASD, or swipe on mobile
- **Pause** — `P`, `Esc`, `Space`, or the ⏸ button
- **Restart** — `Enter` / `R` · **Menu** — `Esc` on the game-over screen
- **Mute** — `M` or the 🔊 button

Progress (best scores per mode, skins, stats) is saved locally.

## Game modes

| Mode | Twist |
| --- | --- |
| 🐍 **Classic** | The pure game — walls are deadly |
| 🌪️ **Chaos** | Rocks pile up every level, bombs spawn, more power-ups — **1.5× score** |
| 🧘 **Zen** | Walls wrap around, gentler speed — 0.6× score |

## Power-ups

Power-ups spawn on the board after eating food and expire if you don't grab them (the ring shows time left).

| Power-up | Effect |
| --- | --- |
| ⚡ **Turbo** | Move much faster — and earn **+50% points** while it lasts |
| 🐌 **Slow-Mo** | Slow everything down for easy maneuvering |
| 👻 **Ghost** | Pass through walls, rocks and your own tail |
| 🧲 **Magnet** | Nearby food is pulled toward your head |
| ✨ **2× Score** | Double points for a while |
| 🛡 **Shield** | Survive one collision (stacks up to 3) |
| ✂ **Shrink** | Instantly halves your length |
| 🍒 **Frenzy** | Scatters bonus cherries worth 25 points each — grab them fast |
| ⭐ **Star** | Invincible: wrap walls, phase through yourself, **smash rocks for points** |
| 🌀 **Portals** | A linked portal pair appears — drive in one side, fly out the other |
| 💣 **Bomb** | Blows up every rock on the board, +20 each (Chaos only) |
| 🪙 **Gold Rush** | All food turns golden and worth **3×** base |
| 🎁 **Mystery** | Random outcome — jackpots, stars… or reversed controls and extra rocks 😵 |

## Skins

Nine snake skins, unlocked by playing:

| Skin | Unlock |
| --- | --- |
| 🟢 Classic | free |
| 🌊 Ocean | score 400 in one run |
| 💜 Neon | score 1000 in one run |
| 🔥 Lava | score 2000 in one run |
| ☣️ Toxic | eat 20 cherries (lifetime) |
| 🪙 24K | grab 30 power-ups (lifetime) |
| 🌌 Galaxy | reach level 8 |
| 🤖 Robo | grow to length 40 |
| 🌈 Rainbow | score 3500 in one run |

## Scoring

- Food is worth **10 points** (cherries **25**), multiplied by your **combo**.
- Eating again within 4.5 s chains a combo up to **×5**.
- Turbo (+50%), 2× Score, Gold Rush (3× base) and the mode multiplier all stack.
- Speed increases with each **level** (every 5 foods); Chaos drops 2 rocks per level.

## Tech

Plain HTML/CSS/JS on a `<canvas>`: fixed-timestep grid logic with interpolated rendering, per-skin body shaders, portal teleportation, particle effects, screen shake, and WebAudio-synthesized sound effects (including a noise-buffer explosion).
