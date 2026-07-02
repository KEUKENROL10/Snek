"use strict";

/* ============================================================
 * SNEK — a sophisticated snake
 * Fixed-timestep logic on a grid, interpolated rendering,
 * power-ups, combos, particles and WebAudio sound.
 * ============================================================ */

/* ---------- Constants ---------- */

const COLS = 28;
const ROWS = 22;
const CELL = 24; // logical pixels per cell

const BASE_TICK_MS = 140;   // starting time per move
const MIN_TICK_MS = 68;
const TICK_STEP_PER_LEVEL = 6;
const FOOD_PER_LEVEL = 5;

const COMBO_WINDOW_MS = 4500;
const COMBO_MAX = 5;

const POWERUP_CHANCE = 0.35;    // per food eaten
const POWERUP_TTL_MS = 9000;
const POWERUP_BLINK_MS = 2500;
const MAX_POWERUPS_ON_BOARD = 2;

const MAGNET_RADIUS = 5;

const POWERUPS = {
  speed:  { icon: "⚡", name: "Turbo",     color: "#ffd23f", duration: 6000 },
  slow:   { icon: "🐌", name: "Slow-Mo",   color: "#4ecdc4", duration: 6000 },
  ghost:  { icon: "👻", name: "Ghost",     color: "#b39ddb", duration: 7000 },
  magnet: { icon: "🧲", name: "Magnet",    color: "#ff6b9d", duration: 8000 },
  double: { icon: "✨", name: "2× Score",  color: "#ffa726", duration: 10000 },
  shield: { icon: "🛡️", name: "Shield",   color: "#42a5f5", duration: 0 },
  shrink: { icon: "✂️", name: "Shrink",    color: "#66bb6a", duration: 0 },
  frenzy: { icon: "🍒", name: "Frenzy",    color: "#ef5350", duration: 6000 },
};
const POWERUP_TYPES = Object.keys(POWERUPS);

const DIRS = {
  up:    { x: 0, y: -1 },
  down:  { x: 0, y: 1 },
  left:  { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

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
  overlayMenu: document.getElementById("overlay-menu"),
  overlayPause: document.getElementById("overlay-pause"),
  overlayGameover: document.getElementById("overlay-gameover"),
  finalScore: document.getElementById("final-score"),
  newBest: document.getElementById("new-best"),
  btnPlay: document.getElementById("btn-play"),
  btnResume: document.getElementById("btn-resume"),
  btnRestart: document.getElementById("btn-restart"),
  btnPause: document.getElementById("btn-pause"),
  btnMute: document.getElementById("btn-mute"),
};

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

  eat(combo) {
    this.blip(440 + combo * 90, 0.07, "square", 0.05);
    this.blip(660 + combo * 90, 0.06, "square", 0.035, 0.05);
  },
  powerup() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.09, "triangle", 0.05, i * 0.06));
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
  effects: {},     // type -> remaining ms
  shieldCharges: 0,
  score: 0,
  best: Number(localStorage.getItem("snek.best")) || 0,
  foodEaten: 0,
  combo: 1,
  lastEatAt: -Infinity,
  now: 0,          // in-game clock (ms, only advances while playing)
  acc: 0,
  shake: 0,
  flash: null,     // { color, until }
  particles: [],
  floaters: [],    // floating score texts
};

/* ---------- Helpers ---------- */

const randInt = (n) => Math.floor(Math.random() * n);
const lerp = (a, b, t) => a + (b - a) * t;

function cellOccupied(x, y) {
  return (
    state.snake.some((s) => s.x === x && s.y === y) ||
    state.foods.some((f) => f.x === x && f.y === y) ||
    state.powerups.some((p) => p.x === x && p.y === y)
  );
}

