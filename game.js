"use strict";

/* ============================================================
 * SNEK — a sophisticated snake
 * Fixed-timestep logic on a grid, interpolated rendering,
 * 13 power-ups, 3 game modes, 9 unlockable skins, portals,
 * rocks, combos, particles and WebAudio sound.
 * ============================================================ */

/* ---------- Constants ---------- */

const COLS = 28;
const ROWS = 22;
const CELL = 24; // logical pixels per cell

const FOOD_PER_LEVEL = 5;

const COMBO_WINDOW_MS = 4500;
const COMBO_MAX = 5;

const POWERUP_TTL_MS = 9000;
const POWERUP_BLINK_MS = 2500;
const MAX_POWERUPS_ON_BOARD = 2;

const MAGNET_RADIUS = 5;

const POWERUPS = {
  speed:     { icon: "⚡", name: "Turbo",     color: "#ffd23f", duration: 6000 },
  slow:      { icon: "🐌", name: "Slow-Mo",   color: "#4ecdc4", duration: 6000 },
  ghost:     { icon: "👻", name: "Ghost",     color: "#b39ddb", duration: 7000 },
  magnet:    { icon: "🧲", name: "Magnet",    color: "#ff6b9d", duration: 8000 },
  double:    { icon: "✨", name: "2× Score",  color: "#ffa726", duration: 10000 },
  shield:    { icon: "🛡️", name: "Shield",   color: "#42a5f5", duration: 0 },
  shrink:    { icon: "✂️", name: "Shrink",    color: "#66bb6a", duration: 0 },
  frenzy:    { icon: "🍒", name: "Frenzy",    color: "#ef5350", duration: 6000 },
  star:      { icon: "⭐", name: "Star",      color: "#fff176", duration: 6000 },
  portal:    { icon: "🌀", name: "Portals",   color: "#26c6da", duration: 12000 },
  bomb:      { icon: "💣", name: "Bomb",      color: "#ff8a65", duration: 0 },
  gold:      { icon: "🪙", name: "Gold Rush", color: "#ffd700", duration: 8000 },
  mystery:   { icon: "🎁", name: "Mystery",   color: "#ce93d8", duration: 0 },
  confusion: { icon: "😵", name: "Dizzy",     color: "#ef9a9a", duration: 5000 }, // mystery-only
};

const BASE_POOL = [
  "speed", "slow", "ghost", "magnet", "double", "shield",
  "shrink", "frenzy", "star", "portal", "gold", "mystery",
];

const MODES = {
  classic: {
    name: "Classic", icon: "🐍", desc: "The pure game — walls are deadly.",
    wrapWalls: false, rocks: false, foodCount: 1,
    powerupChance: 0.35,
    baseTick: 140, minTick: 68, tickStep: 6,
    scoreMult: 1,
    pool: BASE_POOL,
  },
  chaos: {
    name: "Chaos", icon: "🌪️", desc: "Rocks pile up every level. 1.5× score.",
    wrapWalls: false, rocks: true, rockCap: 14, rocksPerLevel: 2, foodCount: 2,
    powerupChance: 0.5,
    baseTick: 130, minTick: 60, tickStep: 7,
    scoreMult: 1.5,
    pool: [...BASE_POOL, "bomb"],
  },
  zen: {
    name: "Zen", icon: "🧘", desc: "Walls wrap around. Flow, but 0.6× score.",
    wrapWalls: true, rocks: false, foodCount: 1,
    powerupChance: 0.35,
    baseTick: 150, minTick: 85, tickStep: 5,
    scoreMult: 0.6,
    pool: BASE_POOL,
  },
};

/* Skins: seg(frac, index, timeMs) -> canvas fillStyle.
 * frac runs 0 (head) -> 1 (tail). */
const SKINS = {
  classic: {
    name: "Classic", unlock: { free: true },
    glow: "#6ee86e", preview: ["#6ee86e", "#2e7d32"],
    seg: (f) => `hsl(${130 + f * 60} 70% ${52 - f * 14}%)`,
  },
  ocean: {
    name: "Ocean", unlock: { score: 400 },
    glow: "#4fc3f7", preview: ["#4fc3f7", "#1565c0"],
    seg: (f) => `hsl(${190 + f * 35} 85% ${58 - f * 16}%)`,
  },
  neon: {
    name: "Neon", unlock: { score: 1000 },
    glow: "#ff4fd8", preview: ["#ff4fd8", "#00e5ff"],
    seg: (f, i) => (i % 2 === 0 ? `hsl(310 100% ${60 - f * 10}%)` : `hsl(185 100% ${55 - f * 10}%)`),
  },
  lava: {
    name: "Lava", unlock: { score: 2000 },
    glow: "#ff7043", preview: ["#ffca28", "#d84315"],
    seg: (f, i, t) => `hsl(${35 - f * 25 + Math.sin(t / 90 + i) * 6} 95% ${55 - f * 10}%)`,
  },
  toxic: {
    name: "Toxic", unlock: { cherries: 20 },
    glow: "#c6ff00", preview: ["#c6ff00", "#33691e"],
    seg: (f, i) => (i % 3 === 0 ? "hsl(80 40% 22%)" : `hsl(75 95% ${52 - f * 10}%)`),
  },
  gold: {
    name: "24K", unlock: { powerups: 30 },
    glow: "#ffd700", preview: ["#ffe082", "#ff8f00"], shimmer: true,
    seg: (f) => `hsl(${46 - f * 8} ${90 - f * 15}% ${58 - f * 16}%)`,
  },
  galaxy: {
    name: "Galaxy", unlock: { level: 8 },
    glow: "#b388ff", preview: ["#7c4dff", "#1a237e"], stars: true,
    seg: (f, i) => `hsl(${258 + Math.sin(i * 0.7) * 18} 65% ${40 - f * 10}%)`,
  },
  robo: {
    name: "Robo", unlock: { length: 40 },
    glow: "#80deea", preview: ["#b0bec5", "#37474f"], shape: "square",
    seg: (f, i) => (i % 2 === 0 ? `hsl(200 12% ${62 - f * 18}%)` : `hsl(200 15% ${45 - f * 12}%)`),
  },
  rainbow: {
    name: "Rainbow", unlock: { score: 3500 },
    glow: "#ffffff", preview: ["#ff5252", "#40c4ff"],
    seg: (f, i, t) => `hsl(${(t / 12 + i * 14) % 360} 90% 58%)`,
  },
};

