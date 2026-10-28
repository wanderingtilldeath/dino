import { W, GROUND, STEP, createSim, press as simPress, update, dinoBox } from "./sim.js";
import { sfx, unlock, toggleMute, isMuted } from "./audio.js";
import { fx, burst, stepFx, skyState, drawBackdrop, drawParts } from "./fx.js";
import { SKINS, THEMES, drawDino, load, save } from "./skins.js";
import { UI, NUM, rr, rrStroke, drawParallax, drawObstacle, drawPickup, POWER_COLOR } from "./art.js";
import { BADGES, loadStats, recordRun, shareText, copyText } from "./progress.js";

const H = 150;
const $ = id => document.getElementById(id);
const canvas = $("c"), ctx = canvas.getContext("2d");
const nameEl = $("name"), boardEl = $("board"), muteEl = $("mute"), startEl = $("start"), resultEl = $("result");
const modeBtns = { endless: $("endless"), daily: $("daily") };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.scale(dpr, dpr);

const MAX_INPUTS = 5000; // keep in sync with the server limit
const pad = n => String(n).padStart(5, "0");

let sim, log, ghost, daily = null, dailyGhost = null;
let phase = "ready"; // ready -> running -> over
let mode = "endless", acc = 0, last = 0, deadAt = 0, runStart = 0, sky = null;
let run = { coins: 0, bosses: 0, shields: 0 }, lastResult = null;
let high = +load("dinoHigh", 0) || 0;
let toast = { text: "", t: 0 };
const sel = { skin: load("dinoSkin", "classic"), theme: load("dinoTheme", "classic") };
nameEl.value = load("dinoName", "anon");

const skinDef = () => SKINS.find(s => s.id === sel.skin && high >= s.at) || SKINS[0];
const themeDef = () => THEMES.find(t => t.id === sel.theme && high >= t.at) || THEMES[0];
const shake = v => { if (!reduceMotion) fx.shake = v; };
function say(text, t = 1.8) { toast = { text, t }; }

// ---- page UI ----
function renderChips(el, items, key, storeKey) {
  el.replaceChildren(...items.map(it => {
    const b = document.createElement("button"), ok = high >= it.at;
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(skinOrTheme(key).id === it.id));
    b.textContent = ok ? it.name : `${it.name} · ${it.at}`;
    b.disabled = !ok;
    if (!ok) b.title = `Reach ${it.at} points to unlock`;
    b.onclick = e => {
      sel[key] = it.id;
      save(storeKey, it.id);
      for (const c of el.children) c.setAttribute("aria-checked", String(c === b)); // update in place so keyboard focus survives
      if (e.detail) b.blur();
    };
    return b;
  }));
}
const skinOrTheme = key => (key === "skin" ? skinDef() : themeDef());
function renderPickers() {
  renderChips($("skins"), SKINS, "skin", "dinoSkin");
  renderChips($("themes"), THEMES, "theme", "dinoTheme");
}

const ICON = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>${inner}</svg>`;
function setMuteUI() {
  muteEl.innerHTML = ICON(isMuted() ? '<path d="m16 9 5 6M21 9l-5 6"/>' : '<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>');
  muteEl.setAttribute("aria-label", isMuted() ? "Sound off" : "Sound on");
}
muteEl.onclick = () => { toggleMute(); setMuteUI(); muteEl.blur(); };

const fmtTime = ms => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`);
function renderProgress(s = loadStats()) {
  $("stats").replaceChildren(...[["Runs", s.runs], ["Best", s.best], ["Coins", s.coins], ["Bosses cleared", s.bosses], ["Shield saves", s.shields], ["Time played", fmtTime(s.ms)]].map(([k, v]) => {
    const d = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    d.append(dt, dd);
    return d;
  }));
  $("badges").replaceChildren(...BADGES.map(b => {
    const li = document.createElement("li"), on = b.test(s);
    li.className = on ? "on" : "off";
    li.textContent = b.name;
    li.setAttribute("aria-label", `${b.name}: ${on ? "unlocked" : "locked"}`);
    return li;
  }));
  $("bestTop").textContent = high;
}

