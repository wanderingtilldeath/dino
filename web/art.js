// Flat vector drawing for the canvas. Cosmetic only: every shape sits inside the hitboxes defined in sim.js.
export const UI = 'ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif';
export const NUM = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
import { drawObstacleRetro, drawPickupRetro, drawHeartRetro, drawCloudRetro } from "./sprites.js";

export const H = 150; // canvas height in game units; GROUND is 130, so the ground band is 20px

// Retro style: sprites come from sprites.js, and the shared helpers below turn into hard-edged pixel versions
let retro = false;
export const isRetro = () => retro;
export function setRetro(v) { retro = v; }

// When set, filled shapes also get a thin outline in this colour. Accent-coloured hazards use it (see drawObstacle) so
// their silhouette stays readable at dusk, when the accent fill and the sky are nearly the same colour.
let edge = null;
function outline(ctx) {
  if (!edge) return;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

// shortcut: ctx.roundRect needs Chrome 99 / Safari 16 / Firefox 112; older browsers get square corners.
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect && !retro) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fill();
  outline(ctx);
}
export function rrStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect && !retro) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.stroke();
}
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
}
// isosceles triangle: base (ax..cx at ay), apex (bx, by). Retro draws it as stacked 4px bands.
function tri(ctx, ax, ay, bx, by, cx, cy) {
  if (!retro) return poly(ctx, [[ax, ay], [bx, by], [cx, cy]]);
  const h = ay - by, half = (cx - ax) / 2;
  for (let y = by; y < ay; y += 4) {
    const hw = (half * (y + 2 - by)) / h;
    ctx.fillRect(Math.round(bx - hw), Math.round(y), Math.max(2, Math.round(2 * hw)), Math.min(4, ay - y));
  }
}
const circle = (ctx, x, y, r) => {
  if (!retro) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); outline(ctx); return; }
  for (let dy = -r; dy < r; dy += 3) { // pixel disc: rows of 3px
    const hw = Math.sqrt(Math.max(0, r * r - (dy + 1.5) * (dy + 1.5)));
    ctx.fillRect(Math.round(x - hw), Math.round(y + dy), Math.max(2, Math.round(2 * hw)), 3);
  }
};
export const disc = circle;

const wrap = (v, m) => ((v % m) + m) % m;
const triWave = t => 1 - Math.abs((((t % 2) + 2) % 2) - 1); // 0..1 zigzag
const CLOUDS = [[90, 34, 1], [380, 52, 0.8], [650, 28, 1.15]]; // x, y, scale, repeating every 900px

// a skyline: smooth in Modern, stair-stepped (8px wide, 4px tall steps) in Retro
function skyline(ctx, W, GROUND, step, heightAt) {
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = 0; x <= W; x += step) {
    const y = GROUND - heightAt(x);
    if (retro) { const ys = Math.round(y / 4) * 4; ctx.lineTo(x, ys); ctx.lineTo(x + step, ys); } else ctx.lineTo(x, y);
  }
  ctx.lineTo(W, GROUND);
  ctx.closePath();
  ctx.fill();
}

function hills(ctx, W, GROUND, dist, alpha, speed, amp, base, k) {
  ctx.globalAlpha = alpha;
  const off = dist * speed;
  skyline(ctx, W, GROUND, 8, x => base + amp * Math.sin((x + off) / k) + (amp / 3) * Math.sin((x + off) / (k / 2.3) + 1));
}

function peaks(ctx, W, GROUND, dist, alpha, speed, size, base, amp) {
  ctx.globalAlpha = alpha;
  const off = dist * speed;
  skyline(ctx, W, GROUND, retro ? 8 : 6, x => base + amp * triWave((x + off) / size) + amp * 0.45 * triWave((x + off) / (size * 0.37) + 0.3));
}