const DIRS = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

/* ---------- DOM ---------- */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const el = {
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  combo: document.getElementById("combo"),
  comboStat: document.getElementById("combo-stat"),
  length: document.getElementById("length"),
  level: document.getElementById("level"),
  effectsBar: document.getElementById("effects-bar"),
  stage: document.getElementById("stage"),
  overlayMenu: document.getElementById("overlay-menu"),
  overlayPause: document.getElementById("overlay-pause"),
  overlayGameover: document.getElementById("overlay-gameover"),
  finalScore: document.getElementById("final-score"),
  newBest: document.getElementById("new-best"),
  goLength: document.getElementById("go-length"),
  goLevel: document.getElementById("go-level"),
  goPowerups: document.getElementById("go-powerups"),
  modeRow: document.getElementById("mode-row"),
  modeHint: document.getElementById("mode-hint"),
  skinRow: document.getElementById("skin-row"),
  skinHint: document.getElementById("skin-hint"),
  toast: document.getElementById("toast"),
  btnPlay: document.getElementById("btn-play"),
  btnResume: document.getElementById("btn-resume"),
  btnRestart: document.getElementById("btn-restart"),
  btnPause: document.getElementById("btn-pause"),
  btnMute: document.getElementById("btn-mute"),
};

/* ---------- Persistence ---------- */

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

const stats = store.get("snek.stats", { games: 0, food: 0, cherries: 0, powerups: 0 });

const bests = store.get("snek.bests", null) || (() => {
  // migrate the pre-modes best score into classic
  const legacy = Number(localStorage.getItem("snek.best")) || 0;
  return { classic: legacy, chaos: 0, zen: 0 };
})();

const unlocked = new Set(store.get("snek.unlocked", ["classic"]));
unlocked.add("classic");

let selectedMode = store.get("snek.mode", "classic");
if (!MODES[selectedMode]) selectedMode = "classic";

let selectedSkin = store.get("snek.skin", "classic");
if (!SKINS[selectedSkin] || !unlocked.has(selectedSkin)) selectedSkin = "classic";

function persistUnlocks() {
  store.set("snek.unlocked", [...unlocked]);
}

function persistProgress() {
  store.set("snek.stats", stats);
  store.set("snek.bests", bests);
}

/* ---------- Audio (generated, no assets) ---------- */

const audio = {
  ctx: null,
  muted: localStorage.getItem("snek.muted") === "1",

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },

  blip(freq, dur = 0.08, type = "square", gain = 0.05, when = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  sweep(from, to, dur = 0.2, type = "sine", gain = 0.05, when = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  eat(combo) {
    this.blip(440 + combo * 90, 0.07, "square", 0.05);
    this.blip(660 + combo * 90, 0.06, "square", 0.035, 0.05);
  },
  powerup() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.09, "triangle", 0.05, i * 0.06));
  },
  star() {
    [392, 494, 587, 784, 988, 1175].forEach((f, i) => this.blip(f, 0.1, "triangle", 0.05, i * 0.055));
  },
  portal() {
    this.sweep(200, 900, 0.22, "sine", 0.06);
    this.sweep(900, 300, 0.2, "sine", 0.04, 0.16);
  },
  explosion() {
    if (this.muted || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.35), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(900, t);
    filt.frequency.exponentialRampToValueAtTime(120, t + 0.32);
    const g = c.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t);
  },
  dizzy() {
    [500, 430, 360, 300].forEach((f, i) => this.blip(f, 0.12, "sine", 0.05, i * 0.09));
  },
  fanfare() {
    [523, 659, 784].forEach((f, i) => this.blip(f, 0.12, "triangle", 0.05, i * 0.08));
  },
  unlock() {
    [880, 1109, 1319].forEach((f, i) => this.blip(f, 0.14, "triangle", 0.05, i * 0.09));
  },
  shieldSave() {
    this.blip(300, 0.15, "sawtooth", 0.05);
    this.blip(600, 0.2, "triangle", 0.05, 0.08);
  },
  death() {
    [330, 262, 196, 131].forEach((f, i) => this.blip(f, 0.22, "sawtooth", 0.055, i * 0.11));
  },
  click() { this.blip(880, 0.04, "square", 0.03); },
};

/* ---------- State ---------- */

const state = {
  phase: "menu", // menu | playing | paused | gameover
  snake: [],
  prevSnake: [],
  dir: DIRS.right,
  dirQueue: [],
  foods: [],       // { x, y, kind: 'normal'|'frenzy' }
  powerups: [],    // { x, y, type, bornAt }
  rocks: [],       // { x, y }
  portal: null,    // { a: {x,y}, b: {x,y} }
  effects: {},     // type -> remaining ms
  shieldCharges: 0,
  score: 0,
  foodEaten: 0,
  runPowerups: 0,
  combo: 1,
  lastEatAt: -Infinity,
  now: 0,          // in-game clock (ms, only advances while playing)
  acc: 0,
  shake: 0,
  flash: null,     // { color, until }
  particles: [],
  floaters: [],    // floating texts (grid-anchored + big announcements)
};

const MODE = () => MODES[selectedMode];

/* ---------- Helpers ---------- */

const randInt = (n) => Math.floor(Math.random() * n);
const lerp = (a, b, t) => a + (b - a) * t;

