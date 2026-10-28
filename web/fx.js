// Cosmetic only: uses Math.random freely because nothing here feeds back into the sim.
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], t))).join(",")})`;

export const fx = { parts: [], shake: 0, pop: 0, squash: 0 };

export function burst(x, y, n, color, speed = 80) {
  for (let i = 0; i < n; i++) {
    const life = 0.3 + Math.random() * 0.4;
    fx.parts.push({ x, y, vx: (Math.random() - 0.5) * speed * 2, vy: -Math.random() * speed, life, max: life, color });
  }
}

const CYCLE = 700; // score points per full day/night cycle
const WEATHER = ["none", "rain", "snow"];

export function skyState(score, theme) {
  const daylight = 0.5 + 0.5 * Math.cos(((score % CYCLE) / CYCLE) * Math.PI * 2);
  const night = 1 - daylight;
  const ink = night < 0.5 ? theme.fgDay : theme.fgNight;
  return {
    bg: mix(theme.day, theme.night, night),
    // fg switches at dusk instead of fading with bg: both fading crosses at the same gray and the dino vanishes
    fg: mix(ink, ink, 0),
    accent: mix(theme.accent, [255, 255, 255], night * 0.25), // cacti and walls brighten a little at night
    night: Math.max(night, theme.stars),
    weather: WEATHER[Math.floor(score / CYCLE) % WEATHER.length],
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
    d.y += (weather === "rain" ? 380 : 45) * d.k * dt;
    d.x += (weather === "rain" ? -50 : Math.sin(d.y / 20) * 15) * dt;
    if (d.y > 150) { d.y = -5; d.x = Math.random() * 600; }
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
    ctx.beginPath();
    ctx.arc(470, 32, 10, 0, Math.PI * 2); // left of the score readout
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (sky.weather !== "none") {
    ctx.globalAlpha = 0.5;
    for (const d of drops) {
      if (sky.weather === "rain") ctx.fillRect(d.x, d.y, 1, 6 * d.k);
      else ctx.fillRect(d.x, d.y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}

export function drawParts(ctx) {
  for (const p of fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
}