function clouds(ctx, sky, dist) {
  ctx.globalAlpha = 0.12 * (1 - sky.night * 0.5);
  for (const [cx, cy, sc] of CLOUDS) {
    const x = wrap(cx - dist * 0.25, 900) - 120;
    if (retro) { drawCloudRetro(ctx, x, cy - 6 * sc, 64 * sc); continue; }
    rr(ctx, x, cy, 60 * sc, 12 * sc, 6 * sc);
    rr(ctx, x + 12 * sc, cy - 8 * sc, 30 * sc, 14 * sc, 7 * sc);
  }
}

// each biome has its own far/mid layers; sky.biome switches at the blend midpoint so layers never double up
export function drawParallax(ctx, sky, dist, W, GROUND) {
  ctx.fillStyle = sky.fg;
  switch (sky.biome) {
    case "forest":
      hills(ctx, W, GROUND, dist, 0.06, 0.08, 12, 30, 90);
      ctx.globalAlpha = 0.13;
      for (let i = 0; i < 14; i++) { // pine silhouettes
        const x = wrap(i * 46 - dist * 0.2, W + 60) - 30, h = 28 + ((i * 7) % 15);
        tri(ctx, x, GROUND, x + 11, GROUND - h, x + 22, GROUND);
        tri(ctx, x + 2, GROUND - h * 0.45, x + 11, GROUND - h - 6, x + 20, GROUND - h * 0.45);
      }
      clouds(ctx, sky, dist);
      break;
    case "snow":
      peaks(ctx, W, GROUND, dist, 0.07, 0.07, 120, 24, 36);
      peaks(ctx, W, GROUND, dist, 0.09, 0.16, 70, 12, 22);
      clouds(ctx, sky, dist);
      break;
    case "volcano": {
      peaks(ctx, W, GROUND, dist, 0.08, 0.1, 80, 14, 26);
      const vx = wrap(360 - dist * 0.06, 900) - 150; // one big cone with a glowing crater
      ctx.globalAlpha = 0.14;
      tri(ctx, vx, GROUND, vx + 110, GROUND - 78, vx + 220, GROUND);
      ctx.fillStyle = sky.accent;
      ctx.globalAlpha = 0.4;
      rr(ctx, vx + 92, GROUND - 82, 36, 7, 3);
      ctx.globalAlpha = 0.22;
      circle(ctx, vx + 110, GROUND - 84, 16);
      ctx.fillStyle = sky.fg;
      clouds(ctx, sky, dist); // ash clouds
      break;
    }
    case "space": {
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 22; i++) ctx.fillRect(wrap(i * 53 - dist * 0.1, W), (i * 37) % 100, 1.5, 1.5); // drifting stars
      const px = wrap(170 - dist * 0.04, 760) - 80;
      ctx.globalAlpha = 0.16;
      circle(ctx, px, 52, 24);
      if (!retro) { // planet ring; Retro keeps just the pixel disc
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = sky.fg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(px, 52, 40, 9, -0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.12;
      circle(ctx, wrap(520 - dist * 0.07, 800) - 60, 30, 9);
      hills(ctx, W, GROUND, dist, 0.07, 0.12, 8, 14, 60); // low craters on the horizon
      break;
    }
    default: // desert
      hills(ctx, W, GROUND, dist, 0.06, 0.08, 16, 34, 90);
      hills(ctx, W, GROUND, dist, 0.09, 0.18, 10, 20, 55);
      clouds(ctx, sky, dist);
  }
  ctx.fillStyle = sky.fg;
  ctx.globalAlpha = 0.07; // ground band
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 14; i++) ctx.fillRect(wrap(i * 97 - dist, W + 20) - 10, GROUND + 5 + ((i * 7) % 11), 3 + (i % 3), 2);
  ctx.globalAlpha = 1;
}

