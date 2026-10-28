// Cosmetic only: uses Math.random freely because nothing here feeds back into the sim.
import { BIOMES, biomeIndex } from "./sim.js";
import { disc } from "./art.js";

const lerp = (a, b, t) => a + (b - a) * t;
const lc = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const css = c => `rgb(${c.map(Math.round).join(",")})`;
const smooth = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

export const fx = { parts: [], shake: 0, pop: 0, squash: 0 };

export function burst(x, y, n, color, speed = 80) {
  for (let i = 0; i < n; i++) {
    const life = 0.3 + Math.random() * 0.4;
    fx.parts.push({ x, y, vx: (Math.random() - 0.5) * speed * 2, vy: -Math.random() * speed, life, max: life, color });
  }
}

// Day/night runs every 700 points, biomes change every 1000, and bg crossfades into the next biome over the last 150.
// Ink (dino, HUD, obstacles) and accent are picked from the *background's luminance*, not from the time of day: a light
// background gets the dark ink, a dark one the light ink. Fading both bg and fg crosses at the same gray and things vanish,
// so there is one hard switch where the background is about 20% luminance, and the inks are near-black / near-white
// so even at that switch the contrast stays above 3:1. Accent-coloured hazards also get an ink outline in art.js.
const CYCLE = 700, BLEND = 150, FLIP = 0.2;
export const PALETTES = {
  desert: { day: [249, 236, 212], night: [44, 30, 52], inkDark: [48, 32, 20], inkLight: [250, 232, 200], accent: [122, 150, 84], stars: 0, weather: "none" },
  forest: { day: [226, 240, 226], night: [20, 34, 32], inkDark: [16, 36, 26], inkLight: [214, 244, 222], accent: [70, 140, 84], stars: 0, weather: "rain" },
  snow: { day: [238, 244, 252], night: [26, 34, 54], inkDark: [20, 32, 58], inkLight: [232, 240, 252], accent: [110, 170, 210], stars: 0, weather: "snow" },
  volcano: { day: [58, 28, 30], night: [26, 10, 14], inkDark: [32, 14, 12], inkLight: [255, 224, 190], accent: [236, 100, 56], stars: 0, weather: "ember" },
  space: { day: [34, 38, 86], night: [6, 6, 22], inkDark: [14, 18, 48], inkLight: [226, 236, 255], accent: [96, 204, 228], stars: 0.7, weather: "none" },
};

const lum = ([r, g, b]) => {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export function skyState(score) {
  const bi = biomeIndex(score), cur = PALETTES[BIOMES[bi]], nxt = PALETTES[BIOMES[(bi + 1) % BIOMES.length]];
  const blend = smooth(((score % 1000) - (1000 - BLEND)) / BLEND);
  const night = 1 - (0.5 + 0.5 * Math.cos(((score % CYCLE) / CYCLE) * Math.PI * 2));
  const bg = lc(lc(cur.day, cur.night, night), lc(nxt.day, nxt.night, night), blend);
  const light = lum(bg) > FLIP; // light background: dark ink and a deeper accent
  const ink = p => (light ? p.inkDark : p.inkLight);
  const accent = p => (light ? lc(p.accent, [0, 0, 0], 0.3) : lc(p.accent, [255, 255, 255], 0.4));
  const lead = blend < 0.5 ? cur : nxt;
  return {
    bg: css(bg),
    fg: css(lc(ink(cur), ink(nxt), blend)),
    accent: css(lc(accent(cur), accent(nxt), blend)),
    night: Math.max(night, lerp(cur.stars, nxt.stars, blend)),
    weather: lead.weather,
    biome: BIOMES[blend < 0.5 ? bi : (bi + 1) % BIOMES.length],
  };
}

const stars = Array.from({ length: 30 }, () => ({ x: Math.random() * 600, y: Math.random() * 90, r: Math.random() < 0.2 ? 1.5 : 1 }));
const drops = Array.from({ length: 70 }, () => ({ x: Math.random() * 600, y: Math.random() * 150, k: 0.6 + Math.random() * 0.8 }));

export function stepFx(dt, weather) {
  for (const p of fx.parts) { p.life -= dt; p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  fx.parts = fx.parts.filter(p => p.life > 0);
  fx.shake = Math.max(0, fx.shake - dt * 2);
  fx.pop = Math.max(0, fx.pop - dt * 3);
  fx.squash = Math.max(0, fx.squash - dt * 8);
  if (weather === "none") return;
  for (const d of drops) {
    if (weather === "ember") { // rises
      d.y -= 38 * d.k * dt;
      d.x += Math.sin(d.y / 14) * 14 * dt;
      if (d.y < -5) { d.y = 155; d.x = Math.random() * 600; }
    } else {
      d.y += (weather === "rain" ? 380 : 45) * d.k * dt;
      d.x += (weather === "rain" ? -50 : Math.sin(d.y / 20) * 15) * dt;
      if (d.y > 150) { d.y = -5; d.x = Math.random() * 600; }
    }
    if (d.x < 0) d.x += 600;
  }
}

export function drawBackdrop(ctx, sky, W, H) {
  ctx.fillStyle = sky.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = sky.fg;
  if (sky.night > 0.05) {
    ctx.globalAlpha = sky.night;
    for (const s of stars) ctx.fillRect(s.x, s.y, s.r, s.r);
    if (sky.biome !== "space") disc(ctx, 470, 32, 10); // left of the score readout; space has planets instead
    ctx.globalAlpha = 1;
  }
  if (sky.weather === "rain") {
    ctx.globalAlpha = 0.5;
    for (const d of drops) ctx.fillRect(d.x, d.y, 1, 6 * d.k);
  } else if (sky.weather === "snow") {
    ctx.globalAlpha = 0.6;
    for (const d of drops) ctx.fillRect(d.x, d.y, 2, 2);
  } else if (sky.weather === "ember") {
    ctx.fillStyle = "#ff7a3c";
    for (const d of drops) { ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(d.y / 9 + d.x)); ctx.fillRect(d.x, d.y, 2, 2); }
  }
  ctx.globalAlpha = 1;
}

export function drawParts(ctx) {
  for (const p of fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}
