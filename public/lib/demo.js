// Demos: what a drill should sound like, played by Octave itself.
//
// Two halves, both pure (no audio APIs here, so Node tests can run them):
//   1. Score builders turn a skill or song section into a list of timed events
//      (plucked strings, metronome clicks, muted chucks) plus "cues" the screen
//      uses to light up the beat, the strum arrow or the chord as it plays.
//   2. renderScore() turns a score into mono samples with a plucked-string synth.
//
// Playback (Web Audio, highlighting) lives in demoplay.js.

// Open strings in standard tuning as MIDI notes, low E (index 0) to high E.
export const STRING_MIDI = [40, 45, 50, 55, 59, 64];

const freqOf = (midi) => 440 * 2 ** ((midi - 69) / 12);

// MIDI note for a string and fret, with optional capo and retuned strings.
// tuning: six semitone offsets from standard, e.g. high E down a tone = [0,0,0,0,0,-2].
export function noteMidi(string, fret, { capo = 0, tuning } = {}) {
  return STRING_MIDI[string] + (tuning?.[string] || 0) + capo + fret;
}

// The sounding note of each string for a chord shape; null for muted strings.
export function chordMidis(chord, opts = {}) {
  return chord.frets.map((f, s) => (f < 0 ? null : noteMidi(s, f, opts)));
}

// ---------- score builders ----------

function newScore() {
  return { events: [], cues: [], length: 0 };
}

// Lets every ringing note on the given strings (all strings if none given) stop at time t.
function damp(ringing, t, strings) {
  for (const [s, ev] of ringing) {
    if (!strings || strings.includes(s)) {
      if (ev.until === undefined || ev.until > t) ev.until = t;
      ringing.delete(s);
    }
  }
}

function pluckAt(score, ringing, t, s, midi, { gain = 1, soft = false, until, decay } = {}) {
  damp(ringing, t, [s]);
  const ev = { t, kind: "pluck", s, midi, gain, soft, until, decay };
  score.events.push(ev);
  ringing.set(s, ev);
  return ev;
}

// One strum across a chord. Down strums run low to high over every played
// string; up strums catch the top three or four strings, high to low, softer.
function strum(score, ringing, t, midis, dir, { spread = 0.014, gain = 1, mute = false } = {}) {
  const played = midis.map((m, s) => [s, m]).filter(([, m]) => m !== null);
  const order = dir === "U" ? played.slice(-4).reverse() : played;
  damp(ringing, t);
  order.forEach(([s, m], k) => {
    const g = (dir === "U" ? 0.55 : 1) * gain * (k === 0 ? 1 : 0.92);
    pluckAt(score, ringing, t + k * spread, s, m, { gain: g, until: mute ? t + 0.13 : undefined, decay: mute ? 0.93 : undefined });
  });
}

// A chord shape: one strum, then each string on its own so you can compare.
export function chordDemo(chord, opts = {}) {
  const score = newScore();
  const ringing = new Map();
  const midis = chordMidis(chord, opts);
  strum(score, ringing, 0, midis, "D", { spread: 0.03 });
  score.cues.push({ t: 0, label: "Strummed" });
  let t = 1.9;
  damp(ringing, t - 0.08);
  const played = midis.map((m, s) => [s, m]).filter(([, m]) => m !== null);
  played.forEach(([s, m], k) => {
    // each string stops as the next is picked, so you hear one at a time
    pluckAt(score, ringing, t, s, m, { until: k === played.length - 1 ? t + 1.4 : t + 0.68 });
    score.cues.push({ t, string: s, label: "One string at a time" });
    t += 0.7;
  });
  score.length = t + 0.8;
  return score;
}

// A quick strum, for tapping a chord box.
export function strumDemo(chord, opts = {}) {
  const score = newScore();
  strum(score, new Map(), 0, chordMidis(chord, opts), "D", { spread: 0.028 });
  score.length = 2.2;
  return score;
}

// The six open strings, low to high: a reference for tuning by ear.
export function tuningDemo() {
  const score = newScore();
  const ringing = new Map();
  for (let s = 0; s < 6; s++) {
    const t = s * 1.4;
    pluckAt(score, ringing, t, s, STRING_MIDI[s], { until: t + 1.6 });
    score.cues.push({ t, string: s });
  }
  score.length = 6 * 1.4 + 0.6;
  return score;
}

