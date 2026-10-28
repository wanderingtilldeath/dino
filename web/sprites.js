// Retro pixel style: sprites are string grids drawn as pixel-snapped rects, stretched to the sim hitbox so what you see
// is always what collides. Original art. Self-contained (no imports) so art.js and skins.js can both use it.
// Palette chars: # ink, a accent, e background (eyes), w white, r red, o orange, y yellow, b brown, k shadow, . empty

const DINO_TOP = [
  "......########",
  "......##e#####",
  "......########",
  "......#######.",
  "......####....",
  "......####....",
  "....########..",
  "..##########..",
  "###########.##",
  ".###########..",
  "..##########..",
  "...########...",
];
const DINO_RUN_A = [...DINO_TOP, "....##..##....", "....##........", "....###......."];
const DINO_RUN_B = [...DINO_TOP, "....##..##....", "........##....", "........###..."];
const DINO_JUMP = [...DINO_TOP, "....##..##....", "....##..##....", ".............."];
const DUCK_TOP = [
  "........######",
  "........##e###",
  "........######",
  "#.##########..",
  "############..",
  ".###########..",
  "..##########..",
];
const DINO_DUCK_A = [...DUCK_TOP, "....##..##...."];
const DINO_DUCK_B = [...DUCK_TOP, "...##..##....."];

// cactus-behaviour obstacles by biome: cactus, stump, ice spike, basalt rock, crystal
const STATIC = [
  ["...aa...", "...aa...", ".a.aa.a.", ".a.aa.a.", ".aaaaaa.", "...aa...", "...aa...", "...aa..."],
  ["..aaaa..", ".aaaaaa.", "aaaaaaaa", "..####..", "..#e##..", "..####..", "..####..", ".######."],
  ["...ww...", "...aa...", "..aaaa..", "..aaaa..", ".aaaaaa.", ".aaaaaa.", "aaaaaaaa", "aaaaaaaa"],
  ["..####..", ".######.", "###o####", "###o####", "####o###", "####o###", "########", "########"],
  ["...aa...", "..aaaa..", ".aawaaa.", "aaawaaaa", "aaawaaaa", ".aaaaaa.", "..aaaa..", "...aa..."],
];

const BIRD_UP = [
  "....#.........",
  "....##........",
  "....###.......",
  ".##########...",
  "..#########eoo",
  "...#######....",
  "..............",
];
const BIRD_DOWN = [
  "..............",
  ".##########...",
  "..#########eoo",
  "...#######....",
  "....###.......",
  "....##........",
  "....#.........",
];
const DRONE_A = ["..##########..", "......##......", ".############.", "############r#", ".############.", "..##......##..", ".............."].map(r => r.padEnd(14, ".").slice(0, 14));
const DRONE_B = ["....######....", "......##......", ".############.", "############r#", ".############.", "..##......##..", ".............."].map(r => r.padEnd(14, ".").slice(0, 14));

const HOPPER = ["..aaaaaa..", ".aaaaaaaa.", "aaaaaaaaaa", "aawwaawwaa", "aaweaaweaa", "aaaaaaaaaa", "aaaaaaaaaa", ".aaaaaaaa.", "..##..##..", "..##..##.."];
const WEED_A = ["..####..", ".#.##.#.", "#..##..#", "########", "########", "#..##..#", ".#.##.#.", "..####.."];
const WEED_B = ["..####..", ".##..##.", "#.#..#.#", "#..##..#", "#..##..#", "#.#..#.#", ".##..##.", "..####.."];
const SNOWBALL = ["..wwww..", ".wwwwww.", "wwwwwwww", "wwww#www", "wwwwwwww", "www#wwww", ".wwwwww.", "..wwww.."];
const BOULDER = ["..####..", ".######.", "###o####", "########", "####o###", "########", ".######.", "..####.."];
const METEOR = ["..oooo..", ".oyoooo.", "oyoooooo", "oooooooo", "oooooooo", "oooooooo", ".oooooo.", "..oooo.."];
const VENT = ["..########..", ".##########.", "############", "############"];
const COIN_A = ["..yyyy..", ".yywyyy.", "yywyyyyy", "yywyyyyy", "yyyyyyyy", "yyyyyyyy", ".yyyyyy.", "..yyyy.."];
const COIN_B = ["...yy...", "..yyyy..", "..ywyy..", "..ywyy..", "..yyyy..", "..yyyy..", "..yyyy..", "...yy..."];
const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
const CLOUD = ["....####........", "..#########.##..", ".##############.", "################"];

