// Pure game logic: no DOM, no Math.random. A run is fully determined by (seed, input log),
// which is what daily challenge and ghost replay rely on.
export const W = 600, GROUND = 130, STEP = 1 / 60;
const GRAVITY = 2400, JUMP_V = -700;
const LOW = GROUND - 12, MID = GROUND - 24; // bird bottoms: LOW must be jumped, MID must be ducked (or jumped)
const BOSS_EVERY = 1000;
const POWER_TIME = { slow: 5, dbl: 10, magnet: 8 };
const KINDS = ["shield", "slow", "dbl", "magnet"];

export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(seed) {
  return {
    seed, rng: mulberry32(seed), frame: 0, over: false,
    dino: { x: 40, y: GROUND, vy: 0, w: 28, h: 30, duckH: 16 },
    duck: false, airJumps: 0,
    obstacles: [], pickups: [],
    speed: 300, score: 0, distance: 0, nextSpawn: 0.8, // distance drives parallax scroll
    power: { shield: 0, slow: 0, dbl: 0, magnet: 0 },
    boss: null, nextBoss: BOSS_EVERY,
    events: [], // drained by the renderer: "jump" "land" "die" "milestone" "pickup" "coin" "shield" "boss:<type>" "bossEnd"
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

const box = o => ({ x: o.x, y: o.y - o.h, w: o.w, h: o.h });
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function spawnBird(s, y) { s.obstacles.push({ type: "bird", x: W, y, w: 28, h: 14 }); }
function spawnCactus(s) { s.obstacles.push({ type: "cactus", x: W, y: GROUND, w: 14 + s.rng() * 12, h: 25 + s.rng() * 20 }); }

function spawnNormal(s) {
  const r = s.rng();
  if (r < 0.2 && s.score > 200) spawnBird(s, s.rng() < 0.5 ? LOW : MID);
  else if (r < 0.32) s.pickups.push({ kind: KINDS[Math.floor(s.rng() * KINDS.length)], x: W, y: GROUND - 20, w: 16, h: 16 });
  else if (r < 0.47) s.pickups.push({ kind: "coin", x: W, y: GROUND - 70, w: 12, h: 12 });
  else spawnCactus(s);
  s.nextSpawn = 0.7 + s.rng() * 0.9 + 150 / s.speed;
}

function startBoss(s) {
  const type = ["swarm", "meteor", "wall"][Math.floor(s.rng() * 3)];
  s.boss = { type, t: 0, timer: 0.5, dur: type === "wall" ? 6 : 8 };
  // wall needs more air time than a single jump gives, so hand out a double jump to keep it fair
  if (type === "wall") s.power.dbl = Math.max(s.power.dbl, 12);
  s.events.push("boss:" + type);
}

function bossTick(s, dt) {
  const b = s.boss;
  b.t += dt;
  b.timer -= dt;
  if (b.timer <= 0) {
    if (b.type === "swarm") { spawnBird(s, s.rng() < 0.5 ? LOW : MID); b.timer = 0.8; }
    else if (b.type === "meteor") {
      s.obstacles.push({ type: "meteor", x: W - s.rng() * 100, y: -10, w: 16, h: 16, vy: 60 + s.rng() * 100 });
      b.timer = 0.7;
    } else { s.obstacles.push({ type: "wall", x: W, y: GROUND, w: 24, h: 100 }); b.timer = 1.8; }
  }
  if (b.t >= b.dur) {
    s.boss = null;
    s.nextBoss += BOSS_EVERY;
    s.nextSpawn = 1.2;
    s.events.push("bossEnd");
  }
}

export function update(s) {
  if (s.over) return;
  const dt = STEP, d = s.dino;
  s.frame++;

  const wasAir = d.y < GROUND;
  d.vy += GRAVITY * dt;
  d.y = Math.min(GROUND, d.y + d.vy * dt);
  if (d.y >= GROUND) { d.vy = 0; if (wasAir) s.events.push("land"); }

  const p = s.power;
  for (const k of ["slow", "dbl", "magnet"]) p[k] = Math.max(0, p[k] - dt);
  const world = s.speed * (p.slow > 0 ? 0.6 : 1) * dt;

  s.speed += 5 * dt;
  s.distance += world;
  const before = Math.floor(s.score / 100);
  s.score += world * 0.05;
  if (Math.floor(s.score / 100) > before) s.events.push("milestone");

  if (s.boss) bossTick(s, dt);
  else {
    s.nextSpawn -= dt;
    if (s.nextSpawn <= 0) spawnNormal(s);
    if (s.score >= s.nextBoss) startBoss(s);
  }

  for (const o of s.obstacles) {
    o.x -= world;
    if (o.type === "meteor" && o.y < GROUND) o.y = Math.min(GROUND, o.y + o.vy * dt);
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
    if (!overlap(db, box(o))) continue;
    if (p.shield) { p.shield = 0; o.x = -999; s.events.push("shield"); continue; }
    s.over = true;
    s.events.push("die");
    return;
  }
}