function cactusArt(ctx, o, sky) {
  const x = o.x, top = o.y - o.h, b = o.b ?? 0;
  if (b === 1) { // stump with a leafy top
    ctx.fillStyle = sky.fg;
    ctx.globalAlpha = 0.85;
    rr(ctx, x, top + 8, o.w, o.h - 8, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = sky.accent;
    rr(ctx, x - 4, top, o.w + 8, 12, 6);
    ctx.fillStyle = sky.bg;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + 3, top + 16, o.w - 6, 2);
    ctx.fillRect(x + 3, top + 26, o.w - 6, 2);
    ctx.globalAlpha = 1;
  } else if (b === 2) { // ice spikes
    ctx.fillStyle = sky.accent;
    tri(ctx, x, o.y, x + o.w / 2, top, x + o.w, o.y);
    tri(ctx, x - 7, o.y, x - 2, top + o.h * 0.45, x + 4, o.y);
    tri(ctx, x + o.w - 3, o.y, x + o.w + 3, top + o.h * 0.55, x + o.w + 9, o.y);
    ctx.fillStyle = "rgba(255,255,255,.45)";
    tri(ctx, x + o.w / 2 - 2, top + 6, x + o.w / 2, top, x + o.w / 2 + 2, top + 6);
  } else if (b === 3) { // basalt rock with lava cracks
    ctx.fillStyle = sky.fg;
    ctx.globalAlpha = 0.8;
    poly(ctx, [[x, o.y], [x + o.w * 0.15, top + o.h * 0.35], [x + o.w * 0.45, top], [x + o.w * 0.8, top + o.h * 0.25], [x + o.w, o.y]]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = sky.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + o.w * 0.4, top + 3); ctx.lineTo(x + o.w * 0.5, top + o.h * 0.5); ctx.lineTo(x + o.w * 0.35, o.y - 2);
    ctx.stroke();
  } else if (b === 4) { // crystal
    ctx.fillStyle = sky.accent;
    poly(ctx, [[x + o.w / 2, top], [x + o.w, top + o.h * 0.35], [x + o.w * 0.75, o.y], [x + o.w * 0.25, o.y], [x, top + o.h * 0.35]]);
    ctx.fillStyle = "rgba(255,255,255,.4)";
    tri(ctx, x + o.w / 2, top + 2, x + o.w * 0.78, top + o.h * 0.35, x + o.w / 2, top + o.h * 0.5);
  } else { // cactus
    ctx.fillStyle = sky.accent;
    rr(ctx, x, top, o.w, o.h, o.w / 2);
    rr(ctx, x - 6, o.y - o.h * 0.62, 7, 5, 2.5);
    rr(ctx, x - 6, o.y - o.h * 0.62 - 8, 5, 12, 2.5);
    rr(ctx, x + o.w - 1, o.y - o.h * 0.45, 7, 5, 2.5);
    rr(ctx, x + o.w + 1, o.y - o.h * 0.45 - 8, 5, 12, 2.5);
  }
}

function hopperArt(ctx, o, sky) {
  const x = o.x, top = o.y - o.h, air = o.y < 129.5;
  ctx.fillStyle = sky.accent;
  rr(ctx, x, top + (air ? 0 : 3), o.w, o.h - (air ? 0 : 3), 8); // squashes down on the ground
  ctx.fillStyle = "#fff";
  circle(ctx, x + 6, top + 8, 3.2);
  circle(ctx, x + 14, top + 8, 3.2);
  ctx.fillStyle = sky.bg;
  circle(ctx, x + 7, top + 8.5, 1.4);
  circle(ctx, x + 15, top + 8.5, 1.4);
  ctx.fillStyle = sky.fg;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(x + 3, o.y - 3, 5, 3); // feet
  ctx.fillRect(x + o.w - 8, o.y - 3, 5, 3);
  ctx.globalAlpha = 1;
}