// 3x5 pixel font: digits plus the few letters the HUD needs
const FONT = {
  0: ["###", "#.#", "#.#", "#.#", "###"], 1: [".#.", "##.", ".#.", ".#.", "###"], 2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", "###", "..#", "###"], 4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "###", "..#", "###"],
  6: ["###", "#..", "###", "#.#", "###"], 7: ["###", "..#", "..#", ".#.", ".#."], 8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "###"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
  S: ["###", "#..", "###", "..#", "###"], T: ["###", ".#.", ".#.", ".#.", ".#."], D: ["##.", "#.#", "#.#", "#.#", "##."],
  M: ["#.#", "###", "###", "#.#", "#.#"],
};

export const GRIDS = { DINO_RUN_A, DINO_RUN_B, DINO_JUMP, DINO_DUCK_A, DINO_DUCK_B, STATIC, BIRD_UP, BIRD_DOWN, DRONE_A, DRONE_B, HOPPER, WEED_A, WEED_B, SNOWBALL, BOULDER, METEOR, VENT, COIN_A, COIN_B, HEART, CLOUD };
export { FONT };

// colours come from the live sky, so a sprite recolours itself with day/night and biome
function palette(sky) {
  return sky._p ||= ch => (
    ch === "#" ? sky.fg : ch === "a" ? sky.accent : ch === "e" ? sky.bg : ch === "w" ? "#fff" : ch === "r" ? "#ef4444" :
    ch === "o" ? "#e8714a" : ch === "y" ? "#f2b632" : ch === "b" ? "#8b5a2b" : ch === "k" ? "rgba(0,0,0,.45)" : null);
}

// each run of same-coloured cells is one fillRect, snapped to whole pixels so scaled sprites never show seams
export function fillGrid(ctx, rows, x, y, w, h, color) {
  const gh = rows.length, gw = rows[0].length, cw = w / gw, ch = h / gh;
  for (let r = 0; r < gh; r++) {
    const y0 = Math.round(y + r * ch), y1 = Math.round(y + (r + 1) * ch), row = rows[r];
    for (let c = 0; c < gw;) {
      let e = c + 1;
      while (e < gw && row[e] === row[c]) e++;
      const col = color(row[c]);
      if (col) {
        ctx.fillStyle = col;
        const x0 = Math.round(x + c * cw), x1 = Math.round(x + e * cw);
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      c = e;
    }
  }
}

// ink outline around a sprite (the sprite drawn four times, one pixel off, in the ink colour): accent-coloured hazards stay
// readable at dusk, when the accent fill and the sky are nearly the same colour
function outlined(ctx, rows, x, y, w, h, p, ink) {
  const solid = ch => (ch === "." ? null : ink);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fillGrid(ctx, rows, x + dx, y + dy, w, h, solid);
  fillGrid(ctx, rows, x, y, w, h, p);
}

export function drawPixelText(ctx, str, x, y, scale, color, align = "left") {
  const adv = 4 * scale, width = str.length * adv - scale;
  let cx = align === "right" ? x - width : x;
  ctx.fillStyle = color;
  for (const ch of str) {
    const g = FONT[ch];
    if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === "#") ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
    cx += adv;
  }
}

// b = dino hitbox (28x30 standing, 28x16 ducking) = exactly 2x the 14x15 / 14x8 grids
export function drawDinoRetro(ctx, skin, b, sky, frame, air, squash = 0) {
  const duck = b.h < 20, p = palette(sky), X = b.x, Y = b.y;
  const step = Math.floor(frame / 5) % 2;
  const grid = duck ? (step ? DINO_DUCK_A : DINO_DUCK_B) : air ? DINO_JUMP : step ? DINO_RUN_A : DINO_RUN_B;
  const blink = frame % 180 < 6;
  ctx.save();
  if (squash > 0) { // scale around the feet
    ctx.translate(X + 14, Y + b.h);
    ctx.scale(1 + 0.14 * squash, 1 - 0.16 * squash);
    ctx.translate(-(X + 14), -(Y + b.h));
  }
  fillGrid(ctx, grid, X, Y, 28, b.h, ch => (ch === "e" ? (skin === "robot" ? "#ef4444" : blink ? sky.fg : sky.bg) : p(ch)));
  const hx = duck ? 8 : 6, hw = duck ? 6 : 8, cell = 2;
  if (skin === "cowboy") {
    fillGrid(ctx, ["...bbbb...", "...bbbb...", "bbbbbbbbbb"], X + (hx + hw - 9) * cell, Y - 6, 20, 6, p);
  } else if (skin === "ninja") {
    ctx.fillStyle = "#d94a4a";
    ctx.fillRect(X + hx * cell, Y, hw * cell, 2);
    const f = Math.floor(frame / 8) % 2 ? 2 : 0; // fluttering band tail
    ctx.fillRect(X + (hx - 3) * cell, Y + f, 6, 2);
    ctx.fillRect(X + (hx - 5) * cell, Y + 2 + f, 4, 2);
  } else if (skin === "robot") {
    ctx.fillStyle = sky.fg;
    ctx.fillRect(X + (hx + 3) * cell, Y - 6, 2, 6);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(X + (hx + 3) * cell - 1, Y - 8, 4, 4);
  }
  ctx.restore();
}

