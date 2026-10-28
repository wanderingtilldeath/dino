// Skins and themes are draw-only: hitboxes live in sim.js, so they never affect gameplay or replays.
import { rr, isRetro } from "./art.js";
import { drawDinoRetro } from "./sprites.js";

export const SKINS = [
  { id: "classic", name: "Classic", at: 0 },
  { id: "cowboy", name: "Cowboy", at: 500 },
  { id: "ninja", name: "Ninja", at: 1500 },
  { id: "robot", name: "Robot", at: 3000 },
];

// Biomes (colors, obstacles, weather) are automatic by score now; this only picks how the canvas is drawn.
export const STYLES = [
  { id: "modern", name: "Modern", at: 0 },
  { id: "retro", name: "Retro pixel", at: 0 },
];

export function load(key, def) {
  try { return localStorage.getItem(key) ?? def; } catch { return def; }
}
export function save(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

// b = hitbox {x,y,w,h} (28x30 standing, 28x16 ducking); the dino is painted inside it.
// squash (0..1) is a cosmetic landing squish; the ghost passes 0.
export function drawDino(ctx, skin, b, fg, bg, frame, air, squash = 0) {
  if (isRetro()) return drawDinoRetro(ctx, skin, b, { fg, bg }, frame, air, squash);
  const duck = b.h < 20, X = b.x, Y = b.y;
  ctx.save();
  if (squash > 0) { // scale around the feet
    ctx.translate(X + 14, Y + b.h);
    ctx.scale(1 + 0.14 * squash, 1 - 0.16 * squash);
    ctx.translate(-(X + 14), -(Y + b.h));
  }
  ctx.fillStyle = fg;
  // tail
  ctx.beginPath();
  ctx.moveTo(X + 3, Y + (duck ? 4 : 11));
  ctx.lineTo(X - 7, Y + (duck ? 9 : 17));
  ctx.lineTo(X + 3, Y + (duck ? 12 : 20));
  ctx.closePath();
  ctx.fill();
  // body, head, legs
  const hx = duck ? 15 : 10, hy = 0, hw = duck ? 13 : 18, hh = duck ? 9 : 13;
  if (duck) rr(ctx, X, Y + 3, 22, 10, 5); else rr(ctx, X + 2, Y + 8, 18, 16, 6);
  rr(ctx, X + hx, Y + hy, hw, hh, 5);
  const step = Math.floor(frame / 5) % 2, legTop = Y + (duck ? 12 : 22), legH = duck ? 4 : 8;
  if (air) { rr(ctx, X + 5, legTop, 5, legH - 2, 2); rr(ctx, X + 12, legTop, 5, legH - 2, 2); }
  else {
    rr(ctx, X + 5, legTop, 5, step ? legH : legH - 4, 2);
    rr(ctx, X + 12, legTop, 5, step ? legH - 4 : legH, 2);
  }
  // eye (blinks for ~6 frames every 3 seconds)
  const ex = X + hx + hw - 6, ey = Y + (duck ? 4 : 5);
  if (skin === "robot") { ctx.fillStyle = "#ef4444"; rr(ctx, ex - 1.5, ey - 1.5, 4, 4, 1); }
  else if (frame % 180 < 6) { ctx.fillStyle = bg; ctx.fillRect(ex - 2, ey, 4, 1.2); }
  else { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ex, ey, 1.9, 0, Math.PI * 2); ctx.fill(); }

  const px = X + hx, py = Y + hy;
  if (skin === "cowboy") {
    ctx.fillStyle = "#8b5a2b";
    rr(ctx, px - 2, py - 3, hw + 4, 3, 1.5);
    rr(ctx, px + 3, py - 9, hw - 6, 7, 2.5);
  } else if (skin === "ninja") {
    ctx.fillStyle = "#d94a4a";
    rr(ctx, px, py + 2, hw, 3.5, 1.2);
    ctx.beginPath(); // fluttering band tail
    const f = Math.floor(frame / 8) % 2 ? 3 : 0;
    ctx.moveTo(px + 1, py + 3); ctx.lineTo(px - 9, py + 1 + f); ctx.lineTo(px - 7, py + 6 + f); ctx.lineTo(px + 1, py + 5);
    ctx.fill();
  } else if (skin === "robot") {
    ctx.fillStyle = "#ef4444";
    rr(ctx, px + hw / 2 - 1, py - 6, 2, 6, 1);
    ctx.beginPath(); ctx.arc(px + hw / 2, py - 7, 2.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
