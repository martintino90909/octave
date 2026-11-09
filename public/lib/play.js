// Play mode: a scrolling tab of what to play, graded by the mic as you go,
// in the style of Yousician. Pure logic only (no audio or DOM), so Node tests
// can run it on simulated phone-mic takes:
//   chartFor()   turns a skill or song section into timed notes and strums
//   Grader       judges each one from mic readings: hit (perfect or good,
//                early or late) or miss, and why
//   scoreRun()   adds a run up into a percentage and stars
//   guideScore() turns a chart into a demo score: count-in ticks and,
//                optionally, the guide guitar
//
// Two modes. "time": the chart scrolls at the tempo and every note and
// down-strum is graded on time and pitch. "wait": the chart stops at each note,
// and at each chord change, until you play it; nothing is timed.

import { noteMidi } from "./demo.js";

const freqOf = (midi) => 440 * 2 ** ((midi - 69) / 12);
const QUARTERS = "D - D - D - D -";
const MAX_BARS = 16;

// The tempo "100%" means for a skill, or null when it has nothing to play along to.
export function playBpm(skill) {
  if (skill.type === "ladder") return skill.targetBpm;
  if (skill.type === "changes") return skill.target * 2; // two strums per chord, one change a bar
  if (skill.check === "notes" && skill.notes) return skill.playBpm || 70;
  if (skill.chord || skill.progression) return skill.demoBpm || 70;
  return null;
}

export const canPlay = (skill) => skill.type !== "ear" && skill.check !== "tuning" && playBpm(skill) !== null &&
  (skill.type !== "ladder" || Boolean(skill.progression || skill.chord || skill.picks));

// What the chart is made of: one entry per bar (a chord id or null), the
// pattern, and single notes to play instead of chords, if any.
function layout(skill) {
  if (skill.type === "changes") {
    return { bars: Array.from({ length: 8 }, (_, i) => skill.pair[i % 2]), pattern: "D D", beatsPerBar: 2 };
  }
  if (skill.type === "ladder") {
    const prog = skill.progression || (skill.chord ? [skill.chord] : null);
    const n = Math.min(MAX_BARS, skill.bars || (prog ? Math.max(4, prog.length) : 4));
    return {
      bars: Array.from({ length: n }, (_, i) => (prog ? prog[i % prog.length] : null)),
      pattern: skill.pattern || QUARTERS,
      beatsPerBar: skill.beatsPerBar || 4,
      picks: skill.picks || null,
    };
  }
  if (skill.check === "notes" && skill.notes) {
    return { notes: skill.notes, beatsPerBar: 4 };
  }
  if (skill.progression) {
    const bars = [...skill.progression];
    while (bars.length < 4) bars.push(...skill.progression);
    return { bars, pattern: QUARTERS, beatsPerBar: 4 };
  }
  if (skill.chord) return { bars: [skill.chord, skill.chord, skill.chord, skill.chord], pattern: "D - - - D - - -", beatsPerBar: 4 };
  return null;
}