function cellOccupied(x, y) {
  return (
    state.snake.some((s) => s.x === x && s.y === y) ||
    state.foods.some((f) => f.x === x && f.y === y) ||
    state.powerups.some((p) => p.x === x && p.y === y) ||
    state.rocks.some((r) => r.x === x && r.y === y) ||
    (state.portal &&
      ((state.portal.a.x === x && state.portal.a.y === y) ||
       (state.portal.b.x === x && state.portal.b.y === y)))
  );
}

function randomFreeCell() {
  for (let i = 0; i < 80; i++) {
    const x = randInt(COLS);
    const y = randInt(ROWS);
    if (!cellOccupied(x, y)) return { x, y };
  }
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (!cellOccupied(x, y)) return { x, y };
  return null; // board completely full
}

function tickInterval() {
  const mode = MODE();
  const level = Math.floor(state.foodEaten / FOOD_PER_LEVEL);
  let ms = Math.max(mode.minTick, mode.baseTick - level * mode.tickStep);
  if (state.effects.speed) ms *= 0.62;
  if (state.effects.slow) ms *= 1.55;
  return ms;
}

function currentLevel() {
  return Math.floor(state.foodEaten / FOOD_PER_LEVEL) + 1;
}

/* ---------- Game setup ---------- */

function resetGame() {
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  state.snake = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  state.prevSnake = state.snake.map((s) => ({ ...s }));
  state.dir = DIRS.right;
  state.dirQueue = [];
  state.foods = [];
  state.powerups = [];
  state.rocks = [];
  state.portal = null;
  state.effects = {};
  state.shieldCharges = 0;
  state.score = 0;
  state.foodEaten = 0;
  state.runPowerups = 0;
  state.combo = 1;
  state.lastEatAt = -Infinity;
  state.now = 0;
  state.acc = 0;
  state.shake = 0;
  state.flash = null;
  state.particles = [];
  state.floaters = [];
  for (let i = 0; i < MODE().foodCount; i++) spawnFood();
  updateHud();
  renderEffectsBar();
}

function spawnFood(kind = "normal") {
  const cell = randomFreeCell();
  if (cell) state.foods.push({ ...cell, kind });
}

function maybeSpawnPowerup() {
  if (state.powerups.length >= MAX_POWERUPS_ON_BOARD) return;
  if (Math.random() > MODE().powerupChance) return;
  const cell = randomFreeCell();
  if (!cell) return;
  const pool = MODE().pool;
  const type = pool[randInt(pool.length)];
  state.powerups.push({ ...cell, type, bornAt: state.now });
}

function spawnRocks(count) {
  const head = state.snake[0];
  const cap = MODE().rockCap || 14;
  for (let r = 0; r < count && state.rocks.length < cap; r++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = randInt(COLS);
      const y = randInt(ROWS);
      const farEnough = Math.max(Math.abs(x - head.x), Math.abs(y - head.y)) >= 5;
      if (farEnough && !cellOccupied(x, y)) {
        state.rocks.push({ x, y });
        burst(x, y, "#90a4ae", 8);
        break;
      }
    }
  }
}

function spawnPortals() {
  const a = randomFreeCell();
  if (!a) return null;
  // keep the pair reasonably far apart so travel is worth it
  let b = null;
  for (let tries = 0; tries < 40; tries++) {
    const c = randomFreeCell();
    if (c && Math.abs(c.x - a.x) + Math.abs(c.y - a.y) >= 10) { b = c; break; }
  }
  if (!b) b = randomFreeCell();
  if (!b) return null;
  return { a, b };
}

/* ---------- Power-up activation ---------- */

function activatePowerup(type) {
  const def = POWERUPS[type];
  flash(def.color);

  switch (type) {
    case "shield":
      audio.powerup();
      state.shieldCharges = Math.min(state.shieldCharges + 1, 3);
      break;
    case "shrink": {
      audio.powerup();
      const keep = Math.max(3, Math.ceil(state.snake.length / 2));
      state.snake.length = keep;
      state.prevSnake.length = Math.min(state.prevSnake.length, keep);
      break;
    }
    case "frenzy":
      audio.powerup();
      state.effects.frenzy = def.duration;
      for (let i = 0; i < 6; i++) spawnFood("frenzy");
      break;
    case "speed":
      audio.powerup();
      delete state.effects.slow; // opposites cancel
      state.effects.speed = def.duration;
      break;
    case "slow":
      audio.powerup();
      delete state.effects.speed;
      state.effects.slow = def.duration;
      break;
    case "star":
      audio.star();
      state.effects.star = def.duration;
      break;
    case "portal": {
      const pair = spawnPortals();
      if (pair) {
        audio.portal();
        state.portal = pair;
        state.effects.portal = def.duration;
      }
      break;
    }
    case "bomb": {
      audio.explosion();
      state.shake = 12;
      const n = state.rocks.length;
      if (n > 0) {
        for (const rock of state.rocks) burst(rock.x, rock.y, "#ff8a65", 16);
        state.rocks = [];
        const pts = Math.round(20 * n * MODE().scoreMult);
        state.score += pts;
        announce(`💣 ${n} rocks! +${pts}`, "#ff8a65");
      } else {
        const pts = Math.round(60 * MODE().scoreMult);
        state.score += pts;
        announce(`💣 +${pts}`, "#ff8a65");
      }
      break;
    }
    case "gold":
      audio.powerup();
      state.effects.gold = def.duration;
      break;
    case "mystery":
      activateMystery();
      break;
    default:
      audio.powerup();
      state.effects[type] = def.duration;
  }
  renderEffectsBar();
}