async function loadBoard() {
  try {
    const rows = await (await fetch("/api/scores" + (mode === "daily" ? "?daily=1" : ""))).json();
    const me = nameEl.value.trim();
    boardEl.replaceChildren(...(rows.length ? rows.map((r, i) => {
      const li = document.createElement("li"), rk = document.createElement("span"), nm = document.createElement("span"), sc = document.createElement("span");
      rk.className = "rk"; rk.textContent = i + 1;
      nm.className = "nm"; nm.textContent = r.name; // textContent: names are untrusted
      sc.className = "sc"; sc.textContent = r.score;
      if (r.name === me) li.className = "me";
      li.append(rk, nm, sc);
      return li;
    }) : [Object.assign(document.createElement("li"), { className: "empty", textContent: "No scores yet. Be the first." })]));
  } catch {}
}

// ---- runs ----
function start(m = mode, go = false) {
  mode = m;
  const seed = m === "daily" && daily ? daily.seed : (Math.random() * 2 ** 32) >>> 0;
  sim = createSim(seed);
  log = [];
  acc = 0;
  run = { coins: 0, bosses: 0, shields: 0 };
  ghost = m === "daily" && dailyGhost ? { sim: createSim(dailyGhost.seed), log: dailyGhost.inputs, i: 0, score: dailyGhost.score } : null;
  fx.parts.length = 0;
  resultEl.hidden = true;
  for (const [k, b] of Object.entries(modeBtns)) b.setAttribute("aria-checked", String(k === m));
  $("boardTitle").textContent = m === "daily" ? `Top 10 · Daily ${daily.day}` : "Top 10 · Endless";
  $("startMeta").textContent = `${m === "daily" ? "Daily " + daily.day : "Endless"} · Best ${high}`;
  phase = go ? "running" : "ready";
  if (go) runStart = performance.now();
  startEl.hidden = go;
  loadBoard();
}

// ghost runs in lockstep with the player: same frame number, same seed, recorded inputs
function ghostStep() {
  const g = ghost;
  if (!g || g.sim.over) return;
  while (g.i < g.log.length && g.log[g.i][0] <= g.sim.frame) simPress(g.sim, g.log[g.i++][1]);
  update(g.sim);
  g.sim.events.length = 0;
}

function press(cmd) {
  unlock();
  if (phase === "over") {
    if (cmd === "jump" && performance.now() - deadAt > 500) start(mode, true); // guard against button-mash restarts
    return;
  }
  if (phase === "ready") { // the first jump starts the run and is logged at frame 0, so replays stay valid
    if (cmd !== "jump") return;
    phase = "running";
    runStart = performance.now();
    startEl.hidden = true;
  }
  log.push([sim.frame, cmd]);
  simPress(sim, cmd);
  drain();
}

function drain() {
  const b = dinoBox(sim);
  for (const e of sim.events) {
    if (e === "jump") { sfx.jump(); burst(b.x + 14, GROUND, 4, sky.fg, 40); }
    else if (e === "land") { sfx.land(); fx.squash = 1; burst(b.x + 14, GROUND, 5, sky.fg, 50); }
    else if (e === "milestone") { sfx.milestone(); fx.pop = 1; }
    else if (e === "pickup" || e === "coin") {
      sfx.pickup();
      burst(b.x + 14, b.y + 10, 8, "#f2b632", 80);
      if (e === "coin") run.coins++;
    } else if (e === "shield") { sfx.shield(); shake(0.3); run.shields++; say("Shield broke"); }
    else if (e.startsWith("boss:")) {
      sfx.boss(); shake(0.3);
      const t = e.slice(5);
      say(t === "wall" ? "Boss: wall. Double jump granted!" : `Boss: ${t}`, 2.4);
    } else if (e === "bossEnd") { run.bosses++; say("Boss cleared"); }
    else if (e === "die") { sfx.die(); shake(0.6); burst(b.x + 14, b.y + 15, 26, sky.fg, 170); gameOver(); }
  }
  sim.events.length = 0;
}