// A chart: { bpm, beat, bar, beatsPerBar, countIn (seconds), length, events,
// bars: [{ t, chord }], ticks: [{ t, accent }] }. Event times are seconds from
// the first count-in click. Events:
//   { kind: "strum", dir: "D"|"U", chord, tones: [{ s, f, freq }] }
//   { kind: "chuck" }                 muted strings, timing only
//   { kind: "note", s, f, freq, legato }
// plus i (index), t, bar, and change (the first strum of a new chord).
export function chartFor(skill, chords, { speed = 1, bpm: at } = {}) {
  const base = playBpm(skill);
  const plan = layout(skill);
  if (!base || !plan) return null;
  const bpm = Math.round(at ?? base * speed);
  const opts = { capo: skill.capo || 0, tuning: skill.tuning };
  const beat = 60 / bpm;
  const beatsPerBar = plan.beatsPerBar;
  const bar = beat * beatsPerBar;
  const countIn = bar;
  const events = [];
  const bars = [];
  const ticks = [];
  const add = (e) => events.push({ i: events.length, ...e });
  const tone = (s, f) => ({ s, f, freq: freqOf(noteMidi(s, f, opts)) });

  if (plan.notes) {
    plan.notes.forEach((n, k) => {
      const e = Array.isArray(n) ? { s: n[0], f: n[1] } : n;
      const t = countIn + k * beat;
      const sound = e.sound ?? e.f;
      add({ t, bar: Math.floor(k / beatsPerBar), kind: "note", s: e.s, f: e.f, freq: freqOf(noteMidi(e.s, sound, opts)), legato: Boolean(e.legato), bend: e.sound !== undefined && e.sound !== e.f });
    });
    const n = Math.ceil(plan.notes.length / beatsPerBar);
    for (let b = 0; b < n; b++) bars.push({ t: countIn + b * bar, chord: null });
  } else {
    const tokens = plan.pattern.split(" ");
    const step = bar / tokens.length;
    let pick = 0;
    let last = undefined;
    plan.bars.forEach((id, bi) => {
      const chord = id ? chords[id] : null;
      const t0 = countIn + bi * bar;
      bars.push({ t: t0, chord: id });
      let first = id !== last;
      last = id;
      tokens.forEach((tok, k) => {
        const t = t0 + k * step;
        if (tok === "-") return;
        if (tok === "X") return add({ t, bar: bi, kind: "chuck" });
        if (plan.picks) {
          const [s, f] = plan.picks[pick++ % plan.picks.length];
          return add({ t, bar: bi, kind: "note", ...tone(s, f) });
        }
        if (!chord) return;
        if (tok === "D" || tok === "U") {
          const tones = chord.frets.map((f, s) => (f < 0 ? null : tone(s, f))).filter(Boolean);
          add({ t, bar: bi, kind: "strum", dir: tok, chord: id, tones, change: first });
          first = false;
          return;
        }
        // fingerpicking: T is the chord's lowest string, digits name strings (1 = high E)
        const played = chord.frets.map((f, s) => [s, f]).filter(([, f]) => f >= 0);
        const s = tok === "T" ? played[0]?.[0] : 6 - Number(tok);
        if (s === undefined || chord.frets[s] < 0) return;
        add({ t, bar: bi, kind: "note", chord: id, ...tone(s, chord.frets[s]), change: first });
        first = false;
      });
    });
  }

  const totalBars = bars.length;
  for (let b = 0; b < (totalBars + 1) * beatsPerBar; b++) ticks.push({ t: b * beat, accent: b % beatsPerBar === 0, countIn: b < beatsPerBar });
  return {
    bpm, base, speed: bpm / base, beat, bar, beatsPerBar, countIn, events, bars, ticks,
    length: countIn + totalBars * bar + 0.6,
    capo: opts.capo, tuning: opts.tuning,
  };
}

// Which events count in a mode. Up strums are shown but not graded: they
// catch fewer strings, more lightly, and a phone mic can't tell them apart
// reliably. In wait mode only notes and chord changes stop the chart.
export function graded(ev, mode = "time") {
  if (mode === "wait") return ev.kind === "note" || (ev.kind === "strum" && ev.change);
  return ev.kind === "note" || ev.kind === "chuck" || (ev.kind === "strum" && ev.dir === "D");
}

// ---------- grading ----------

const SEMI = 2 ** (1 / 12);

// Judges a chart from mic readings, one at a time:
//   update({ t, wall, level, probe }) → results judged on this reading
//     t     — chart time the sound in this reading was played (lag removed);
//             in wait mode, the frozen chart time
//     wall  — real seconds, steadily rising (for how long a check has run)
//     level — loudness in the guitar's range; probe(freq) → 0..1 (pitch.js)
// Result: { ev, ok, grade: "perfect"|"good"|"miss", dt (s, + is late), why, tries }
//   why on a miss: "silent" (nothing heard), "note" (a wrong note: heard says
//   which way), "chord" (strings didn't ring clearly enough to be the chord),
//   "late" or "early" (played, but outside the window; off is by how much)
export class Grader {
  constructor(chart, {
    mode = "time", early = 0.2, late = 0.25, perfect = 0.09, confirm = 0.32,
    minLevel = 0.0015, onsetRatio = 1.6, present = 0.35, octaveMargin = 0.2,
    chordPresent = 0.3, chordShare = 0.4, waitEarly = 0.35, settle = 0.55,
    hfRatio = 2.2, minHf = 0.0015, tickGuard = 0.05,
  } = {}) {
    Object.assign(this, { chart, mode, early, late, perfect, confirm, minLevel, onsetRatio, present, octaveMargin, chordPresent, chordShare, waitEarly, settle, hfRatio, minHf, tickGuard });
    this.todo = chart.events.filter((e) => graded(e, mode));
    this.results = [];
    this.judged = new Set();
    this.attempts = new Map(); // ev.i → { at, wall, hits, best, wrong, onset }
    this.tries = new Map();
    this.recent = [];
    this.recentP = new Map(); // ev.i → recent probe values of that note
    this.strays = []; // onsets that fell outside every window (time mode)
  }