// Single notes in order, as in a scale, lick or fretboard drill.
// Notes are [string, fret] or { s, f, sound, legato }: `sound` is the fret the
// note should sound at (a bend), and legato notes are played softer, unpicked.
export function notesDemo(notes, { gap = 0.5, ...opts } = {}) {
  const score = newScore();
  const ringing = new Map();
  notes.forEach((n, i) => {
    const s = Array.isArray(n) ? n[0] : n.s;
    const f = Array.isArray(n) ? n[1] : (n.sound ?? n.f);
    const legato = !Array.isArray(n) && n.legato;
    const t = i * gap;
    damp(ringing, t);
    pluckAt(score, ringing, t, s, noteMidi(s, f, opts), { gain: legato ? 0.6 : 1, soft: legato, until: t + gap + 0.5 });
    score.cues.push({ t, index: i });
  });
  score.length = notes.length * gap + 0.8;
  return score;
}

// One-minute changes at a given pace: one strum per chord, alternating.
export function changesDemo(chords, perMinute, { changes = 8, ...opts } = {}) {
  const score = newScore();
  const ringing = new Map();
  const gap = 60 / perMinute;
  for (let i = 0; i <= changes; i++) {
    const k = i % chords.length;
    strum(score, ringing, i * gap, chordMidis(chords[k], opts), "D", { spread: 0.022 });
    score.cues.push({ t: i * gap, chord: k });
  }
  score.length = (changes + 1) * gap + 1.2;
  return score;
}

// Pattern tokens: D down strum, U up strum, X muted chuck, - nothing new
// (the last strum rings on), T the chord's lowest note with the thumb, and
// 1 to 6 plucks that string (1 is the thin high E).
export const TOKEN_RE = /^[DUX\-T1-6]$/;

// A chord progression (one chord per bar) played with a strum or picking pattern.
//   bars: chord objects, one per bar.  pattern: tokens separated by spaces.
//   countIn: bars of clicks first.  picks: [string, fret] notes to play one per
//   strum instead of chords (a picking drill), taken in turn.
export function patternDemo({ bars, pattern, beatsPerBar = 4, bpm, countIn = 1, mute = false, picks = null, ...opts }) {
  const score = newScore();
  const ringing = new Map();
  const beat = 60 / bpm;
  const bar = beat * beatsPerBar;
  const tokens = pattern.split(" ");
  const step = bar / tokens.length;
  const per = tokens.length / beatsPerBar;
  const spread = Math.min(0.014, step / 10);

  for (let b = 0; b < countIn * beatsPerBar; b++) {
    score.events.push({ t: b * beat, kind: "click", accent: b % beatsPerBar === 0 });
    score.cues.push({ t: b * beat, countIn: true, beat: b % beatsPerBar, bar: 0 });
  }
  const start = countIn * bar;
  let pick = 0;
  bars.forEach((chord, bi) => {
    const midis = chord ? chordMidis(chord, opts) : null;
    tokens.forEach((tok, i) => {
      const t = start + bi * bar + i * step;
      score.cues.push({ t, bar: bi + 1, beat: Math.floor(i / per), step: i });
      if (tok === "-") return;
      if (tok === "X") {
        damp(ringing, t);
        score.events.push({ t, kind: "chuck" });
        return;
      }
      if (picks) {
        const [s, f] = picks[pick++ % picks.length];
        pluckAt(score, ringing, t, s, noteMidi(s, f, opts), { gain: tok === "U" ? 0.85 : 1, until: t + step * 2 + 0.2, decay: mute ? 0.93 : undefined });
        return;
      }
      if (!midis) return;
      if (tok === "D" || tok === "U") {
        strum(score, ringing, t, midis, tok, { spread, mute });
        return;
      }
      // fingerpicking: T is the lowest played string; digits name the string
      const played = midis.map((m, s) => [s, m]).filter(([, m]) => m !== null);
      const s = tok === "T" ? played[0]?.[0] : 6 - Number(tok);
      if (s === undefined || midis[s] === null) return;
      pluckAt(score, ringing, t, s, midis[s], { gain: tok === "T" ? 1 : 0.8 });
    });
  });
  score.length = start + bars.length * bar + 1.2;
  return score;
}

// ---------- what each skill demos ----------

const QUARTERS = "D - D - D - D -";

