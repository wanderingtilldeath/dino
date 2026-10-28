// Run: node web/sim.test.js
import assert from "node:assert/strict";
import { createSim, press, update, GROUND } from "./sim.js";

// simple bot so runs last long enough to reach power-ups and bosses
function bot(s) {
  const cmds = [];
  const look = s.speed * 0.3, d = s.dino;
  const next = s.obstacles.filter(o => o.x + o.w > d.x && o.x < d.x + look).sort((a, b) => a.x - b.x)[0];
  const midBird = next && next.type === "bird" && next.y === GROUND - 24;
  if (midBird && !s.duck) cmds.push("duckDown");
  else if (!midBird && s.duck) cmds.push("duckUp");
  if (next && !midBird && d.y >= GROUND) cmds.push("jump");
  else if (next && s.power.dbl > 0 && d.vy > 0 && d.y < GROUND - 40) cmds.push("jump");
  return cmds;
}

function run(seed, frames = 20000) {
  const s = createSim(seed), log = [];
  while (s.frame < frames && !s.over) {
    for (const c of bot(s)) { log.push([s.frame, c]); press(s, c); }
    update(s);
  }
  return { s, log };
}

// replay a log the way the ghost does (web/game.js ghostStep): apply entries due by s.frame, then update
function replay(seed, log, frames) {
  const s = createSim(seed);
  let i = 0;
  while (s.frame < frames && !s.over) {
    while (i < log.length && log[i][0] <= s.frame) press(s, log[i++][1]);
    update(s);
  }
  return s;
}

const a = run(12345), b = run(12345);
assert.equal(a.s.score, b.s.score, "same seed + inputs -> same score");
assert.equal(a.s.frame, b.s.frame, "same seed + inputs -> same death frame");
assert.deepEqual(a.s.obstacles, b.s.obstacles);
assert.ok(a.s.frame > 600, `bot should survive past the first obstacles (died at frame ${a.s.frame})`);

const c = run(99999);
assert.notDeepEqual([a.s.score, a.s.frame], [c.s.score, c.s.frame], "different seed differs");

const r = replay(12345, a.log, a.s.frame);
assert.equal(r.score, a.s.score, "replaying the input log reproduces the run");
assert.equal(r.over, a.s.over);

// the high bird must actually be dodgeable by ducking, and hit a standing dino
const t = createSim(1);
t.obstacles.push({ type: "bird", x: t.dino.x, y: GROUND - 24, w: 28, h: 14 });
press(t, "duckDown");
update(t);
assert.equal(t.over, false, "ducking dino passes under mid bird");
const u = createSim(1);
u.obstacles.push({ type: "bird", x: u.dino.x, y: GROUND - 24, w: 28, h: 14 });
update(u);
assert.equal(u.over, true, "standing dino hits mid bird");

console.log(`ok (seed 12345: score ${Math.floor(a.s.score)}, frames ${a.s.frame}, over=${a.s.over}; seed 99999: ${Math.floor(c.s.score)})`);