  get total() {
    return this.todo.length;
  }

  get done() {
    return this.judged.size === this.todo.length;
  }

  // the event wait mode is stopped at (or heading for)
  get current() {
    return this.todo.find((e) => !this.judged.has(e.i)) || null;
  }

  // Is this note sounding? Like StringCheck.hears: anything an octave or a
  // fifth up also repeats at its period, so those are ruled out, and the note
  // must beat its semitone neighbours, unless a neighbour is a note played just
  // before, which is expected to still ring (a scale across strings).
  hearsNote(freq, probe, ringing = []) {
    const p = probe(freq);
    if (p < this.present) return false;
    const rings = (f) => ringing.some((r) => Math.abs(1200 * Math.log2(f / r)) < 40);
    for (const n of [freq * SEMI, freq / SEMI]) if (!rings(n) && probe(n) >= p) return false;
    return Math.max(probe(freq * 2), probe(freq * 3)) < p - this.octaveMargin;
  }

  // pitches of the notes played just before this one (still ringing)
  ringingBefore(ev) {
    const out = [];
    for (let k = ev.i - 1; k >= 0 && out.length < 3; k--) {
      const e = this.chart.events[k];
      if (e.kind === "note") out.push(e.freq);
      else if (e.kind === "strum") {
        out.push(...e.tones.map((x) => x.freq));
        break;
      }
    }
    return out;
  }

  // the chord's distinct notes
  chordFreqs(ev) {
    return (ev.freqs ||= [...new Set(ev.tones.map((x) => Math.round(x.freq * 100)))].map((f) => f / 100));
  }

  // share of the chord's notes ringing in this reading
  chordShareOf(ev, probe) {
    const freqs = this.chordFreqs(ev);
    return freqs.filter((f) => probe(f) >= this.chordPresent).length / freqs.length;
  }

  judge(ev, ok, extra) {
    this.judged.add(ev.i);
    this.attempts.delete(ev.i);
    let grade = "miss";
    if (ok) grade = this.mode === "wait" || Math.abs(extra.dt) <= this.perfect ? "perfect" : "good";
    const r = { ev, ok, grade, tries: this.tries.get(ev.i) || 0, ...extra };
    this.results.push(r);
    return r;
  }

  // unjudged events whose window is open at time t
  open(t) {
    if (this.mode === "wait") {
      const ev = this.current;
      return ev && t >= ev.t - this.waitEarly ? [ev] : [];
    }
    const out = [];
    for (const ev of this.todo) {
      if (ev.t - this.early > t) break;
      if (!this.judged.has(ev.i) && t <= ev.t + this.late) out.push(ev);
    }
    return out;
  }

  // the unjudged event an onset at time t belongs to
  claim(t) {
    if (this.mode === "wait") {
      const ev = this.current;
      return ev && t >= ev.t - this.waitEarly ? ev : null;
    }
    let best = null;
    for (const ev of this.todo) {
      if (this.judged.has(ev.i)) continue;
      if (ev.t - this.early > t) break;
      if (t > ev.t + this.late) continue;
      if (!best || Math.abs(t - ev.t) < Math.abs(t - best.t)) best = ev;
    }
    return best;
  }