async function post(url, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function gameOver() {
  phase = "over";
  deadAt = performance.now();
  const s = Math.floor(sim.score), m = mode, seed = sim.seed, inputs = log, prev = high, day = daily && daily.day;
  const isBest = s > prev;
  const notes = [];
  if (isBest) {
    high = s;
    save("dinoHigh", high);
    const fresh = [...SKINS, ...THEMES].filter(i => i.at > prev && i.at <= high);
    if (fresh.length) notes.push("Unlocked " + fresh.map(i => i.name).join(", "));
    renderPickers();
  }
  const { stats, unlocked } = recordRun({ score: s, ...run, daily: m === "daily", ms: performance.now() - runStart });
  if (unlocked.length) notes.push("Badge: " + unlocked.map(b => b.name).join(", "));
  if (notes.length) say(notes.join(" · "), 3.5);
  renderProgress(stats);

  const name = nameEl.value.trim() || "anon";
  save("dinoName", name);
  const mine = lastResult = { daily: m === "daily", day, score: s, rank: null };
  $("rScore").textContent = s;
  $("rTag").hidden = !isBest;
  $("rBest").textContent = high;
  $("rRank").textContent = "...";
  resultEl.hidden = false;
  try {
    const r = await post("/api/scores", { name, score: s, daily: m === "daily", seed });
    if (r.ok) {
      mine.rank = (await r.json()).rank;
      if (lastResult === mine) $("rRank").textContent = "#" + mine.rank;
    } else if (lastResult === mine) $("rRank").textContent = "-";
    if (m === "daily" && (!dailyGhost || s > dailyGhost.score) && inputs.length <= MAX_INPUTS) {
      await post("/api/ghost", { score: s, seed, inputs });
      await refreshGhost();
    }
  } catch { if (lastResult === mine) $("rRank").textContent = "-"; }
  loadBoard();
}

async function refreshGhost() {
  try {
    const r = await fetch("/api/ghost");
    dailyGhost = r.status === 200 ? await r.json() : null; // 204 = nobody has played today yet
  } catch { dailyGhost = null; }
}

// ---- drawing ----
function drawPill(text, y, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `600 13px ${UI}`;
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width + 28;
  ctx.fillStyle = "rgba(24, 26, 34, 0.86)"; // fixed colors: readable on every sky, unlike fg/bg which converge at dusk
  rr(ctx, W / 2 - w / 2, y, w, 26, 13);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; // keeps the dark pill visible on night skies
  ctx.lineWidth = 1;
  rrStroke(ctx, W / 2 - w / 2, y, w, 26, 13);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, W / 2, y + 17.5);
  ctx.globalAlpha = 1;
}

function drawHud(fg) {
  ctx.fillStyle = fg;
  ctx.textAlign = "right";
  ctx.font = `600 ${18 + Math.round(fx.pop * 5)}px ${NUM}`;
  ctx.fillText(pad(Math.floor(sim.score)), W - 14, 28);
  ctx.globalAlpha = 0.55;
  ctx.font = `500 11px ${NUM}`;
  ctx.fillText(`HI ${pad(high)}`, W - 14, 44);
  ctx.globalAlpha = 1;

  ctx.font = `700 10px ${UI}`;
  ctx.textAlign = "left";
  let x = 14;
  for (const k of ["shield", "slow", "dbl", "magnet"]) {
    const v = sim.power[k];
    if (!v) continue;
    const label = k === "shield" ? "SHIELD" : `${k === "dbl" ? "DOUBLE" : k.toUpperCase()} ${Math.ceil(v)}s`;
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = POWER_COLOR[k];
    rr(ctx, x, 10, w, 18, 9);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x + 8, 22.5);
    x += w + 6;
  }
  if (toast.t > 0) drawPill(toast.text, 40, Math.min(1, toast.t / 0.4));
  if (phase === "over") drawPill("Game over", 80);
  if (ghost) {
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.6;
    ctx.font = `500 10px ${UI}`;
    ctx.textAlign = "left";
    ctx.fillText(`Ghost: best of today (${ghost.score})`, 14, H - 6);
    ctx.globalAlpha = 1;
  }
}

