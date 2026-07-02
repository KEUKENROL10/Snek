# 🐍 SNEK — a sophisticated snake

A polished, dependency-free Snake game for the browser. Just open `index.html` — no build step, no assets, everything (including sound) is generated in-page.

## Play

- **Steer** — Arrow keys / WASD, or swipe on mobile
- **Pause** — `P`, `Esc`, `Space`, or the ⏸ button
- **Restart** — `Enter` / `R`
- **Mute** — `M` or the 🔊 button

Your best score is saved locally.

## Power-ups

Power-ups spawn on the board after eating food and expire if you don't grab them (the ring shows time left).

| Power-up | Effect |
| --- | --- |
| ⚡ **Turbo** | Move much faster — and earn **+50% points** while it lasts |
| 🐌 **Slow-Mo** | Slow everything down for easy maneuvering |
| 👻 **Ghost** | Pass through walls and your own tail |
| 🧲 **Magnet** | Nearby food is pulled toward your head |
| ✨ **2× Score** | Double points for a while |
| 🛡 **Shield** | Survive one collision (stacks up to 3) |
| ✂ **Shrink** | Instantly halves your length |
| 🍒 **Frenzy** | Scatters bonus cherries worth 25 points each — grab them fast |

## Scoring

- Food is worth **10 points** (cherries **25**), multiplied by your **combo**.
- Eating again within 4.5 s chains a combo up to **×5**.
- Speed increases with each **level** (every 5 foods).

## Tech

Plain HTML/CSS/JS on a `<canvas>`: fixed-timestep grid logic with interpolated rendering, particle effects, screen shake, and WebAudio-synthesized sound effects.