  update({ t, wall, level, probe, hf = 0, hfPrev = 0 }) {
    const out = [];
    const loud = level > this.minLevel;
    // A pluck's attack rises over two or three readings; only the first one
    // where the level clears the recent low counts, so its time is the pluck's.
    const rising = loud && this.recent.length > 0 && level > Math.min(...this.recent) * this.onsetRatio;
    const struck = loud && hf > this.minHf && hf > hfPrev * this.hfRatio;
    const onset = (rising && !this.wasRising) || struck;
    this.wasRising = rising && level >= (this.recent.at(-1) ?? 0);
    // a click from the phone's speaker can land on a beat: an onset there may
    // be the click, so a real pluck straight after it takes over its timing
    const onTick = this.mode === "time" && this.chart.ticks.some((k) => Math.abs(k.t - t) <= this.tickGuard);
    this.recent = [...this.recent, level].slice(-4);

    // legato notes (hammer-ons, slides, bends) need no new pluck
    for (const ev of this.todo) {
      if (this.judged.has(ev.i) || !ev.legato || this.attempts.has(ev.i)) continue;
      if (this.mode === "wait" ? ev === this.current : t >= ev.t - this.early && t <= ev.t + this.late) {
        this.attempts.set(ev.i, { at: Math.max(t, ev.t), wall, hits: 0, best: 0, wrong: {} });
      }
      if (ev.t - this.early > t) break;
    }

    // A pick of one note while other strings ring barely changes the overall
    // level, so a note also counts as plucked when it clearly appears: its own
    // presence jumps and it's now the note heard.
    const appeared = [];
    for (const ev of this.open(t)) {
      if (ev.kind !== "note" || ev.legato) continue;
      const p = probe(ev.freq);
      const prev = this.recentP.get(ev.i) || [];
      if (loud && prev.length >= 2 && p > Math.min(...prev) + 0.15 && this.hearsNote(ev.freq, probe, this.ringingBefore(ev))) appeared.push(ev);
      this.recentP.set(ev.i, [...prev, p].slice(-4));
    }

    const plucked = new Set(appeared);
    if (onset) {
      const ev = this.claim(t);
      if (ev) plucked.add(ev);
      else if (this.mode === "time") this.strays = [...this.strays.filter((x) => x > t - 2), t];
    }
    for (const ev of plucked) {
      const a = this.attempts.get(ev.i);
      // a second rise straight after the first is the same pluck, still
      // building, unless the first may have been a click
      if (!a || wall - a.wall > 0.12 || (a.onTick && !onTick)) {
        if (!a || !a.onTick) this.tries.set(ev.i, (this.tries.get(ev.i) || 0) + 1);
        this.attempts.set(ev.i, { at: t, wall, hits: a?.onTick ? a.hits : 0, best: a?.best || 0, wrong: {}, onTick });
      }
      if (ev.kind === "chuck") out.push(this.judge(ev, true, { dt: t - ev.t }));
    }

    for (const [i, a] of this.attempts) {
      const ev = this.chart.events[i];
      const dt = this.mode === "wait" ? 0 : a.at - ev.t;
      if (this.judged.has(i)) continue;
      if (ev.kind === "note") {
        if (this.hearsNote(ev.freq, probe, this.ringingBefore(ev))) {
          if (++a.hits >= 2) {
            out.push(this.judge(ev, true, { dt }));
            continue;
          }
        } else {
          // which wrong note is it? a fret or two either side
          const p0 = probe(ev.freq);
          for (const step of [-2, -1, 1, 2]) {
            const q = probe(ev.freq * 2 ** (step / 12));
            if (q >= this.present && q > p0) a.wrong[step] = (a.wrong[step] || 0) + 1;
          }
        }
      } else if (ev.kind === "strum") {
        // A strummed chord's strings show up clearly at different moments as
        // they ring together, so a note counts once heard at any point since
        // the strum.
        a.seen ||= new Set();
        for (const f of this.chordFreqs(ev)) if (probe(f) >= this.chordPresent) a.seen.add(f);
        const share = a.seen.size / this.chordFreqs(ev).length;
        a.best = Math.max(a.best, share);
        if (share >= this.chordShare) {
          out.push(this.judge(ev, true, { dt }));
          continue;
        }
      }
      if (wall - a.wall > this.confirm) {
        this.attempts.delete(i);
        a.failed = true;
        this.lastFail ||= new Map();
        this.lastFail.set(i, a);
      }
    }

    if (this.mode === "time") {
      for (const ev of this.todo) {
        if (ev.t - this.early > t) break;
        // a miss is settled a little after the window, so a late pluck can be seen
        if (this.judged.has(ev.i) || this.attempts.has(ev.i) || t <= ev.t + this.settle) continue;
        const failed = this.lastFail?.get(ev.i);
        let why = "silent";
        let heard = null;
        // played, but outside the window: the nearest stray onset says which way
        let off = null;
        if (!failed) {
          for (const x of this.strays) if (x > ev.t - 0.5 && x <= ev.t + this.settle && (off === null || Math.abs(x - ev.t) < Math.abs(off))) off = x - ev.t;
          if (off !== null) why = off > 0 ? "late" : "early";
        }
        if (failed) {
          why = ev.kind === "strum" ? "chord" : "note";
          const top = Object.entries(failed.wrong).sort((x, y) => y[1] - x[1])[0];
          if (top) heard = Number(top[0]);
        }
        out.push(this.judge(ev, false, { dt: null, why, heard, off }));
      }
    }
    return out;
  }
}

// ---------- scoring ----------

const POINTS = { perfect: 1, good: 0.75, miss: 0 };
export const STAR_AT = [0.5, 0.75, 0.9];

