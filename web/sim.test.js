// Run: node web/sim.test.js
import assert from "node:assert/strict";
import { createSim, press, update, endRun, biomeAt, biomeIndex, BIOMES, RULES, GROUND, SIM_VERSION } from "./sim.js";

const MID = GROUND - 24;

// simple bot so runs last long enough to reach power-ups, bosses and new biomes
function bot(s) {
  const cmds = [], d = s.dino, sp = s.speed;
  const o = s.obstacles.filter(x => x.x + x.w > d.x).sort((a, b) => a.x - b.x)[0];
  const midBird = o && o.type === "bird" && o.y === MID && o.x < d.x + sp * 0.3;
  if (midBird && !s.duck) cmds.push("duckDown");
  else if (!midBird && s.duck) cmds.push("duckUp");
  if (o && !midBird && d.y >= GROUND) {
    let go = false;
    if (o.type === "pit") { const c = o.x + o.w / 2 - (d.x + d.w / 2); go = c > 0 && c < sp * 0.29 + 4; } // apex over the pit centre
    else if (o.type === "hopper" && o.y < GROUND - 40) go = false; // passes overhead
    else if (o.type === "geyser" && !o.erupt) go = false;
    else go = o.x < d.x + d.w + sp * 0.3 * (o.type === "roller" ? 1.35 : 1);
    if (go) cmds.push("jump");
  } else if (o && s.power.dbl > 0 && d.vy > 0 && d.y < GROUND - 40) cmds.push("jump");
  return cmds;
}

function run(seed, difficulty = "normal", frames = 20000) {
  const s = createSim(seed, difficulty), log = [];
  while (s.frame < frames && !s.over) {
    for (const c of bot(s)) { log.push([s.frame, c]); press(s, c); }
    update(s);
    s.events.length = 0;
  }
  return { s, log };
}

// replay a log the way the ghost does (web/game.js ghostStep): apply entries due by s.frame, then update
function replay(seed, difficulty, log, frames) {
  const s = createSim(seed, difficulty);
  let i = 0;
  while (s.frame < frames && !s.over) {
    while (i < log.length && log[i][0] <= s.frame) press(s, log[i++][1]);
    update(s);
    s.events.length = 0;
  }
  return s;
}

// the dino hovers out of reach so every spawn can be inspected without the run ending
function observe(seed, difficulty, frames, onFrame) {
  const s = createSim(seed, difficulty);
  while (s.frame < frames) {
    s.dino.y = -1e6; s.dino.vy = 0;
    update(s);
    onFrame(s);
    s.events.length = 0;
  }
  return s;
}

// a sim with one hand-placed obstacle and the dino standing on the ground
function scene(o, difficulty = "normal") {
  const s = createSim(1, difficulty);
  s.nextSpawn = 1e9; s.nextBoss = 1e9;
  s.obstacles.push({ b: 0, ...o });
  return s;
}

// ---- determinism and replay, every difficulty ----
for (const diff of Object.keys(RULES)) {
  const a = run(12345, diff), b = run(12345, diff);
  assert.equal(a.s.score, b.s.score, `${diff}: same seed + inputs -> same score`);
  assert.equal(a.s.frame, b.s.frame, `${diff}: same seed + inputs -> same end frame`);
  assert.deepEqual(a.s.obstacles, b.s.obstacles, `${diff}: same obstacles`);
  assert.ok(a.s.frame > 600, `${diff}: bot survives past the first obstacles (ended at frame ${a.s.frame})`);
  const r = replay(12345, diff, a.log, a.s.frame);
  assert.equal(r.score, a.s.score, `${diff}: replaying the input log reproduces the run`);
  assert.equal(r.over, a.s.over, `${diff}: replay ends the same way`);
}
assert.notDeepEqual([run(12345).s.score, run(12345).s.frame], [run(99999).s.score, run(99999).s.frame], "different seed differs");
assert.notEqual(run(12345, "normal").s.score, run(12345, "chill").s.score, "difficulty changes the run");
assert.equal(typeof SIM_VERSION, "number");

