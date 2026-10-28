// Pure game logic: no DOM, no Math.random. A run is fully determined by (seed, difficulty, input log),
// which is what daily challenge and ghost replay rely on.
export const W = 600, GROUND = 130, STEP = 1 / 60;
// bump when anything changes the RNG sequence or physics: stored ghosts are keyed by this
export const SIM_VERSION = 2;
const GRAVITY = 2400, JUMP_V = -700;
const LOW = GROUND - 12, MID = GROUND - 24; // bird bottoms: LOW must be jumped, MID must be ducked (or jumped)
const BOSS_EVERY = 1000;
const POWER_TIME = { slow: 5, dbl: 10, magnet: 8 };
const KINDS = ["shield", "slow", "dbl", "magnet"];

export const BIOMES = ["desert", "forest", "snow", "volcano", "space"];
export const biomeIndex = score => Math.floor(score / 1000) % BIOMES.length;
export const biomeAt = score => BIOMES[biomeIndex(score)];

// pickups: "all" = power-ups and coins, "coins" = coins only. Zen never dies: a hit just knocks the speed back.
export const RULES = {
  chill: { accel: 3, gap: 1.3, speed: 280, lives: 3, pickups: "all", ranked: false },
  normal: { accel: 5, gap: 1, speed: 300, lives: 1, pickups: "all", ranked: true },
  hardcore: { accel: 7, gap: 0.8, speed: 340, lives: 1, pickups: "coins", ranked: true },
  zen: { accel: 3, gap: 1.3, speed: 280, lives: Infinity, pickups: "all", ranked: false, zen: true },
};

// [behaviour, weight, min score]. Art varies by biome (see art.js), behaviour does not.
const TABLE = [
  /* desert  */ [["cactus", 5, 0], ["bird", 2, 200], ["roller", 2, 300], ["pit", 1, 400]],
  /* forest  */ [["cactus", 4, 0], ["hopper", 3, 0], ["bird", 2, 200], ["pit", 1, 400]],
  /* snow    */ [["cactus", 4, 0], ["roller", 3, 300], ["pit", 2, 400], ["bird", 2, 200]],
  /* volcano */ [["cactus", 4, 0], ["geyser", 3, 0], ["hopper", 2, 0], ["bird", 2, 200]],
  /* space   */ [["cactus", 4, 0], ["hopper", 3, 0], ["pit", 2, 400], ["bird", 2, 200]],
];

export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(seed, difficulty = "normal") {
  const rules = RULES[difficulty] || RULES.normal;
  return {
    seed, difficulty: RULES[difficulty] ? difficulty : "normal", rules,
    rng: mulberry32(seed), frame: 0, over: false,
    dino: { x: 40, y: GROUND, vy: 0, w: 28, h: 30, duckH: 16 },
    duck: false, airJumps: 0,
    obstacles: [], pickups: [],
    speed: rules.speed, score: 0, distance: 0, nextSpawn: 0.8, // distance drives parallax scroll
    lives: rules.lives, invuln: 0, biomeIdx: 0,
    power: { shield: 0, slow: 0, dbl: 0, magnet: 0 },
    boss: null, nextBoss: BOSS_EVERY,
    // drained by the renderer: "jump" "land" "die" "milestone" "pickup" "coin" "shield" "hit" "erupt" "boss:<type>" "bossEnd" "biome:<id>"
    events: [],
  };
}

export function dinoBox(s) {
  const d = s.dino;
  const h = s.duck && d.y >= GROUND ? d.duckH : d.h;
  return { x: d.x, y: d.y - h, w: d.w, h };
}

export function press(s, cmd) {
  if (s.over) return;
  const d = s.dino;
  if (cmd === "duckDown") s.duck = true;
  else if (cmd === "duckUp") s.duck = false;
  else if (cmd === "jump") {
    if (d.y >= GROUND) { d.vy = JUMP_V; s.airJumps = 0; s.events.push("jump"); }
    else if (s.power.dbl > 0 && s.airJumps < 1) { d.vy = JUMP_V; s.airJumps++; s.events.push("jump"); }
  }
}