// Bars for a progression demo: the progression once, repeated up to 4 bars
// when it's short, so the move between chords comes round more than once.
function demoBars(progression) {
  const out = [...progression];
  while (out.length < 4) out.push(...progression);
  return out.slice(0, Math.max(progression.length, 4));
}

// Turns a skill (or a song section shaped like one) into a demo description:
//   { caption, speeds: BPM choices or null, score(bpm) }, or null when there's
//   nothing to play. chords is the CHORDS table.
export function demoFor(skill, chords, { bpm } = {}) {
  const opts = { capo: skill.capo || 0, tuning: skill.tuning };
  const C = (id) => chords[id];

  if (skill.type === "ear") return null;

  if (skill.type === "changes") {
    const pair = skill.pair.map(C);
    return {
      caption: `Clean changes at the gate pace, ${skill.target} a minute`,
      speeds: null,
      score: () => changesDemo(pair, skill.target, opts),
    };
  }

  if (skill.type === "ladder") {
    const prog = skill.progression ? demoBars(skill.progression).map(C) : null;
    const picks = skill.picks || null;
    if (!prog && !skill.chord && !picks) return null;
    const bars = prog || [C(skill.chord) || null, C(skill.chord) || null];
    const speeds = [...new Set([skill.startBpm, bpm, skill.targetBpm].filter(Boolean))].sort((a, b) => a - b);
    return {
      caption: `${prog ? "The progression with its " : "The "}${picks || /[T1-6]/.test(skill.pattern || "") ? "picking" : "strum"}${prog ? "" : " pattern"}, after a 1-bar count-in`,
      speeds,
      score: (at) => patternDemo({ bars, pattern: skill.pattern || QUARTERS, beatsPerBar: skill.beatsPerBar, bpm: at, mute: skill.mute, picks, ...opts }),
    };
  }

  if (skill.check === "tuning") {
    return { caption: "Each open string, low to high, in tune", speeds: null, score: () => tuningDemo() };
  }
  if (skill.check === "notes" && skill.notes) {
    return { caption: "Every note, in order", speeds: null, score: () => notesDemo(skill.notes, opts) };
  }
  if (skill.chord && C(skill.chord)) {
    return { caption: "Strummed, then string by string: each one should ring like this", speeds: null, score: () => chordDemo(C(skill.chord), opts) };
  }
  if (skill.progression) {
    const at = skill.demoBpm || 80;
    return {
      caption: "The chords in order, one bar each",
      speeds: [at],
      score: (b) => patternDemo({ bars: demoBars(skill.progression).map(C), pattern: skill.pattern || QUARTERS, beatsPerBar: skill.beatsPerBar || 4, bpm: b || at, ...opts }),
    };
  }
  return null;
}

// A guide guitar for a whole tempo run: the skill's chords and pattern for
// `bars` bars at `bpm`, no count-in (the metronome gives that). Null when the
// skill has nothing to strum or pick.
export function guideFor(skill, chords, bpm, bars) {
  if (skill.type !== "ladder") return null;
  const prog = skill.progression || (skill.chord ? [skill.chord] : null);
  if (!prog && !skill.picks) return null;
  const list = Array.from({ length: bars }, (_, i) => (prog ? chords[prog[i % prog.length]] : null));
  return patternDemo({
    bars: list, pattern: skill.pattern || QUARTERS, beatsPerBar: skill.beatsPerBar, bpm, countIn: 0,
    mute: skill.mute, picks: skill.picks || null, capo: skill.capo || 0, tuning: skill.tuning,
  });
}

// ---------- synth ----------

// Karplus–Strong plucked string with a fractional (all-pass) delay so the
// pitch is exact. `bright` (0..1) softens the pick: lower is warmer.
export function voice(freq, sampleRate, seconds, { decay = 0.996, seed = 1, bright = 0.6 } = {}) {
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const total = sampleRate / freq + 0.5;
  const n = Math.max(2, Math.floor(total - 0.1));
  const frac = total - n;
  const C = (1 - frac) / (1 + frac);
  const line = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    lp += bright * (rand() - lp); // one-pole low-pass on the excitation
    line[i] = lp;
  }
  // remove DC so the note doesn't thump
  const mean = line.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) line[i] -= mean;
  const out = new Float32Array(Math.max(1, Math.floor(sampleRate * seconds)));
  let idx = 0, prevIn = 0, prevOut = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx];
    const avg = decay * 0.5 * (cur + line[(idx + 1) % n]);
    const ap = C * avg + prevIn - C * prevOut;
    prevIn = avg;
    prevOut = ap;
    line[idx] = ap;
    out[i] = cur;
    idx = (idx + 1) % n;
  }
  return out;
}