function activateMystery() {
  const outcomes = [
    ["star", 3], ["double", 3], ["gold", 3], ["frenzy", 3],
    ["shield", 2], ["speed", 2], ["shrink", 2],
    ["points", 3], ["confusion", 3],
  ];
  if (MODE().rocks) outcomes.push(["rocks", 2]);

  const total = outcomes.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  let picked = outcomes[0][0];
  for (const [type, w] of outcomes) {
    roll -= w;
    if (roll <= 0) { picked = type; break; }
  }

  switch (picked) {
    case "points": {
      const pts = Math.round(150 * MODE().scoreMult);
      state.score += pts;
      audio.powerup();
      announce(`🎁 +${pts}!`, "#ce93d8");
      break;
    }
    case "confusion":
      state.effects.confusion = POWERUPS.confusion.duration;
      audio.dizzy();
      announce("🎁 😵 DIZZY!", "#ef9a9a");
      state.shake = 6;
      break;
    case "rocks":
      spawnRocks(3);
      audio.explosion();
      announce("🎁 🪨 ROCKS!", "#90a4ae");
      state.shake = 6;
      break;
    default:
      activatePowerup(picked);
      announce(`🎁 ${POWERUPS[picked].icon} ${POWERUPS[picked].name}!`, POWERUPS[picked].color);
  }
}

/* ---------- Core tick ---------- */

function consumeShield() {
  state.shieldCharges--;
  audio.shieldSave();
  flash(POWERUPS.shield.color);
  state.shake = 8;
  renderEffectsBar();
}

function step() {
  // consume one queued direction per tick
  while (state.dirQueue.length) {
    const next = state.dirQueue.shift();
    const isReverse = next.x === -state.dir.x && next.y === -state.dir.y;
    if (!isReverse && next !== state.dir) {
      state.dir = next;
      break;
    }
  }

  state.prevSnake = state.snake.map((s) => ({ ...s }));

  const head = state.snake[0];
  let nx = head.x + state.dir.x;
  let ny = head.y + state.dir.y;

  const starred = !!state.effects.star;
  const ghosted = !!state.effects.ghost || starred;
  const wraps = MODE().wrapWalls || ghosted;
  const outOfBounds = nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS;

  if (outOfBounds) {
    if (wraps) {
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
    } else if (state.shieldCharges > 0) {
      consumeShield();
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
    } else {
      return die();
    }
  }

  // portals teleport the head, direction is kept
  if (state.portal) {
    const { a, b } = state.portal;
    let exit = null;
    if (nx === a.x && ny === a.y) exit = b;
    else if (nx === b.x && ny === b.y) exit = a;
    if (exit) {
      burst(nx, ny, "#26c6da", 10);
      burst(exit.x, exit.y, "#ff9800", 10);
      audio.portal();
      nx = exit.x;
      ny = exit.y;
    }
  }

  // rocks: star smashes them, ghost slips through, shield tanks one
  const rockIdx = state.rocks.findIndex((r) => r.x === nx && r.y === ny);
  if (rockIdx !== -1) {
    if (starred) {
      state.rocks.splice(rockIdx, 1);
      const pts = Math.round(15 * MODE().scoreMult);
      state.score += pts;
      burst(nx, ny, "#ff8a65", 20);
      addFloater(nx, ny, "+" + pts, "#ff8a65");
      audio.explosion();
      state.shake = 6;
    } else if (ghosted) {
      // slips through, rock stays
    } else if (state.shieldCharges > 0) {
      consumeShield();
      state.rocks.splice(rockIdx, 1);
      burst(nx, ny, "#90a4ae", 14);
    } else {
      return die();
    }
  }

  // self collision — the tail cell is safe unless we grow this tick
  const willEat = state.foods.some((f) => f.x === nx && f.y === ny);
  const body = willEat ? state.snake : state.snake.slice(0, -1);
  const hitSelf = body.some((s) => s.x === nx && s.y === ny);

  if (hitSelf && !ghosted) {
    if (state.shieldCharges > 0) {
      consumeShield();
    } else {
      return die();
    }
  }

  state.snake.unshift({ x: nx, y: ny });

  // eating
  const foodIdx = state.foods.findIndex((f) => f.x === nx && f.y === ny);
  if (foodIdx !== -1) {
    eatFood(foodIdx, nx, ny);
  } else {
    state.snake.pop();
  }

  // picking up a power-up
  const puIdx = state.powerups.findIndex((p) => p.x === nx && p.y === ny);
  if (puIdx !== -1) {
    const pu = state.powerups.splice(puIdx, 1)[0];
    stats.powerups++;
    state.runPowerups++;
    burst(pu.x, pu.y, POWERUPS[pu.type].color, 18);
    addFloater(pu.x, pu.y, POWERUPS[pu.type].icon + " " + POWERUPS[pu.type].name, POWERUPS[pu.type].color);
    activatePowerup(pu.type);
  }

  // magnet drags food toward the head one cell per tick
  if (state.effects.magnet) {
    const h = state.snake[0];
    for (const f of state.foods) {
      const dx = h.x - f.x;
      const dy = h.y - f.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= MAGNET_RADIUS && (dx || dy)) {
        let tx = f.x, ty = f.y;
        if (Math.abs(dx) >= Math.abs(dy)) tx += Math.sign(dx);
        else ty += Math.sign(dy);
        // don't drag food into a rock
        if (!state.rocks.some((r) => r.x === tx && r.y === ty)) {
          f.x = tx;
          f.y = ty;
        }
        if (f.x === h.x && f.y === h.y) {
          eatFood(state.foods.indexOf(f), f.x, f.y, /*grew*/ false);
        }
      }
    }
    state.foods = state.foods.filter((f) => !f.eaten);
  }

  // turbo / star exhaust trail
  if (state.effects.speed || starred) {
    const tail = state.snake[state.snake.length - 1];
    trail(tail.x, tail.y, starred ? "#fff176" : SKINS[selectedSkin].glow);
  }

  // expire board power-ups
  state.powerups = state.powerups.filter((p) => state.now - p.bornAt < POWERUP_TTL_MS);

  updateHud();
}