// Zen has no death, so the player ends the run themselves
export function endRun(s) {
  if (s.over) return;
  s.over = true;
  s.events.push("die");
}

const box = o => ({ x: o.x, y: o.y - o.h, w: o.w, h: o.h });
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function spawnBird(s, y, boss = false) { s.obstacles.push({ type: "bird", x: W, y, w: 28, h: 14, b: biomeIndex(s.score), boss }); }

function spawnHazard(s, type) {
  const b = biomeIndex(s.score);
  if (type === "cactus") s.obstacles.push({ type, x: W, y: GROUND, w: 14 + s.rng() * 12, h: 25 + s.rng() * 20, b });
  else if (type === "bird") spawnBird(s, s.rng() < 0.5 ? LOW : MID);
  else if (type === "hopper") s.obstacles.push({ type, x: W, y: GROUND, w: 20, h: 20, vy: 0, wait: 0.2 + s.rng() * 0.6, b });
  else if (type === "roller") s.obstacles.push({ type, x: W, y: GROUND, w: 18, h: 18, b });
  else if (type === "pit") s.obstacles.push({ type, x: W, y: GROUND, w: 60 + s.rng() * 30, h: 0, b });
  else s.obstacles.push({ type, x: W, y: GROUND, w: 22, h: 0, erupt: false, b }); // geyser: harmless until it erupts
  return s.obstacles[s.obstacles.length - 1];
}

function pickHazard(s) {
  const rows = TABLE[biomeIndex(s.score)].filter(r => s.score >= r[2]);
  let r = s.rng() * rows.reduce((a, x) => a + x[1], 0);
  for (const row of rows) { r -= row[1]; if (r < 0) return row[0]; }
  return rows[rows.length - 1][0];
}

function spawnNormal(s) {
  const r = s.rng();
  let w = 0; // width of what was spawned: long hazards leave extra landing room before the next one
  if (r < 0.12) {
    if (s.rules.pickups === "all") s.pickups.push({ kind: KINDS[Math.floor(s.rng() * KINDS.length)], x: W, y: GROUND - 20, w: 16, h: 16 });
    else s.pickups.push({ kind: "coin", x: W, y: GROUND - 70, w: 12, h: 12 });
  } else if (r < 0.27) s.pickups.push({ kind: "coin", x: W, y: GROUND - 70, w: 12, h: 12 });
  else w = spawnHazard(s, pickHazard(s)).w;
  s.nextSpawn = (0.7 + s.rng() * 0.9) * s.rules.gap + (150 + w) / s.speed;
}

function startBoss(s) {
  const type = ["swarm", "meteor", "wall"][Math.floor(s.rng() * 3)];
  // first boss spawn waits out the pending normal-spawn delay so it never lands right behind a hazard
  s.boss = { type, t: 0, timer: Math.max(0.5, s.nextSpawn), dur: type === "wall" ? 6 : 8 };
  // wall needs more air time than a single jump gives, so hand out a double jump to keep it fair
  if (type === "wall") s.power.dbl = Math.max(s.power.dbl, 12);
  s.events.push("boss:" + type);
}

function bossTick(s, dt) {
  const b = s.boss;
  b.t += dt;
  b.timer -= dt;
  if (b.timer <= 0) {
    if (b.type === "swarm") { spawnBird(s, s.rng() < 0.5 ? LOW : MID, true); b.timer = 0.8; }
    else if (b.type === "meteor") {
      s.obstacles.push({ type: "meteor", x: W - s.rng() * 100, y: -10, w: 16, h: 16, vy: 60 + s.rng() * 100, boss: true });
      b.timer = 0.7;
    } else { s.obstacles.push({ type: "wall", x: W, y: GROUND, w: 24, h: 100, b: biomeIndex(s.score), boss: true }); b.timer = 1.8; }
  }
  if (b.t >= b.dur) {
    s.boss = null;
    s.nextBoss += BOSS_EVERY;
    s.nextSpawn = 1.2;
    s.events.push("bossEnd");
  }
}

