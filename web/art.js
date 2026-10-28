// Flat vector drawing for the canvas. Cosmetic only: every shape sits inside the hitboxes defined in sim.js.
export const UI = 'ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif';
export const NUM = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

// shortcut: ctx.roundRect needs Chrome 99 / Safari 16 / Firefox 112; older browsers get square corners.
export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.fill();
}
export function rrStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  ctx.stroke();
}
function tri(ctx, ax, ay, bx, by, cx, cy) {
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
}

const wrap = (v, m) => ((v % m) + m) % m;
const CLOUDS = [[90, 34, 1], [380, 52, 0.8], [650, 28, 1.15]]; // x, y, scale, repeating every 900px

// far hills, clouds and ground specks scroll at different speeds; dist comes from the sim so slow-mo and death are respected
export function drawParallax(ctx, sky, dist, W, GROUND) {
  ctx.fillStyle = sky.fg;
  for (const [alpha, speed, amp, base, k] of [[0.06, 0.08, 16, 34, 90], [0.09, 0.18, 10, 20, 55]]) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    const off = dist * speed;
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, GROUND - base - amp * Math.sin((x + off) / k) - (amp / 3) * Math.sin((x + off) / (k / 2.3) + 1));
    ctx.lineTo(W, GROUND);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 0.12 * (1 - sky.night * 0.5);
  for (const [cx, cy, sc] of CLOUDS) {
    const x = wrap(cx - dist * 0.25, 900) - 120;
    rr(ctx, x, cy, 60 * sc, 12 * sc, 6 * sc);
    rr(ctx, x + 12 * sc, cy - 8 * sc, 30 * sc, 14 * sc, 7 * sc);
  }
  ctx.globalAlpha = 0.07; // ground band
  ctx.fillRect(0, GROUND, W, 20);
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 14; i++) ctx.fillRect(wrap(i * 97 - dist, W + 20) - 10, GROUND + 5 + ((i * 7) % 11), 3 + (i % 3), 2);
  ctx.globalAlpha = 1;
}

export function drawObstacle(ctx, o, sky, frame) {
  const x = o.x, top = o.y - o.h;
  if (o.type === "cactus") {
    ctx.fillStyle = sky.accent;
    rr(ctx, x, top, o.w, o.h, o.w / 2);
    rr(ctx, x - 6, o.y - o.h * 0.62, 7, 5, 2.5);
    rr(ctx, x - 6, o.y - o.h * 0.62 - 8, 5, 12, 2.5);
    rr(ctx, x + o.w - 1, o.y - o.h * 0.45, 7, 5, 2.5);
    rr(ctx, x + o.w + 1, o.y - o.h * 0.45 - 8, 5, 12, 2.5);
  } else if (o.type === "bird") {
    const up = Math.floor(frame / 8) % 2 === 0;
    ctx.fillStyle = sky.fg;
    rr(ctx, x, top + 2, o.w, o.h - 3, 7);
    ctx.fillStyle = "#e8a33b"; // beak
    tri(ctx, x + o.w - 1, top + 5, x + o.w + 7, top + 9, x + o.w - 1, top + 12);
    ctx.fillStyle = sky.fg;
    if (up) tri(ctx, x + 7, top + 4, x + 15, top - 9, x + 21, top + 4);
    else tri(ctx, x + 7, top + 10, x + 15, top + o.h + 7, x + 21, top + 10);
    ctx.fillStyle = sky.bg;
    ctx.beginPath(); ctx.arc(x + o.w - 7, top + 7, 1.6, 0, Math.PI * 2); ctx.fill();
  } else if (o.type === "meteor") {
    const cx = x + o.w / 2, cy = top + o.h / 2;
    ctx.fillStyle = "#e8714a";
    for (let k = 3; k >= 1; k--) { // trail up and to the right (it falls while the world scrolls left)
      ctx.globalAlpha = 0.18 * (4 - k);
      ctx.beginPath(); ctx.arc(cx + k * 7, cy - k * 6, 8 - k * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(cx, cy, o.w / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.beginPath(); ctx.arc(cx - 3, cy - 3, 3, 0, Math.PI * 2); ctx.fill();
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
  const bob = Math.sin(frame / 10 + c.x / 40) * 2;
  if (c.kind === "coin") {
    ctx.fillStyle = "#f2b632";
    ctx.beginPath(); ctx.arc(c.x + 6, c.y - 6 + bob, 6.5, 0, Math.PI * 2); ctx.fill();
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