// Stars are capped below full speed: 2 at 75–99%, 1 under that.
export function scoreRun(results, total, { speed = 1 } = {}) {
  const count = (g) => results.filter((r) => r.grade === g).length;
  const perfect = count("perfect");
  const good = count("good");
  const missed = total - perfect - good;
  const points = results.reduce((s, r) => s + POINTS[r.grade], 0);
  const share = total ? points / total : 0;
  let stars = STAR_AT.filter((x) => share >= x - 1e-9).length;
  const cap = speed >= 0.999 ? 3 : speed >= 0.75 ? 2 : 1;
  stars = Math.min(stars, cap);
  let streak = 0, best = 0;
  for (const r of [...results].sort((a, b) => a.ev.t - b.ev.t)) {
    streak = r.ok ? streak + 1 : 0;
    best = Math.max(best, streak);
  }
  const hits = results.filter((r) => r.ok && r.dt !== null).map((r) => r.dt).sort((a, b) => a - b);
  const median = hits.length ? hits[Math.floor(hits.length / 2)] : 0;
  const late = hits.filter((d) => d > 0.09).length;
  const early = hits.filter((d) => d < -0.09).length;
  const why = {};
  for (const r of results) if (!r.ok) why[r.why] = (why[r.why] || 0) + 1;
  return { pct: Math.round(share * 100), stars, cap, perfect, good, missed, total, bestStreak: best, median, late, early, why };
}

// One line on what to work on, from a scored run.
export function advice(score, { mode = "time" } = {}) {
  if (mode === "wait") return "Wait mode isn't timed. When every note comes easily, switch to Keep time.";
  if (score.stars === 3) return "Three stars. Move on, or come back tomorrow to keep it.";
  const { why, late, early, missed, total } = score;
  const offTime = (why.late || 0) + (why.early || 0);
  if (offTime >= Math.max(3, missed / 2)) {
    return (why.late || 0) >= (why.early || 0)
      ? "Lots of notes landed just after the window. If you felt on the beat, it's your phone's mic delay: adjust the timing below."
      : "Lots of notes landed just before the window: you're rushing. Let each one reach the line.";
  }
  if ((why.silent || 0) > total * 0.4) return "The mic missed a lot of it. Play a bit louder, closer to the phone, in a quiet room.";
  if ((why.chord || 0) >= Math.max(2, missed / 2)) return "Most misses were chords that didn't ring clearly. Check each shape string by string, then go again.";
  if ((why.note || 0) >= Math.max(2, missed / 2)) return "Most misses were wrong notes. Try Wait for me until the shapes are automatic.";
  if (late > early && late >= 3) return "You're mostly late. Look ahead at what's coming, not at the line.";
  if (early > late && early >= 3) return "You're mostly rushing. Breathe and let each note reach the line.";
  if (score.cap < 3 && score.stars === score.cap) return "That's the most stars at this speed. Try a faster one.";
  return "Go again. Each run, aim for a longer streak.";
}

// ---------- audio ----------

// A demo score (demo.js) for a run: soft ticks on every beat (accent on 1),
// and in time mode, optionally the chart played by the guide guitar.
// Wait mode only gets the count-in.
export function guideScore(chart, { guide = false, mode = "time" } = {}) {
  const events = [];
  for (const k of chart.ticks) if (mode === "time" || k.countIn) events.push({ t: k.t, kind: "tick", accent: k.accent });
  if (guide && mode === "time") {
    const evs = chart.events;
    evs.forEach((ev, n) => {
      const later = evs.slice(n + 1);
      if (ev.kind === "note") {
        // rings until that string is played again
        const again = later.find((x) => (x.kind === "note" && x.s === ev.s) || x.kind === "strum" || x.kind === "chuck");
        events.push({ t: ev.t, kind: "pluck", s: ev.s, midi: midiOf(ev.freq), gain: 1, until: Math.min(ev.t + 1.6, again ? again.t : Infinity) });
        return;
      }
      const next = later.find((x) => x.kind !== "note" || ev.kind !== "note");
      const until = next ? next.t : ev.t + 1.5;
      if (ev.kind === "strum") {
        const order = ev.dir === "U" ? ev.tones.slice(-4).reverse() : ev.tones;
        order.forEach((x, k) => events.push({ t: ev.t + k * 0.012, kind: "pluck", s: x.s, midi: midiOf(x.freq), gain: ev.dir === "U" ? 0.55 : 1, until }));
      }
      if (ev.kind === "chuck") events.push({ t: ev.t, kind: "chuck" });
    });
  }
  return { events, cues: [], length: chart.length };
}

const midiOf = (freq) => Math.round(69 + 12 * Math.log2(freq / 440));