// returns true when the run is over
function hit(s, o) {
  const p = s.power, d = s.dino;
  if (s.invuln > 0) return false;
  const bounce = () => { d.vy = JUMP_V; d.y = GROUND - 1; s.airJumps = 0; }; // pits throw you back out instead of removing the pit
  if (p.shield) {
    p.shield = 0;
    s.events.push("shield");
    if (o.type === "pit") { bounce(); s.invuln = 0.6; } else o.x = -999;
    return false;
  }
  if (s.lives > 1) {
    if (s.lives !== Infinity) s.lives--;
    s.invuln = 1.2;
    if (s.rules.zen) s.speed = Math.max(s.rules.speed, s.speed * 0.6);
    s.events.push("hit");
    if (o.type === "pit") bounce(); else o.x = -999;
    return false;
  }
  s.over = true;
  s.events.push("die");
  return true;
}

export function update(s) {
  if (s.over) return;
  const dt = STEP, d = s.dino;
  s.frame++;
  s.invuln = Math.max(0, s.invuln - dt);

  const wasAir = d.y < GROUND;
  d.vy += GRAVITY * dt;
  d.y = Math.min(GROUND, d.y + d.vy * dt);
  if (d.y >= GROUND) { d.vy = 0; if (wasAir) s.events.push("land"); }

  const p = s.power;
  for (const k of ["slow", "dbl", "magnet"]) p[k] = Math.max(0, p[k] - dt);
  const world = s.speed * (p.slow > 0 ? 0.6 : 1) * dt;

  s.speed += s.rules.accel * dt;
  s.distance += world;
  const before = Math.floor(s.score / 100);
  s.score += world * 0.05;
  if (Math.floor(s.score / 100) > before) s.events.push("milestone");
  const bi = biomeIndex(s.score);
  if (bi !== s.biomeIdx) { s.biomeIdx = bi; s.events.push("biome:" + BIOMES[bi]); }

  if (s.boss) bossTick(s, dt);
  else {
    s.nextSpawn -= dt;
    if (s.nextSpawn <= 0) spawnNormal(s);
    if (s.score >= s.nextBoss) startBoss(s);
  }

  for (const o of s.obstacles) {
    o.x -= o.type === "roller" ? world * 1.35 : world; // rollers arrive early: jump sooner
    if (o.type === "meteor" && o.y < GROUND) o.y = Math.min(GROUND, o.y + o.vy * dt);
    else if (o.type === "hopper") {
      o.vy += 1400 * dt;
      o.y = Math.min(GROUND, o.y + o.vy * dt);
      if (o.y >= GROUND) {
        o.vy = 0;
        o.wait -= dt;
        if (o.wait <= 0) { o.vy = -420; o.wait = 0.7; } // peak ~63px
      }
    } else if (o.type === "geyser" && !o.erupt && o.x < d.x + 220) {
      o.erupt = true;
      o.h = 75; // jumpable column
      s.events.push("erupt");
    }
  }
  s.obstacles = s.obstacles.filter(o => o.x + o.w > 0);

  const db = dinoBox(s);
  for (const c of s.pickups) {
    c.x -= world;
    if (p.magnet > 0 && Math.abs(c.x - d.x) < 200) { // pull toward dino
      c.x -= 200 * dt;
      c.y += Math.sign(d.y - 15 - c.y) * 120 * dt;
    }
  }
  s.pickups = s.pickups.filter(c => {
    if (c.x + c.w <= 0) return false;
    if (!overlap(db, box(c))) return true;
    if (c.kind === "coin") s.score += 10;
    else if (c.kind === "shield") p.shield = 1;
    else p[c.kind] = POWER_TIME[c.kind];
    s.events.push(c.kind === "coin" ? "coin" : "pickup");
    return false;
  });

  for (const o of s.obstacles) {
    if (o.type === "pit") {
      // the dino falls when it stands with its centre over the gap; a little edge forgiveness
      const cx = d.x + d.w / 2;
      if (d.y >= GROUND && cx > o.x + 8 && cx < o.x + o.w - 8 && hit(s, o)) return;
    } else if (overlap(db, box(o)) && hit(s, o)) return;
  }
}