function eatFood(idx, x, y, grew = true) {
  const food = state.foods[idx];
  if (!food || food.eaten) return;
  food.eaten = true;
  if (grew) {
    state.foods.splice(idx, 1);
  }

  // combo: chain eats inside the window
  if (state.now - state.lastEatAt <= COMBO_WINDOW_MS) {
    state.combo = Math.min(state.combo + 1, COMBO_MAX);
    if (state.combo >= 3) announce(`COMBO ×${state.combo}`, "#ffd23f");
  } else {
    state.combo = 1;
  }
  state.lastEatAt = state.now;

  let points = food.kind === "frenzy" ? 25 : 10;
  if (state.effects.gold) points *= 3;
  points *= state.combo;
  if (state.effects.double) points *= 2;
  if (state.effects.speed) points *= 1.5; // turbo risk bonus
  points = Math.round(points * MODE().scoreMult);
  state.score += points;

  const levelBefore = currentLevel();
  state.foodEaten++;
  stats.food++;
  if (food.kind === "frenzy") stats.cherries++;

  // magnet-eaten food doesn't grow the snake via unshift, so grow the tail
  if (!grew) {
    const tail = state.snake[state.snake.length - 1];
    state.snake.push({ ...tail });
  }

  audio.eat(state.combo);
  burst(x, y, state.effects.gold ? "#ffd700" : food.kind === "frenzy" ? "#ef5350" : "#6ee86e", 14);
  addFloater(x, y, "+" + points, state.combo > 1 ? "#ffd23f" : "#e8ecf8");

  const levelAfter = currentLevel();
  if (levelAfter > levelBefore) {
    announce(`LEVEL ${levelAfter}`, "#4ecdc4");
    audio.fanfare();
    flash("#4ecdc4");
    if (MODE().rocks) spawnRocks(MODE().rocksPerLevel);
  }

  if (food.kind === "normal") {
    spawnFood();
    maybeSpawnPowerup();
  }
}

function die() {
  state.phase = "gameover";
  state.shake = 16;
  audio.death();
  flash("#ef5350", 400);
  const head = state.snake[0];
  burst(head.x, head.y, "#ef5350", 40);

  stats.games++;
  const isNewBest = state.score > (bests[selectedMode] || 0);
  if (isNewBest) bests[selectedMode] = state.score;
  persistProgress();

  el.finalScore.textContent = state.score;
  el.newBest.hidden = !isNewBest;
  el.goLength.textContent = state.snake.length;
  el.goLevel.textContent = currentLevel();
  el.goPowerups.textContent = state.runPowerups;
  el.overlayGameover.classList.remove("hidden");
  updateHud();
}

/* ---------- Effects / juice ---------- */

function burst(cx, cy, color, count) {
  const px = (cx + 0.5) * CELL;
  const py = (cy + 0.5) * CELL;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 40 + Math.random() * 140;
    state.particles.push({
      x: px, y: py,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.5 + Math.random() * 0.45,
      age: 0,
      size: 1.5 + Math.random() * 2.5,
      color,
    });
  }
}

function trail(cx, cy, color) {
  const px = (cx + 0.5) * CELL;
  const py = (cy + 0.5) * CELL;
  for (let i = 0; i < 2; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 8 + Math.random() * 30;
    state.particles.push({
      x: px, y: py,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.25 + Math.random() * 0.25,
      age: 0,
      size: 1 + Math.random() * 1.8,
      color,
    });
  }
}

function addFloater(cx, cy, text, color) {
  state.floaters.push({
    x: (cx + 0.5) * CELL,
    y: (cy + 0.2) * CELL,
    text, color,
    age: 0, life: 0.9,
  });
}

function announce(text, color) {
  // stack concurrent announcements instead of overlapping them
  const bigCount = state.floaters.filter((f) => f.big).length;
  state.floaters.push({
    x: (COLS * CELL) / 2,
    y: ROWS * CELL * 0.32 + bigCount * CELL * 1.7,
    text, color,
    age: 0, life: 1.3,
    big: true,
  });
}

function flash(color, ms = 220) {
  state.flash = { color, until: performance.now() + ms };
}

/* ---------- Toasts ---------- */

const toastQueue = [];
let toastBusy = false;

function toast(msg) {
  toastQueue.push(msg);
  pumpToasts();
}

function pumpToasts() {
  if (toastBusy || toastQueue.length === 0) return;
  toastBusy = true;
  el.toast.textContent = toastQueue.shift();
  el.toast.classList.add("show");
  setTimeout(() => {
    el.toast.classList.remove("show");
    setTimeout(() => {
      toastBusy = false;
      pumpToasts();
    }, 300);
  }, 2200);
}

/* ---------- Skin unlocks ---------- */

function unlockMet(u) {
  if (u.free) return true;
  if (u.score) return state.score >= u.score;
  if (u.cherries) return stats.cherries >= u.cherries;
  if (u.powerups) return stats.powerups >= u.powerups;
  if (u.level) return state.phase === "playing" && currentLevel() >= u.level;
  if (u.length) return state.snake.length >= u.length;
  return false;
}

function unlockText(u) {
  if (u.score) return `Score ${u.score} in one run`;
  if (u.cherries) return `Eat ${u.cherries} cherries (${Math.min(stats.cherries, u.cherries)}/${u.cherries})`;
  if (u.powerups) return `Grab ${u.powerups} power-ups (${Math.min(stats.powerups, u.powerups)}/${u.powerups})`;
  if (u.level) return `Reach level ${u.level}`;
  if (u.length) return `Grow to length ${u.length}`;
  return "";
}

function checkUnlocks() {
  for (const [id, skin] of Object.entries(SKINS)) {
    if (unlocked.has(id)) continue;
    if (unlockMet(skin.unlock)) {
      unlocked.add(id);
      persistUnlocks();
      audio.unlock();
      toast(`🎨 ${skin.name} skin unlocked!`);
      buildSkinRow();
    }
  }
}

/* ---------- HUD ---------- */