function draw() {
  drawBackdrop(ctx, sky, W, H);
  drawParallax(ctx, sky, sim.distance, W, GROUND);
  const fg = sky.fg, skin = skinDef().id, air = sim.dino.y < GROUND;
  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 12, (Math.random() - 0.5) * fx.shake * 12);
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, GROUND, W, 1);
  ctx.globalAlpha = 1;
  for (const c of sim.pickups) drawPickup(ctx, c, sim.frame);
  for (const o of sim.obstacles) drawObstacle(ctx, o, sky, sim.frame);
  if (ghost) {
    ctx.globalAlpha = 0.35;
    drawDino(ctx, skin, dinoBox(ghost.sim), fg, sky.bg, ghost.sim.frame, ghost.sim.dino.y < GROUND);
    ctx.globalAlpha = 1;
  }
  drawDino(ctx, skin, dinoBox(sim), fg, sky.bg, sim.frame, air, fx.squash);
  if (sim.power.shield) {
    const b = dinoBox(sim);
    ctx.strokeStyle = POWER_COLOR.shield;
    ctx.lineWidth = 2;
    rrStroke(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 10);
  }
  drawParts(ctx);
  ctx.restore();
  drawHud(fg);
}

function frame(t) {
  const dt = Math.min((t - last) / 1000, 0.25); // clamp so a background tab doesn't fast-forward
  last = t;
  sky = skyState(sim.score, themeDef());
  if (phase === "running" && !sim.over) {
    acc += dt;
    while (acc >= STEP && !sim.over) { ghostStep(); update(sim); drain(); acc -= STEP; }
  }
  stepFx(dt, sky.weather);
  toast.t -= dt;
  draw();
  requestAnimationFrame(frame);
}

// ---- input ----
let duckHeld = false;
addEventListener("keydown", e => {
  if (/^(INPUT|SELECT|BUTTON|TEXTAREA)$/.test(e.target.tagName) || e.repeat) return;
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); press("jump"); }
  else if (e.code === "ArrowDown") { e.preventDefault(); if (!duckHeld) { duckHeld = true; press("duckDown"); } }
  else if (e.code === "KeyM") { toggleMute(); setMuteUI(); }
});
addEventListener("keyup", e => {
  if (e.code === "ArrowDown") { duckHeld = false; press("duckUp"); }
});

// tap = jump, swipe down = short duck; mouse jumps on press for lower latency
let ptr = null;
canvas.addEventListener("pointerdown", e => {
  unlock();
  if (e.pointerType === "mouse") return press("jump");
  ptr = { y: e.clientY };
});
canvas.addEventListener("pointerup", e => {
  if (!ptr) return;
  const dy = e.clientY - ptr.y;
  ptr = null;
  if (dy > 30) { press("duckDown"); setTimeout(() => press("duckUp"), 450); } else press("jump");
});
canvas.addEventListener("pointercancel", () => { ptr = null; });

for (const [k, b] of Object.entries(modeBtns)) b.onclick = e => { start(k); if (e.detail) b.blur(); };
$("again").onclick = e => { unlock(); start(mode, true); if (e.detail) $("again").blur(); };
$("share").onclick = async () => {
  const b = $("share"), ok = lastResult && await copyText(shareText(lastResult));
  b.textContent = ok ? "Copied!" : "Copy failed";
  setTimeout(() => { b.textContent = "Copy result"; }, 1600);
};

// ---- boot ----
renderPickers();
renderProgress();
setMuteUI();
sky = skyState(0, themeDef());
start("endless");
requestAnimationFrame(t => { last = t; frame(t); });
(async () => {
  try {
    const r = await fetch("/api/daily");
    if (r.ok) { daily = await r.json(); await refreshGhost(); modeBtns.daily.disabled = false; }
  } catch {}
})();
