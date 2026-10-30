// Pure logic for the two mic features: tuning all six strings, and checking a
// chord string by string. Both take one reading at a time:
//   { freq: smoothed pitch in Hz or null, level: loudness (RMS), now: ms }

import { STRINGS, nearestString, matches, fretFreq, noteFromFreq, midiFromFreq, noteName } from "./pitch.js";

// ---------- tuning ----------

export class TuneTracker {
  constructor({ tolerance = 5, holdMs = 700, range = 300 } = {}) {
    Object.assign(this, { tolerance, holdMs, range });
    this.tuned = new Set();
    this.startedAt = null;
    this.doneAt = null;
    this.holding = null; // { n, since }
  }

  get done() {
    return this.tuned.size === STRINGS.length;
  }

  get seconds() {
    if (!this.startedAt) return 0;
    return ((this.doneAt ?? this.lastAt) - this.startedAt) / 1000;
  }

  update({ freq, now }) {
    this.lastAt = now;
    if (!freq) {
      this.holding = null;
      return { target: null };
    }
    const near = nearestString(freq);
    if (Math.abs(near.cents) > this.range) {
      this.holding = null;
      return { target: null, freq };
    }
    if (this.startedAt === null) this.startedAt = now;
    const n = near.string.n;
    const inTune = Math.abs(near.cents) <= this.tolerance;
    let justTuned = false;
    if (inTune) {
      if (!this.holding || this.holding.n !== n) this.holding = { n, since: now };
      if (!this.tuned.has(n) && now - this.holding.since >= this.holdMs) {
        this.tuned.add(n);
        justTuned = true;
        if (this.done) this.doneAt = now;
      }
    } else {
      this.holding = null;
    }
    return { target: near.string, cents: near.cents, inTune, justTuned, freq };
  }
}

// ---------- string-by-string chord check ----------

// The note each string should sound for a chord shape; muted strings are skipped.
export function chordTargets(chord) {
  return chord.frets
    .map((fret, i) => ({ i, fret }))
    .filter(({ fret }) => fret >= 0)
    .map(({ i, fret }) => {
      const freq = fretFreq(i, fret);
      const note = noteFromFreq(freq);
      return { index: i, string: STRINGS[i], fret, freq, note: `${note.name}${note.octave}` };
    });
}

// Targets for a note sequence (scales, licks, fretboard drills). Each entry
// is [string, fret] or { s, f, sound, legato, window, label }:
//   sound  — the fret whose pitch should be heard (a bend from f up to sound)
//   legato — no new pluck needed (hammer-ons, pull-offs, slides, bends)
//   window — ms allowed to reach the note once listening starts
export function noteTargets(notes) {
  return notes.map((n) => {
    const e = Array.isArray(n) ? { s: n[0], f: n[1] } : n;
    const freq = fretFreq(e.s, e.sound ?? e.f);
    const note = noteFromFreq(freq);
    return {
      index: e.s, string: STRINGS[e.s], fret: e.f, sound: e.sound ?? e.f, freq,
      note: `${note.name}${note.octave}`, legato: Boolean(e.legato), window: e.window, label: e.label,
    };
  });
}

export class StringCheck {
// Defaults tuned on simulated phone-mic takes (test/phone-sim.js): clean,
// fast, short-ringing and noisy playing, scored on correct notes passed and
// wrong frets caught. Chord strings ring together, which dilutes every
// reading, so "present" is low; the semitone-neighbour test catches wrong frets.
  constructor(targets, { windowMs = 800, waitMs = 12000, onsetRatio = 1.8, jumpRatio = 1.5, minLevel = 0.001, present = 0.35, rise = 0.15, octaveMargin = 0.2, hitsNeeded = 2 } = {}) {
    Object.assign(this, { targets, windowMs, waitMs, onsetRatio, jumpRatio, minLevel, present, rise, octaveMargin, hitsNeeded });
    this.results = [];
    this.pos = 0;
    this.armed = null;
  }

  get current() {
    return this.targets[this.pos] || null;
  }

  get finished() {
    return this.pos >= this.targets.length;
  }

  get clean() {
    return this.finished && this.results.every((r) => r.ok);
  }

  advance(result) {
    this.results.push(result);
    this.pos++;
    this.armed = null;
    return result;
  }