function randomFreeCell() {
  // try random probes first, then linear scan as fallback
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
  const level = Math.floor(state.foodEaten / FOOD_PER_LEVEL);
  let ms = Math.max(MIN_TICK_MS, BASE_TICK_MS - level * TICK_STEP_PER_LEVEL);
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
  state.effects = {};
  state.shieldCharges = 0;
  state.score = 0;
  state.foodEaten = 0;
  state.combo = 1;
  state.lastEatAt = -Infinity;
  state.now = 0;
  state.acc = 0;
  state.shake = 0;
  state.flash = null;
  state.particles = [];
  state.floaters = [];
  spawnFood();
  updateHud();
  renderEffectsBar();
}

function spawnFood(kind = "normal") {
  const cell = randomFreeCell();
  if (cell) state.foods.push({ ...cell, kind });
}

function maybeSpawnPowerup() {
  if (state.powerups.length >= MAX_POWERUPS_ON_BOARD) return;
  if (Math.random() > POWERUP_CHANCE) return;
  const cell = randomFreeCell();
  if (!cell) return;
  const type = POWERUP_TYPES[randInt(POWERUP_TYPES.length)];
  state.powerups.push({ ...cell, type, bornAt: state.now });
}

/* ---------- Power-up activation ---------- */

function activatePowerup(type) {
  const def = POWERUPS[type];
  audio.powerup();
  flash(def.color);

  switch (type) {
    case "shield":
      state.shieldCharges = Math.min(state.shieldCharges + 1, 3);
      break;
    case "shrink": {
      const keep = Math.max(3, Math.ceil(state.snake.length / 2));
      state.snake.length = keep;
      state.prevSnake.length = Math.min(state.prevSnake.length, keep);
      break;
    }
    case "frenzy":
      state.effects.frenzy = def.duration;
      for (let i = 0; i < 6; i++) spawnFood("frenzy");
      break;
    case "speed":
      delete state.effects.slow; // opposites cancel
      state.effects.speed = def.duration;
      break;
    case "slow":
      delete state.effects.speed;
      state.effects.slow = def.duration;
      break;
    default:
      state.effects[type] = def.duration;
  }
  renderEffectsBar();
}

/* ---------- Core tick ---------- */

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

  const ghosted = !!state.effects.ghost;
  const outOfBounds = nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS;

  if (outOfBounds) {
    if (ghosted) {
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
    } else if (state.shieldCharges > 0) {
      state.shieldCharges--;
      audio.shieldSave();
      flash(POWERUPS.shield.color);
      state.shake = 8;
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
      renderEffectsBar();
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
      state.shieldCharges--;
      audio.shieldSave();
      flash(POWERUPS.shield.color);
      state.shake = 8;
      renderEffectsBar();
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
        if (Math.abs(dx) >= Math.abs(dy)) f.x += Math.sign(dx);
        else f.y += Math.sign(dy);
        if (f.x === h.x && f.y === h.y) {
          eatFood(state.foods.indexOf(f), f.x, f.y, /*grew*/ false);
        }
      }
    }
    state.foods = state.foods.filter((f) => !f.eaten);
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
  } else {
    state.combo = 1;
  }
  state.lastEatAt = state.now;

  let points = (food.kind === "frenzy" ? 25 : 10) * state.combo;
  if (state.effects.double) points *= 2;
  if (state.effects.speed) points = Math.round(points * 1.5); // turbo risk bonus
  state.score += points;
  state.foodEaten++;

  // magnet-eaten food doesn't grow the snake via unshift, so grow the tail
  if (!grew) {
    const tail = state.snake[state.snake.length - 1];
    state.snake.push({ ...tail });
  }

  audio.eat(state.combo);
  burst(x, y, food.kind === "frenzy" ? "#ef5350" : "#6ee86e", 14);
  addFloater(x, y, "+" + points, state.combo > 1 ? "#ffd23f" : "#e8ecf8");

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

  const isNewBest = state.score > state.best;
  if (isNewBest) {
    state.best = state.score;
    localStorage.setItem("snek.best", String(state.best));
  }
  el.finalScore.textContent = state.score;
  el.newBest.hidden = !isNewBest;
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