// ---- rules ----
assert.equal(createSim(1, "hardcore").speed, 340);
assert.equal(createSim(1, "chill").lives, 3);
assert.equal(createSim(1, "bogus").difficulty, "normal", "unknown difficulty falls back to normal");
assert.deepEqual(Object.entries(RULES).filter(([, r]) => r.ranked).map(([k]) => k), ["normal", "hardcore"]);
for (let seed = 1; seed <= 20; seed++) {
  observe(seed, "hardcore", 6000, s => { for (const p of s.pickups) assert.equal(p.kind, "coin", "hardcore spawns coins only"); });
}

// ---- biomes ----
assert.equal(biomeAt(0), "desert");
assert.equal(biomeAt(999.9), "desert");
assert.equal(biomeAt(1000), "forest");
assert.equal(biomeAt(4999), "space");
assert.equal(biomeAt(5000), "desert", "biomes loop");
assert.equal(biomeIndex(2500), 2);

// ---- existing: mid bird is dodgeable by ducking, hits a standing dino ----
{
  const t = scene({ type: "bird", x: 40, y: MID, w: 28, h: 14 });
  press(t, "duckDown"); update(t);
  assert.equal(t.over, false, "ducking dino passes under mid bird");
  const u = scene({ type: "bird", x: 40, y: MID, w: 28, h: 14 });
  update(u);
  assert.equal(u.over, true, "standing dino hits mid bird");
}

// ---- pit ----
{
  const s = scene({ type: "pit", x: 30, y: GROUND, w: 70, h: 0 });
  update(s);
  assert.equal(s.over, true, "standing over a pit is fatal");

  const j = scene({ type: "pit", x: 30, y: GROUND, w: 70, h: 0 });
  press(j, "jump");
  for (let i = 0; i < 80 && !j.over; i++) update(j);
  assert.equal(j.over, false, "jumping clears the pit");
  assert.ok(j.obstacles.length === 0 || j.obstacles[0].x + j.obstacles[0].w < 0 || j.obstacles.every(o => o.x + o.w < j.dino.x), "pit is behind the dino");

  const edge = scene({ type: "pit", x: 54 - 70 + 12, y: GROUND, w: 70, h: 0 }); // only the tail overlaps the dino's centre line
  update(edge);
  assert.equal(edge.over, false, "edge of a pit is forgiving");

  const sh = scene({ type: "pit", x: 30, y: GROUND, w: 70, h: 0 });
  sh.power.shield = 1;
  update(sh);
  assert.equal(sh.over, false, "shield saves you from a pit");
  assert.ok(sh.events.includes("shield"));
  assert.ok(sh.dino.vy < 0, "shield throws the dino back up");
  for (let i = 0; i < 90 && !sh.over; i++) update(sh);
  assert.equal(sh.over, false, "and the dino lands past the pit");
}

// ---- hopper ----
{
  const s = scene({ type: "hopper", x: 500, y: GROUND, w: 20, h: 20, vy: 0, wait: 0.1 });
  s.dino.y = -1e6;
  let peak = GROUND, landed = false;
  for (let i = 0; i < 90; i++) { s.dino.y = -1e6; s.dino.vy = 0; update(s); const h = s.obstacles[0]; peak = Math.min(peak, h.y); if (peak < GROUND - 40 && h.y >= GROUND) landed = true; }
  assert.ok(GROUND - peak > 55 && GROUND - peak < 70, `hopper peaks near 63px (got ${GROUND - peak})`);
  assert.ok(landed, "hopper comes back down");
}

// ---- roller is faster than the world ----
{
  const s = scene({ type: "roller", x: 500, y: GROUND, w: 18, h: 18 });
  s.obstacles.push({ type: "cactus", x: 500, y: GROUND, w: 14, h: 30, b: 0 });
  s.dino.y = -1e6;
  for (let i = 0; i < 20; i++) { s.dino.y = -1e6; s.dino.vy = 0; update(s); }
  const [roller, cactus] = s.obstacles;
  const ratio = (500 - roller.x) / (500 - cactus.x);
  assert.ok(Math.abs(ratio - 1.35) < 0.001, `roller moves 1.35x the world (got ${ratio})`);
}

