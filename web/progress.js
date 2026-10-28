// Lifetime stats, badges and the share text. Per-browser only (localStorage), no accounts.
import { load, save } from "./skins.js";

const KEY = "dinoStats";
const blank = () => ({ runs: 0, best: +load("dinoHigh", 0) || 0, coins: 0, bosses: 0, shields: 0, dailies: 0, ms: 0 });

export const BADGES = [
  { id: "first", name: "First run", test: s => s.runs >= 1 },
  { id: "s500", name: "500 club", test: s => s.best >= 500 },
  { id: "rain", name: "Rain or shine", test: s => s.best >= 700 },
  { id: "s1000", name: "Boss fight", test: s => s.best >= 1000 },
  { id: "boss", name: "Boss slayer", test: s => s.bosses >= 1 },
  { id: "coins", name: "50 coins", test: s => s.coins >= 50 },
  { id: "shield", name: "Close call", test: s => s.shields >= 1 },
  { id: "daily", name: "Daily player", test: s => s.dailies >= 1 },
];

export function loadStats() {
  try { return { ...blank(), ...JSON.parse(load(KEY, "{}")) }; } catch { return blank(); }
}

// run = {score, coins, bosses, shields, daily, ms}; returns the new stats and the badges this run unlocked
export function recordRun(run) {
  const s = loadStats();
  const had = new Set(BADGES.filter(b => b.test(s)).map(b => b.id));
  s.runs++;
  s.best = Math.max(s.best, run.score);
  s.coins += run.coins;
  s.bosses += run.bosses;
  s.shields += run.shields;
  s.dailies += run.daily ? 1 : 0;
  s.ms += run.ms;
  save(KEY, JSON.stringify(s));
  return { stats: s, unlocked: BADGES.filter(b => b.test(s) && !had.has(b.id)) };
}

export function shareText({ daily, day, score, rank }) {
  return [`Dino Run - ${daily ? "Daily " + day : "Endless"}`, `Score ${score}${rank ? ` - Rank #${rank}` : ""}`, location.href.split("#")[0]].join("\n");
}

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  try { // clipboard API is unavailable on plain http or when permission is denied
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}