function addFloater(cx, cy, text, color) {
  state.floaters.push({
    x: (cx + 0.5) * CELL,
    y: (cy + 0.2) * CELL,
    text, color,
    age: 0, life: 0.9,
  });
}

function flash(color, ms = 220) {
  state.flash = { color, until: performance.now() + ms };
}

/* ---------- HUD ---------- */

function updateHud() {
  el.score.textContent = state.score;
  el.best.textContent = state.best;
  el.length.textContent = state.snake.length;
  el.level.textContent = currentLevel();

  const comboActive =
    state.combo > 1 && state.now - state.lastEatAt <= COMBO_WINDOW_MS;
  el.comboStat.hidden = !comboActive;
  el.combo.textContent = "×" + state.combo;
}

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

  // border glow when ghost is active (walls are permeable)
  if (state.effects.ghost) {
    ctx.strokeStyle = "rgba(179,157,219,0.6)";
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
    ctx.setLineDash([]);
  }

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

function drawFood() {
  const t = performance.now() / 1000;
  for (const f of state.foods) {
    const px = (f.x + 0.5) * CELL;
    const py = (f.y + 0.5) * CELL;
    const pulse = 1 + Math.sin(t * 5 + f.x * 1.7 + f.y) * 0.1;
    const r = CELL * 0.32 * pulse;
    const color = f.kind === "frenzy" ? "#ef5350" : "#6ee86e";

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
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
  // don't interpolate across a wall wrap
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

  const ghosted = !!state.effects.ghost;
  const turbo = !!state.effects.speed;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(segmentRenderPos(i, alpha));

  ctx.save();
  if (ghosted) ctx.globalAlpha = 0.55;

  // body: circles from tail to head with hue gradient and taper
  for (let i = n - 1; i >= 0; i--) {
    const p = pts[i];
    const frac = n === 1 ? 0 : i / (n - 1);
    const radius = CELL * (0.46 - frac * 0.16);
    const hue = turbo ? 45 + frac * 20 : 130 + frac * 60;
    ctx.fillStyle = `hsl(${hue} 70% ${52 - frac * 14}%)`;
    if (i === 0) {
      ctx.shadowColor = turbo ? "#ffd23f" : "#6ee86e";
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
    ctx.arc(head.x, head.y, CELL * 0.62, performance.now() / 400, performance.now() / 400 + Math.PI * 2);
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
  ctx.font = `700 ${CELL * 0.6}px "Segoe UI", system-ui, sans-serif`;
  for (const f of state.floaters) {
    const k = 1 - f.age / f.life;
    ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.4));
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - (1 - k) * 26);
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

function queueDir(dir) {
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
    else if (state.phase === "playing") queueDir(DIRS[dirName]);
    return;
  }

  switch (e.key) {
    case " ":
      e.preventDefault();
      if (state.phase === "menu") startGame();
      else if (state.phase === "gameover") startGame();
      else togglePause();
      break;
    case "p": case "P": case "Escape":
      if (state.phase === "playing" || state.phase === "paused") togglePause();
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
    if (state.phase === "menu" || state.phase === "gameover") startGame();
    return;
  }
  if (state.phase !== "playing") return;
  if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? DIRS.right : DIRS.left);
  else queueDir(dy > 0 ? DIRS.down : DIRS.up);
}, { passive: false });

// whole overlay is tappable — friendlier on mobile
el.overlayMenu.addEventListener("click", startGame);
el.overlayGameover.addEventListener("click", startGame);
el.btnResume.addEventListener("click", togglePause);
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
el.best.textContent = state.best;
resetGame();
state.phase = "menu";
requestAnimationFrame(frame);

// read-only handle for debugging / automated smoke tests
window.__SNEK__ = { state, DIRS, POWERUPS, COLS, ROWS };