function rollerArt(ctx, o, sky) {
  const cx = o.x + o.w / 2, cy = o.y - o.h / 2, r = o.w / 2, b = o.b ?? 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-o.x / 8); // rolls with its own motion
  if (b === 2) { // snowball
    ctx.fillStyle = "#f4f8ff";
    circle(ctx, 0, 0, r);
    ctx.strokeStyle = sky.fg;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.moveTo(-3, -2); ctx.lineTo(4, 3); ctx.stroke();
  } else if (b === 3) { // boulder with embers
    ctx.fillStyle = sky.fg;
    ctx.globalAlpha = 0.85;
    circle(ctx, 0, 0, r);
    ctx.globalAlpha = 1;
    ctx.fillStyle = sky.accent;
    circle(ctx, -3, -2, 2); circle(ctx, 3, 3, 1.6);
  } else { // tumbleweed
    ctx.strokeStyle = sky.fg;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; ctx.moveTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1)); ctx.lineTo(-Math.cos(a) * (r - 1), -Math.sin(a) * (r - 1)); }
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function pitArt(ctx, o, sky, W, GROUND, frame) {
  const b = o.b ?? 0, x = o.x, h = H - GROUND;
  ctx.fillStyle = sky.bg;
  ctx.fillRect(x, GROUND - 1, o.w, h + 1); // cut the hole through the ground line
  if (b === 3) { // lava
    ctx.fillStyle = sky.accent;
    ctx.globalAlpha = 0.6 + 0.2 * Math.sin(frame / 6);
    ctx.fillRect(x, GROUND + 4, o.w, h - 4);
  } else {
    ctx.fillStyle = "#000";
    ctx.globalAlpha = b === 4 ? 0.4 : 0.26;
    ctx.fillRect(x, GROUND, o.w, h);
  }
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = sky.fg;
  ctx.fillRect(x - 1, GROUND, 2, h); // lips
  ctx.fillRect(x + o.w - 1, GROUND, 2, h);
  if (b === 2) { // ice crack
    ctx.strokeStyle = sky.fg;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 4, GROUND + 2); ctx.lineTo(x + o.w * 0.35, GROUND + 9); ctx.lineTo(x + o.w * 0.55, GROUND + 5); ctx.lineTo(x + o.w - 4, GROUND + 12); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function geyserArt(ctx, o, sky, frame) {
  const cx = o.x + o.w / 2;
  ctx.fillStyle = sky.fg;
  ctx.globalAlpha = 0.8;
  rr(ctx, o.x - 2, o.y - 8, o.w + 4, 8, 3); // vent mound
  ctx.globalAlpha = 1;
  if (o.erupt) {
    const g = ctx.createLinearGradient(0, o.y - o.h, 0, o.y);
    g.addColorStop(0, "#ffd166");
    g.addColorStop(1, sky.accent);
    ctx.fillStyle = g;
    rr(ctx, o.x + 3, o.y - o.h, o.w - 6, o.h - 4, 8);
    ctx.fillStyle = "#ffd166";
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(frame / 2);
    circle(ctx, cx, o.y - o.h, 6 + 2 * Math.sin(frame / 3));
    ctx.globalAlpha = 1;
  } else if (o.x < 370) { // telegraph: the vent glows and bubbles before it erupts
    ctx.fillStyle = sky.accent;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(frame / 4);
    circle(ctx, cx, o.y - 8, 12);
    ctx.globalAlpha = 0.9;
    circle(ctx, cx + Math.sin(frame / 5) * 3, o.y - 12 - ((frame / 2) % 8), 2);
    ctx.globalAlpha = 1;
  }
}

export function drawObstacle(ctx, o, sky, frame, W = 600, GROUND = 130) {
  if (retro && o.type !== "pit") return drawObstacleRetro(ctx, o, sky, frame);
  if (o.type === "cactus" || o.type === "hopper" || o.type === "wall") edge = sky.fg;
  try { drawObstacleModern(ctx, o, sky, frame, W, GROUND); } finally { edge = null; }
}

function drawObstacleModern(ctx, o, sky, frame, W, GROUND) {
  const x = o.x, top = o.y - o.h, b = o.b ?? 0;
  if (o.type === "cactus") cactusArt(ctx, o, sky);
  else if (o.type === "hopper") hopperArt(ctx, o, sky);
  else if (o.type === "roller") rollerArt(ctx, o, sky);
  else if (o.type === "pit") pitArt(ctx, o, sky, W, GROUND, frame);
  else if (o.type === "geyser") geyserArt(ctx, o, sky, frame);
  else if (o.type === "bird") {
    const up = Math.floor(frame / 8) % 2 === 0;
    ctx.fillStyle = sky.fg;
    if (b === 4) { // drone
      rr(ctx, x, top + 3, o.w, o.h - 5, 5);
      ctx.fillRect(x + 4, top, o.w - 8, 2);
      ctx.fillRect(x + (up ? 2 : 10), top - 1, 10, 2);
      ctx.fillStyle = "#ef4444";
      circle(ctx, x + o.w - 6, top + 7, 1.8);
    } else {
      rr(ctx, x, top + 2, o.w, o.h - 3, 7);
      ctx.fillStyle = "#e8a33b"; // beak
      tri(ctx, x + o.w - 1, top + 5, x + o.w + 7, top + 9, x + o.w - 1, top + 12);
      ctx.fillStyle = sky.fg;
      if (up) tri(ctx, x + 7, top + 4, x + 15, top - 9, x + 21, top + 4);
      else tri(ctx, x + 7, top + 10, x + 15, top + o.h + 7, x + 21, top + 10);
      ctx.fillStyle = sky.bg;
      circle(ctx, x + o.w - 7, top + 7, 1.6);
    }
  } else if (o.type === "meteor") {
    const cx = x + o.w / 2, cy = top + o.h / 2;
    ctx.fillStyle = "#e8714a";
    for (let k = 3; k >= 1; k--) { // trail up and to the right (it falls while the world scrolls left)
      ctx.globalAlpha = 0.18 * (4 - k);
      circle(ctx, cx + k * 7, cy - k * 6, 8 - k * 1.5);
    }
    ctx.globalAlpha = 1;
    circle(ctx, cx, cy, o.w / 2);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    circle(ctx, cx - 3, cy - 3, 3);
  } else { // wall
    ctx.fillStyle = sky.accent;
    rr(ctx, x, top, o.w, o.h, 7);
    ctx.fillStyle = "rgba(255,255,255,.22)";
    for (let y = top + 12; y < o.y - 6; y += 14) ctx.fillRect(x + 4, y, o.w - 8, 2);
  }
}

export const POWER_COLOR = { shield: "#3b82f6", slow: "#8b5cf6", dbl: "#10b981", magnet: "#ef4444" };
const POWER_LABEL = { shield: "S", slow: "T", dbl: "D", magnet: "M" };

export function drawPickup(ctx, c, frame) {
  if (retro) return drawPickupRetro(ctx, c, frame, POWER_COLOR[c.kind]);
  const bob = Math.sin(frame / 10 + c.x / 40) * 2;
  if (c.kind === "coin") {
    ctx.fillStyle = "#f2b632";
    circle(ctx, c.x + 6, c.y - 6 + bob, 6.5);
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(c.x + 6, c.y - 6 + bob, 3.6, 0, Math.PI * 2); ctx.stroke();
    return;
  }
  ctx.fillStyle = POWER_COLOR[c.kind];
  rr(ctx, c.x, c.y - c.h + bob, c.w, c.h, 6);
  ctx.fillStyle = "#fff";
  ctx.font = `700 11px ${UI}`;
  ctx.textAlign = "center";
  ctx.fillText(POWER_LABEL[c.kind], c.x + c.w / 2, c.y - 4 + bob);
}

export function drawHeart(ctx, x, y, s, color) {
  if (retro) return drawHeartRetro(ctx, x, y, s, color);
  ctx.fillStyle = color;
  circle(ctx, x + s * 0.28, y + s * 0.3, s * 0.28);
  circle(ctx, x + s * 0.72, y + s * 0.3, s * 0.28);
  tri(ctx, x + 0.02 * s, y + s * 0.4, x + s * 0.98, y + s * 0.4, x + s / 2, y + s * 0.95);
}