// o = sim obstacle (hitbox o.x, o.y bottom, o.w, o.h); pits are drawn by art.js
export function drawObstacleRetro(ctx, o, sky, frame) {
  const p = palette(sky), x = o.x, top = o.y - o.h, b = o.b ?? 0;
  if (o.type === "cactus") outlined(ctx, STATIC[b], x, top, o.w, o.h, p, sky.fg);
  else if (o.type === "bird") fillGrid(ctx, b === 4 ? (Math.floor(frame / 8) % 2 ? DRONE_A : DRONE_B) : Math.floor(frame / 8) % 2 ? BIRD_UP : BIRD_DOWN, x, top, o.w, o.h, p);
  else if (o.type === "hopper") outlined(ctx, HOPPER, x, top, o.w, o.h, p, sky.fg);
  else if (o.type === "roller") outlined(ctx, b === 2 ? SNOWBALL : b === 3 ? BOULDER : Math.floor(o.x / 6) % 2 ? WEED_A : WEED_B, x, top, o.w, o.h, p, sky.fg);
  else if (o.type === "meteor") {
    ctx.fillStyle = "#e8714a";
    for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.2 * (4 - k); ctx.fillRect(Math.round(x + o.w + k * 6), Math.round(top - k * 5 + 4), 6, 6); }
    ctx.globalAlpha = 1;
    fillGrid(ctx, METEOR, x, top, o.w, o.h, p);
  } else if (o.type === "geyser") {
    fillGrid(ctx, VENT, x - 2, o.y - 6, o.w + 4, 6, p);
    if (o.erupt) {
      for (let y = top; y < o.y - 6; y += 4) { // banded flame column
        const band = Math.floor((o.y - y) / 4 + frame / 3) % 3;
        ctx.fillStyle = band === 0 ? "#ffd166" : band === 1 ? "#e8714a" : sky.accent;
        ctx.fillRect(Math.round(x + 4 + (band === 1 ? -1 : 0)), Math.round(y), Math.round(o.w - 8 + (band === 1 ? 2 : 0)), Math.min(4, o.y - 6 - y));
      }
    } else if (o.x < 370) { // telegraph: pulsing glow and a rising spark
      ctx.fillStyle = sky.accent;
      ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(frame / 5));
      ctx.fillRect(Math.round(x + 2), Math.round(o.y - 14), Math.round(o.w - 4), 6);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(Math.round(x + o.w / 2 + Math.sin(frame / 5) * 3), Math.round(o.y - 16 - (frame / 2) % 8), 2, 2);
      ctx.globalAlpha = 1;
    }
  } else { // wall: bricks
    ctx.fillStyle = sky.fg;
    ctx.fillRect(x - 1, top - 1, o.w + 2, o.h + 1);
    ctx.fillStyle = sky.accent;
    ctx.fillRect(x, top, o.w, o.h);
    ctx.fillStyle = sky.bg;
    ctx.globalAlpha = 0.45;
    for (let y = top + 6, row = 0; y < o.y; y += 6, row++) {
      ctx.fillRect(x, y, o.w, 1);
      ctx.fillRect(Math.round(x + (row % 2 ? o.w * 0.3 : o.w * 0.7)), y - 6, 1, 6);
    }
    ctx.globalAlpha = 1;
  }
}

export function drawPickupRetro(ctx, c, frame, color) {
  const bob = Math.round(Math.sin(frame / 10 + c.x / 40) * 2);
  if (c.kind === "coin") {
    fillGrid(ctx, Math.floor(frame / 8) % 2 ? COIN_A : COIN_B, Math.round(c.x), Math.round(c.y - 12 + bob), 12, 12, ch => (ch === "y" ? "#f2b632" : ch === "w" ? "#fff" : null));
    return;
  }
  const x = Math.round(c.x), y = Math.round(c.y - c.h + bob);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, c.w, c.h);
  ctx.fillStyle = "rgba(255,255,255,.35)";
  ctx.fillRect(x, y, c.w, 2); // top highlight
  const letter = { shield: "S", slow: "T", dbl: "D", magnet: "M" }[c.kind];
  drawPixelText(ctx, letter, x + 5, y + 3, 2, "#fff");
}

export function drawHeartRetro(ctx, x, y, s, color) {
  fillGrid(ctx, HEART, Math.round(x), Math.round(y), s, Math.round((s * 6) / 7), ch => (ch === "#" ? color : null));
}

export function drawCloudRetro(ctx, x, y, w) {
  fillGrid(ctx, CLOUD, Math.round(x), Math.round(y), w, Math.round(w / 4), ch => (ch === "#" ? ctx.fillStyle : null));
}