const MAX_RING = 3.2; // seconds a note can ring before it's cut anyway
const RELEASE = 0.03;
const REC_GAIN = 2.8; // brings recorded notes up to the synth's level, so clicks keep their balance

// One-pole low-pass in place: lower `a` (0..1) is darker.
function darken(x, a) {
  let y = 0;
  for (let i = 0; i < x.length; i++) x[i] = y += a * (x[i] - y);
  return x;
}

// Mono samples for a score, peak-normalised to `peak`.
// bank: optional recorded notes, a Map of MIDI note → Float32Array at
// `sampleRate` (see demoplay.js). Notes it doesn't have fall back to the synth.
export function renderScore(score, sampleRate, { peak = 0.8, bank = null } = {}) {
  const out = new Float32Array(Math.ceil(score.length * sampleRate) + 1);
  const add = (start, samples, gain) => {
    const at = Math.floor(start * sampleRate);
    for (let i = 0; i < samples.length && at + i < out.length; i++) out[at + i] += samples[i] * gain;
  };
  let seed = 7;
  for (const ev of score.events) {
    seed = (seed * 48271) % 2147483647;
    if (ev.kind === "pluck") {
      const ring = Math.min(MAX_RING, (ev.until ?? ev.t + MAX_RING) - ev.t, score.length - ev.t);
      if (ring <= 0) continue;
      const len = Math.floor((ring + RELEASE) * sampleRate);
      const rec = bank?.get(ev.midi);
      let samples;
      if (rec) {
        samples = rec.slice(0, Math.min(len, rec.length));
        for (let i = 0; i < samples.length; i++) samples[i] *= REC_GAIN;
        if (ev.decay !== undefined) darken(samples, 0.12); // palm-muted: dull and short
        else if (ev.soft) darken(samples, 0.3);
        else if (ev.gain < 0.7) darken(samples, 0.55); // up strums catch the strings lighter
      } else {
        samples = voice(freqOf(ev.midi), sampleRate, ring + RELEASE, { seed: 1 + (seed % 100000), decay: ev.decay ?? 0.996, bright: ev.soft ? 0.25 : 0.55 });
      }
      const rel = Math.min(Math.floor(RELEASE * sampleRate), samples.length);
      for (let i = 0; i < rel; i++) samples[samples.length - 1 - i] *= i / rel;
      if (ev.soft) {
        const att = Math.floor(0.012 * sampleRate);
        for (let i = 0; i < att && i < samples.length; i++) samples[i] *= i / att;
      }
      // a little variation in how hard each string is hit
      add(ev.t, samples, ev.gain * (0.92 + (seed % 1000) / 6250));
    } else if (ev.kind === "click") {
      const len = Math.floor(0.03 * sampleRate);
      const f = ev.accent ? 1568 : 1046;
      const s = new Float32Array(len);
      for (let i = 0; i < len; i++) s[i] = Math.sin((2 * Math.PI * f * i) / sampleRate) * (1 - i / len) ** 2;
      add(ev.t, s, 0.5);
    } else if (ev.kind === "chuck") {
      // a short, dull thud: strings muted by the fretting hand
      const len = Math.floor(0.06 * sampleRate);
      const s = new Float32Array(len);
      const notes = [40, 45, 50, 55].map((m) => bank?.get(m)).filter(Boolean);
      if (notes.length) {
        for (const n of notes) for (let i = 0; i < len && i < n.length; i++) s[i] += n[i] * REC_GAIN * 0.6;
        darken(s, 0.1);
        for (let i = 0; i < len; i++) s[i] *= Math.exp((-i / len) * 5);
        add(ev.t, s, 2.2);
      } else {
        let r = seed, lp = 0;
        for (let i = 0; i < len; i++) {
          r = (r * 16807) % 2147483647;
          lp += 0.35 * ((r / 2147483647) * 2 - 1 - lp);
          s[i] = lp * Math.exp((-i / len) * 6);
        }
        add(ev.t, s, 1.6);
      }
    }
  }
  let max = 0;
  for (let i = 0; i < out.length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 0) for (let i = 0; i < out.length; i++) out[i] *= peak / max;
  return out;
}
