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

export class StringCheck {
  constructor(targets, { windowMs = 900, waitMs = 12000, onsetRatio = 1.8, minLevel = 0.012, present = 0.55, hitsNeeded = 2 } = {}) {
    Object.assign(this, { targets, windowMs, waitMs, onsetRatio, minLevel, present, hitsNeeded });
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
  // into it), so those are ruled out first.
  hears(freq, raw, probe) {
    if (!probe) return Boolean(raw && matches(raw.freq, freq));
    const p = probe(freq);
    return p >= this.present && Math.max(probe(freq * 2), probe(freq * 3)) < p - 0.25;
  }

  // reading: { raw: {freq}|null, level, now, probe(freq) → 0..1 }
  // Returns a result once the current string is decided, else null.
  update({ raw, level, now, probe }) {
    const t = this.current;
    if (!t) return null;
    if (!this.armed) this.armed = { at: now, floor: level, prev: level, onsetAt: null };
    const a = this.armed;

    // A new pluck: the level rises well above the quietest point since this
    // string came up, or jumps sharply from one reading to the next (a re-pluck).
    // Only sound after a pluck counts, so the previous string ringing on can't
    // pass this one.
    const loud = level > this.minLevel;
    const risen = loud && a.onsetAt === null && level > a.floor * this.onsetRatio;
    const jump = loud && level > a.prev * this.onsetRatio;
    if (risen || jump) Object.assign(a, { onsetAt: now, hits: 0, heard: {} });
    a.floor = Math.min(a.floor, level);
    a.prev = level;

    if (a.onsetAt !== null) {
      if (now - a.onsetAt <= this.windowMs) {
        if (this.hears(t.freq, raw, probe) && ++a.hits >= this.hitsNeeded) return this.advance({ ...t, ok: true });
        if (raw && !matches(raw.freq, t.freq)) {
          // A different note is named in the octave nearest the expected one:
          // detectors often slip an octave, but the note name itself is reliable.
          // The same note in another octave keeps its octave, since that's the mistake.
          let midi = Math.round(midiFromFreq(raw.freq));
          const want = Math.round(midiFromFreq(t.freq));
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
