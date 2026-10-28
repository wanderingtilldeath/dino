// Synthesized blips via Web Audio, no asset files.
let ac, muted = false;
try { muted = localStorage.getItem("dinoMuted") === "1"; } catch {}

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem("dinoMuted", muted ? "1" : "0"); } catch {}
  return muted;
}
// browsers only allow audio after a user gesture, so call this from input handlers
export function unlock() {
  try {
    ac ||= new AudioContext();
    if (ac.state === "suspended") ac.resume();
  } catch {}
}

function tone(freq, dur, type = "square", vol = 0.04, slideTo = 0, delay = 0) {
  if (muted || !ac) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  jump: () => tone(300, 0.12, "square", 0.04, 600),
  land: () => tone(120, 0.05, "triangle", 0.03),
  die: () => { tone(320, 0.35, "sawtooth", 0.06, 50); tone(160, 0.35, "square", 0.04, 40, 0.05); },
  milestone: () => { tone(880, 0.08); tone(1175, 0.12, "square", 0.04, 0, 0.09); },
  pickup: () => tone(600, 0.08, "triangle", 0.06, 1200),
  shield: () => tone(220, 0.18, "sawtooth", 0.06, 70),
  boss: () => { tone(110, 0.3, "sawtooth", 0.06); tone(82, 0.5, "sawtooth", 0.06, 0, 0.25); },
};