// ---- geyser stays harmless until it is close, then erupts to a jumpable column ----
{
  const s = scene({ type: "geyser", x: 500, y: GROUND, w: 22, h: 0, erupt: false });
  s.dino.y = -1e6;
  const g = s.obstacles[0];
  assert.equal(g.h, 0);
  let erupted = false;
  for (let i = 0; i < 200 && !erupted; i++) {
    s.dino.y = -1e6; s.dino.vy = 0; update(s);
    if (s.events.includes("erupt")) { erupted = true; assert.ok(g.x < s.dino.x + 220 && g.x > s.dino.x + 200, `erupts about 220px out (x=${g.x})`); }
    else assert.equal(g.h, 0, "harmless before it erupts");
  }
  assert.ok(erupted);
  assert.equal(g.h, 75);
  const t = scene({ type: "geyser", x: 200, y: GROUND, w: 22, h: 0, erupt: false });
  press(t, "jump");
  for (let i = 0; i < 20 && !t.over; i++) update(t);
  assert.equal(t.over, false, "a column can be jumped");
}

// ---- lives, Zen, endRun ----
{
  const c = scene({ type: "cactus", x: 40, y: GROUND, w: 20, h: 30 }, "chill");
  update(c);
  assert.equal(c.over, false);
  assert.equal(c.lives, 2);
  assert.ok(c.invuln > 1.1);
  assert.ok(c.events.includes("hit"));
  c.obstacles.push({ type: "cactus", x: 40, y: GROUND, w: 20, h: 30, b: 0 });
  update(c);
  assert.equal(c.lives, 2, "invulnerable right after a hit");
  for (let hits = 0; hits < 2; hits++) {
    c.invuln = 0;
    c.obstacles.push({ type: "cactus", x: 40, y: GROUND, w: 20, h: 30, b: 0 });
    update(c);
  }
  assert.equal(c.over, true, "chill ends after the last heart");

  const h = scene({ type: "cactus", x: 40, y: GROUND, w: 20, h: 30 }, "hardcore");
  update(h);
  assert.equal(h.over, true, "hardcore has one life");

  const z = scene({ type: "cactus", x: 40, y: GROUND, w: 20, h: 30 }, "zen");
  z.speed = 600;
  update(z);
  assert.equal(z.over, false, "zen does not end on a hit");
  assert.ok(z.speed < 400 && z.speed >= 280, `zen knocks the speed back (${z.speed})`);
  endRun(z);
  assert.equal(z.over, true, "zen ends when the player ends it");
}

// ---- fairness: hazards never bunch up so tightly that a jump cannot cover them ----
{
  let minGap = Infinity, checked = 0;
  for (const diff of Object.keys(RULES)) {
    for (let seed = 1; seed <= 25; seed++) {
      observe(seed, diff, 9000, s => {
        const hz = s.obstacles.filter(o => !o.boss && o.x > s.dino.x).sort((a, b) => a.x - b.x);
        for (let i = 1; i < hz.length; i++) { minGap = Math.min(minGap, hz[i].x - (hz[i - 1].x + hz[i - 1].w)); checked++; }
      });
    }
  }
  assert.ok(checked > 1000, "fairness check saw plenty of hazard pairs");
  assert.ok(minGap >= 150, `hazards keep at least 150px between them (min was ${minGap.toFixed(1)}px)`);
}

// ---- coverage: every behaviour, biome, boss and pickup shows up without crashes ----
{
  const types = new Set(), events = new Set(), kinds = new Set();
  for (let seed = 1; seed <= 6; seed++) {
    const s = createSim(seed);
    while (s.frame < 20000 && s.score < 5200) {
      s.dino.y = -1e6; s.dino.vy = 0;
      update(s);
      for (const o of s.obstacles) types.add(o.type);
      for (const p of s.pickups) kinds.add(p.kind);
      for (const e of s.events) events.add(e.split(":")[0] === "boss" || e.startsWith("biome") ? e : e);
      s.events.length = 0;
    }
  }
  for (const t of ["cactus", "bird", "hopper", "roller", "pit", "geyser", "meteor", "wall"]) assert.ok(types.has(t), `obstacle type ${t} appears`);
  for (const b of BIOMES.slice(1)) assert.ok(events.has("biome:" + b), `biome ${b} is entered`);
  for (const b of ["swarm", "meteor", "wall"]) assert.ok(events.has("boss:" + b), `boss ${b} appears`);
  for (const k of ["coin", "shield", "slow", "dbl", "magnet"]) assert.ok(kinds.has(k), `pickup ${k} appears`);
  assert.ok(events.has("erupt"));
}

console.log("ok: sim tests pass (all difficulties, biomes, obstacles, fairness, coverage)");