function updateHud() {
  el.score.textContent = state.score;
  el.best.textContent = bests[selectedMode] || 0;
  el.length.textContent = state.snake.length;
  el.level.textContent = currentLevel();

  const comboActive =
    state.combo > 1 && state.now - state.lastEatAt <= COMBO_WINDOW_MS;
  el.comboStat.hidden = !comboActive;
  el.combo.textContent = "×" + state.combo;

  checkUnlocks();
}

const GLOW_PRIORITY = ["star", "confusion", "gold", "ghost", "double", "speed", "slow", "magnet", "frenzy", "portal"];

function renderEffectsBar() {
  const parts = [];
  for (const [type, remaining] of Object.entries(state.effects)) {
    const def = POWERUPS[type];
    const frac = Math.max(0, Math.min(1, remaining / def.duration));
    parts.push(
      `<span class="effect-badge" style="--c:${def.color}" data-type="${type}">` +
        `${def.icon} ${def.name}` +
        `<span class="bar" style="transform:scaleX(${frac.toFixed(3)})"></span>` +
      `</span>`
    );
  }
  for (let i = 0; i < state.shieldCharges; i++) {
    parts.push(
      `<span class="effect-badge" style="--c:${POWERUPS.shield.color}">🛡️ Shield</span>`
    );
  }
  el.effectsBar.innerHTML = parts.join("");

  // stage aura follows the loudest active effect
  const active = GLOW_PRIORITY.find((t) => state.effects[t]);
  el.stage.style.boxShadow = active
    ? `0 0 34px ${POWERUPS[active].color}66, 0 20px 60px rgba(0,0,0,0.45)`
    : "";
}

function updateEffectTimers(dt) {
  let changed = false;
  for (const type of Object.keys(state.effects)) {
    state.effects[type] -= dt;
    if (state.effects[type] <= 0) {
      delete state.effects[type];
      if (type === "frenzy") {
        state.foods = state.foods.filter((f) => f.kind !== "frenzy");
      }
      if (type === "portal") {
        state.portal = null;
      }
      changed = true;
    }
  }
  if (changed) renderEffectsBar();
  else {
    // cheap bar update without rebuilding DOM
    for (const badge of el.effectsBar.querySelectorAll(".effect-badge[data-type]")) {
      const type = badge.dataset.type;
      if (!state.effects[type]) continue;
      const frac = Math.max(0, state.effects[type] / POWERUPS[type].duration);
      badge.querySelector(".bar").style.transform = `scaleX(${frac.toFixed(3)})`;
    }
  }
}

/* ---------- Menu UI (modes + skins) ---------- */

function buildModeRow() {
  el.modeRow.innerHTML = "";
  for (const [id, mode] of Object.entries(MODES)) {
    const btn = document.createElement("button");
    btn.className = "mode-btn" + (id === selectedMode ? " selected" : "");
    btn.innerHTML = `<span class="m-icon">${mode.icon}</span>${mode.name}`;
    btn.addEventListener("click", () => {
      selectedMode = id;
      store.set("snek.mode", id);
      audio.click();
      buildModeRow();
      updateHud();
    });
    el.modeRow.appendChild(btn);
  }
  const mode = MODE();
  el.modeHint.textContent = `${mode.desc} Best: ${bests[selectedMode] || 0}`;
}

function buildSkinRow() {
  el.skinRow.innerHTML = "";
  for (const [id, skin] of Object.entries(SKINS)) {
    const btn = document.createElement("button");
    const isUnlocked = unlocked.has(id);
    btn.className =
      "skin-swatch" +
      (id === selectedSkin ? " selected" : "") +
      (isUnlocked ? "" : " locked");
    btn.style.setProperty("--sw", `linear-gradient(135deg, ${skin.preview[0]}, ${skin.preview[1]})`);
    btn.title = skin.name;
    btn.textContent = isUnlocked ? "" : "🔒";
    btn.addEventListener("click", () => {
      if (isUnlocked) {
        selectedSkin = id;
        store.set("snek.skin", id);
        audio.click();
        buildSkinRow();
      } else {
        btn.classList.remove("denied");
        void btn.offsetWidth; // restart the shake animation
        btn.classList.add("denied");
        el.skinHint.textContent = `🔒 ${skin.name}: ${unlockText(skin.unlock)}`;
      }
    });
    el.skinRow.appendChild(btn);
  }
  if (unlocked.has(selectedSkin)) {
    el.skinHint.textContent = `Skin: ${SKINS[selectedSkin].name}`;
  }
}

/* ---------- Rendering ---------- */

function setupCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = COLS * CELL * dpr;
  canvas.height = ROWS * CELL * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw(alpha) {
  const W = COLS * CELL;
  const H = ROWS * CELL;

  ctx.save();

  // screen shake
  if (state.shake > 0.2) {
    ctx.translate(
      (Math.random() - 0.5) * state.shake,
      (Math.random() - 0.5) * state.shake
    );
  }

  // dizzy wobble
  if (state.effects.confusion && state.phase === "playing") {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(Math.sin(performance.now() / 140) * 0.015);
    ctx.translate(-W / 2, -H / 2);
  }

  // background
  ctx.fillStyle = "#0d1120";
  ctx.fillRect(-20, -20, W + 40, H + 40);

  // subtle checkerboard
  ctx.fillStyle = "rgba(255,255,255,0.018)";
  for (let y = 0; y < ROWS; y++) {
    for (let x = (y % 2); x < COLS; x += 2) {
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  // border glow when walls are permeable
  if (state.effects.ghost || state.effects.star || MODE().wrapWalls) {
    ctx.strokeStyle = state.effects.star
      ? "rgba(255,241,118,0.6)"
      : "rgba(179,157,219,0.5)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    ctx.setLineDash([]);
  }

  drawRocks();
  drawPortals();
  drawFood();
  drawPowerups();
  drawSnake(alpha);
  drawParticles();
  drawFloaters();

  // flash overlay
  if (state.flash && performance.now() < state.flash.until) {
    const remain = (state.flash.until - performance.now()) / 220;
    ctx.globalAlpha = Math.max(0, Math.min(0.22, remain * 0.22));
    ctx.fillStyle = state.flash.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawRocks() {
  for (const r of state.rocks) {
    const px = r.x * CELL;
    const py = r.y * CELL;
    const wobble = ((r.x * 7 + r.y * 13) % 3) - 1;

    ctx.save();
    ctx.fillStyle = "#3a4155";
    ctx.beginPath();
    ctx.roundRect(px + 3, py + 3 + wobble, CELL - 6, CELL - 6 - wobble, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 8 + wobble);
    ctx.lineTo(px + CELL * 0.5, py + 5 + wobble);
    ctx.stroke();
    // crack
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.moveTo(px + CELL * 0.55, py + CELL * 0.3);
    ctx.lineTo(px + CELL * 0.45, py + CELL * 0.55);
    ctx.lineTo(px + CELL * 0.6, py + CELL * 0.75);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPortals() {
  if (!state.portal) return;
  const t = performance.now();
  const pair = [
    [state.portal.a, "#26c6da", 1],
    [state.portal.b, "#ff9800", -1],
  ];
  for (const [p, color, spin] of pair) {
    const px = (p.x + 0.5) * CELL;
    const py = (p.y + 0.5) * CELL;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(10,12,24,0.85)";
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = (t / 28) * spin;
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = (t / 18) * -spin;
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFood() {
  const t = performance.now() / 1000;
  const goldRush = !!state.effects.gold;
  for (const f of state.foods) {
    const px = (f.x + 0.5) * CELL;
    const py = (f.y + 0.5) * CELL;
    const pulse = 1 + Math.sin(t * 5 + f.x * 1.7 + f.y) * 0.1;
    const r = CELL * 0.32 * pulse;
    const color = goldRush ? "#ffd700" : f.kind === "frenzy" ? "#ef5350" : "#6ee86e";

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = goldRush ? 20 : 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPowerups() {
  const t = performance.now();
  for (const p of state.powerups) {
    const def = POWERUPS[p.type];
    const age = state.now - p.bornAt;
    const left = POWERUP_TTL_MS - age;

    // blink when about to expire
    if (left < POWERUP_BLINK_MS && Math.floor(t / 160) % 2 === 0) continue;

    const px = (p.x + 0.5) * CELL;
    const py = (p.y + 0.5) * CELL + Math.sin(t / 300 + p.x) * 2;

    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(19,24,41,0.9)";
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // remaining-time ring
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.44, -Math.PI / 2, -Math.PI / 2 + (left / POWERUP_TTL_MS) * Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font = `${CELL * 0.55}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.icon, px, py + 1);
    ctx.restore();
  }
}

function segmentRenderPos(i, alpha) {
  const cur = state.snake[i];
  const prev = state.prevSnake[i] || state.prevSnake[state.prevSnake.length - 1] || cur;
  // don't interpolate across a wall wrap or portal jump
  if (Math.abs(cur.x - prev.x) > 1 || Math.abs(cur.y - prev.y) > 1) {
    return { x: (cur.x + 0.5) * CELL, y: (cur.y + 0.5) * CELL };
  }
  return {
    x: (lerp(prev.x, cur.x, alpha) + 0.5) * CELL,
    y: (lerp(prev.y, cur.y, alpha) + 0.5) * CELL,
  };
}

function drawSnake(alpha) {
  const n = state.snake.length;
  if (n === 0) return;

  const skin = SKINS[selectedSkin];
  const starred = !!state.effects.star;
  const ghosted = !!state.effects.ghost;
  const tms = performance.now();
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(segmentRenderPos(i, alpha));

  ctx.save();
  if (ghosted && !starred) ctx.globalAlpha = 0.55;

  // body from tail to head with taper; star overrides any skin with rainbow
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    const frac = n === 1 ? 0 : i / (n - 1);
    const radius = CELL * (0.46 - frac * 0.16);
    ctx.fillStyle = starred
      ? `hsl(${(tms / 2 + i * 25) % 360} 95% 60%)`
      : skin.seg(frac, i, tms);
    if (i === 0) {
      ctx.shadowColor = starred ? "#ffffff" : skin.glow;
      ctx.shadowBlur = starred ? 20 : 12;
    }
    ctx.beginPath();
    if (skin.shape === "square" && !starred) {
      ctx.roundRect(p.x - radius, p.y - radius, radius * 2, radius * 2, radius * 0.35);
    } else {
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // galaxy skin: tiny stars along the body
  if (skin.stars && !starred) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 2; i < n; i += 3) {
      const p = pts[i];
      const ox = ((i * 37) % 9) - 4;
      const oy = ((i * 53) % 9) - 4;
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 24K skin: a highlight glides down the body
  if (skin.shimmer && !starred && n > 1) {
    const idx = Math.floor(tms / 90) % n;
    const p = pts[idx];
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, CELL * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  // head details: eyes looking in the travel direction
  const head = pts[0];
  const d = state.dir;
  const ex = d.y !== 0 ? 0.22 : 0; // eye offset perpendicular to travel
  const ey = d.x !== 0 ? 0.22 : 0;
  const fx = d.x * 0.16; // eye offset forward
  const fy = d.y * 0.16;

  for (const side of [-1, 1]) {
    const cx = head.x + (fx + side * ex) * CELL;
    const cy = head.y + (fy + side * ey) * CELL;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0e1a";
    ctx.beginPath();
    ctx.arc(cx + d.x * 1.5, cy + d.y * 1.5, CELL * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  // shield aura
  if (state.shieldCharges > 0) {
    ctx.strokeStyle = "rgba(66,165,245,0.75)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(head.x, head.y, CELL * 0.62, tms / 400, tms / 400 + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    const k = 1 - p.age / p.life;
    ctx.globalAlpha = Math.max(0, k);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.textAlign = "center";
  for (const f of state.floaters) {
    const k = 1 - f.age / f.life;
    ctx.font = f.big
      ? `900 ${CELL * 1.4}px "Segoe UI", system-ui, sans-serif`
      : `700 ${CELL * 0.6}px "Segoe UI", system-ui, sans-serif`;
    ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
    if (f.big) {
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - (1 - k) * (f.big ? 14 : 26));
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/* ---------- Main loop ---------- */

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(now - lastFrame, 100);
  lastFrame = now;

  if (state.phase === "playing") {
    state.now += dt;
    state.acc += dt;
    updateEffectTimers(dt);

    const interval = tickInterval();
    let safety = 0;
    while (state.acc >= interval && state.phase === "playing" && safety++ < 8) {
      state.acc -= interval;
      step();
    }

    // combo expiry display
    if (state.combo > 1 && state.now - state.lastEatAt > COMBO_WINDOW_MS) {
      state.combo = 1;
      updateHud();
    }
  }

  // decay of visuals runs even when paused/dead so they settle nicely
  const s = dt / 1000;
  state.shake *= Math.pow(0.0015, s);
  for (const p of state.particles) {
    p.age += s;
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.vx *= 0.96;
    p.vy = p.vy * 0.96 + 60 * s;
  }
  state.particles = state.particles.filter((p) => p.age < p.life);
  for (const f of state.floaters) f.age += s;
  state.floaters = state.floaters.filter((f) => f.age < f.life);

  const alpha = state.phase === "playing" ? Math.min(1, state.acc / tickInterval()) : 1;
  draw(alpha);
  requestAnimationFrame(frame);
}

/* ---------- Phase control ---------- */

function startGame() {
  audio.ensure();
  audio.click();
  resetGame();
  state.phase = "playing";
  el.overlayMenu.classList.add("hidden");
  el.overlayPause.classList.add("hidden");
  el.overlayGameover.classList.add("hidden");
}

function goToMenu() {
  state.phase = "menu";
  el.overlayPause.classList.add("hidden");
  el.overlayGameover.classList.add("hidden");
  el.overlayMenu.classList.remove("hidden");
  buildModeRow();
  buildSkinRow();
  updateHud();
  audio.click();
}

function togglePause() {
  if (state.phase === "playing") {
    state.phase = "paused";
    el.overlayPause.classList.remove("hidden");
  } else if (state.phase === "paused") {
    state.phase = "playing";
    el.overlayPause.classList.add("hidden");
  }
  audio.click();
}

function setMuted(m) {
  audio.muted = m;
  localStorage.setItem("snek.muted", m ? "1" : "0");
  el.btnMute.textContent = m ? "🔇" : "🔊";
}

/* ---------- Input ---------- */

function queueDir(name) {
  if (state.effects.confusion) name = OPPOSITE[name];
  const dir = DIRS[name];
  const last = state.dirQueue[state.dirQueue.length - 1] || state.dir;
  const isReverse = dir.x === -last.x && dir.y === -last.y;
  if (dir !== last && !isReverse && state.dirQueue.length < 3) {
    state.dirQueue.push(dir);
  }
}

const KEY_DIRS = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  w: "up", s: "down", a: "left", d: "right",
  W: "up", S: "down", A: "left", D: "right",
};

window.addEventListener("keydown", (e) => {
  const dirName = KEY_DIRS[e.key];

  if (dirName) {
    e.preventDefault();
    if (state.phase === "menu") startGame();
    else if (state.phase === "playing") queueDir(dirName);
    return;
  }

  switch (e.key) {
    case " ":
      e.preventDefault();
      if (state.phase === "menu") startGame();
      else if (state.phase === "gameover") startGame();
      else togglePause();
      break;
    case "p": case "P":
      if (state.phase === "playing" || state.phase === "paused") togglePause();
      break;
    case "Escape":
      if (state.phase === "playing" || state.phase === "paused") togglePause();
      else if (state.phase === "gameover") goToMenu();
      break;
    case "Enter": case "r": case "R":
      if (state.phase === "menu" || state.phase === "gameover") startGame();
      break;
    case "m": case "M":
      setMuted(!audio.muted);
      break;
  }
});

// touch: swipe to steer, tap to start
let touchStart = null;
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;

  if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
    if (state.phase === "gameover") startGame();
    return;
  }
  if (state.phase !== "playing") return;
  if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? "right" : "left");
  else queueDir(dy > 0 ? "down" : "up");
}, { passive: false });

el.btnPlay.addEventListener("click", startGame);
el.btnRestart.addEventListener("click", startGame);
// game-over overlay is fully tappable — friendlier on mobile
el.overlayGameover.addEventListener("click", startGame);
el.btnResume.addEventListener("click", togglePause);
document.getElementById("btn-menu").addEventListener("click", (e) => {
  e.stopPropagation(); // the game-over overlay itself restarts on click
  goToMenu();
});
document.getElementById("btn-quit").addEventListener("click", goToMenu);
el.btnPause.addEventListener("click", () => {
  if (state.phase === "playing" || state.phase === "paused") togglePause();
});
el.btnMute.addEventListener("click", () => setMuted(!audio.muted));

// pause when tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.phase === "playing") togglePause();
});

/* ---------- Boot ---------- */

setupCanvas();
setMuted(audio.muted);
buildModeRow();
buildSkinRow();
resetGame();
state.phase = "menu";
requestAnimationFrame(frame);

// read-only handle for debugging / automated smoke tests
window.__SNEK__ = {
  state, DIRS, POWERUPS, SKINS, MODES, COLS, ROWS,
  get stats() { return stats; },
  get bests() { return bests; },
  get unlocked() { return [...unlocked]; },
  get selectedMode() { return selectedMode; },
  get selectedSkin() { return selectedSkin; },
};