  // Is the expected note sounding? A note repeats at its own period, but so
  // does anything an octave or a fifth above it (their periods divide evenly
  // into it), so those are ruled out. A note a semitone off also partly
  // matches, so the expected note must match better than both neighbours.
  hears(freq, raw, probe) {
    if (!probe) return Boolean(raw && matches(raw.freq, freq));
    const p = probe(freq);
    if (p < this.present) return false;
    const semi = 2 ** (1 / 12);
    if (Math.max(probe(freq * semi), probe(freq / semi)) >= p) return false;
    return Math.max(probe(freq * 2), probe(freq * 3)) < p - this.octaveMargin;
  }

  // reading: { raw: {freq}|null, level, now, probe(freq) → 0..1 }
  // Returns a result once the current string is decided, else null.
  update({ raw, level, now, probe }) {
    const t = this.current;
    if (!t) return null;
    if (!this.armed) {
      this.armed = { at: now, floor: level, recent: [level], onsetAt: null, recentP: [] };
      // a legato note comes from the last pluck, so listening starts at once
      if (t.legato) Object.assign(this.armed, { onsetAt: now, hits: 0, heard: {} });
    }
    const a = this.armed;

    // A new pluck: the level rises well above the quietest point since this
    // note came up, or jumps over the last few readings (a re-pluck while
    // something rings), or the target note appears where it wasn't before.
    // Only sound after a pluck counts, so a string still ringing from before
    // can't pass this one.
    const loud = level > this.minLevel;
    const risen = loud && a.onsetAt === null && level > a.floor * this.onsetRatio;
    const jump = loud && level > Math.min(...a.recent) * this.jumpRatio;
    // the target note itself gets clearly stronger: a pick of that note even
    // when other strings keep the overall loudness level
    const p = probe ? probe(t.freq) : 0;
    const appeared = loud && a.onsetAt === null && probe && a.recentP.length > 0 &&
      p > Math.min(...a.recentP) + this.rise && this.hears(t.freq, raw, probe);
    a.recentP = [...a.recentP, p].slice(-4);
    if (risen || jump || appeared) Object.assign(a, { onsetAt: now, hits: 0, heard: {} });
    a.floor = Math.min(a.floor, level);
    a.recent = [...a.recent, level].slice(-4);

    if (a.onsetAt !== null) {
      if (now - a.onsetAt <= (t.window ?? this.windowMs)) {
        if (this.hears(t.freq, raw, probe) && ++a.hits >= this.hitsNeeded) return this.advance({ ...t, ok: true });
        // Name the likely mistake first: a fret or two either side, or the
        // same note an octave up. These are checked directly, which works even
        // while other strings ring and blur the overall pitch reading.
        const want = Math.round(midiFromFreq(t.freq));
        if (probe) {
          const p0 = probe(t.freq);
          let best = null;
          for (const step of [-2, -1, 1, 2, 12]) {
            const q = probe(t.freq * 2 ** (step / 12));
            const beats = step === 12 ? q >= p0 - this.octaveMargin : q > p0;
            if (q >= this.present && beats && (!best || q > best.q)) best = { q, step };
          }
          if (best) {
            const key = noteName(want + best.step);
            a.heard[key] = (a.heard[key] || 0) + 1;
            return null;
          }
        }
        if (raw && !matches(raw.freq, t.freq)) {
          // A different note is named in the octave nearest the expected one:
          // detectors often slip an octave, but the note name itself is reliable.
          // The same note in another octave keeps its octave, since that's the mistake.
          let midi = Math.round(midiFromFreq(raw.freq));
          if ((midi - want) % 12 !== 0) {
            while (midi - want > 6) midi -= 12;
            while (want - midi > 6) midi += 12;
          }
          const key = noteName(midi);
          // strings already checked are still ringing (in any octave, once the
          // detector slips); they aren't what was just played
          const pc = (m) => ((m % 12) + 12) % 12;
          const ringing = this.targets.slice(0, this.pos).some((x) => pc(Math.round(midiFromFreq(x.freq))) === pc(midi));
          if (!ringing) a.heard[key] = (a.heard[key] || 0) + 1;
        }
        return null;
      }
      const heard = Object.entries(a.heard).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      return this.advance({ ...t, ok: false, heard });
    }
    if (now - a.at > this.waitMs) return this.advance({ ...t, ok: false, heard: null, timedOut: true });
    return null;
  }
}
