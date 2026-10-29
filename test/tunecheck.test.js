import test from "node:test";
import assert from "node:assert/strict";
import { pluck, detectPitch, presence, rms, PitchSmoother, STRINGS, fretFreq } from "../public/lib/pitch.js";
import { TuneTracker, StringCheck, chordTargets } from "../public/lib/tunecheck.js";
import { CHORDS } from "../public/lib/path.js";

const SR = 48000;
const HOP = Math.round(0.04 * SR); // a reading every 40 ms, as in the app
const WIN = 4096;

// Mix plucks into one recording: [{ at: seconds, freq, gain }]
function recording(plucks, seconds) {
  const out = new Float32Array(Math.floor(seconds * SR));
  plucks.forEach(({ at, freq, gain = 1 }, k) => {
    const sig = pluck(freq, SR, seconds - at, { seed: 11 + k });
    const start = Math.floor(at * SR);
    for (let i = 0; i < sig.length && start + i < out.length; i++) out[start + i] += gain * sig[i];
  });
  return out;
}

// Feed the recording through the same pipeline as the app.
function run(sig, onReading) {
  const sm = new PitchSmoother();
  for (let end = WIN; end <= sig.length; end += HOP) {
    const frame = sig.subarray(end - WIN, end);
    const level = rms(frame);
    const raw = detectPitch(frame, SR);
    const freq = sm.push(raw);
    const probe = (f) => presence(frame, SR, f);
    if (onReading({ freq, raw, level, probe, now: (end / SR) * 1000 }) === false) break;
  }
}

function checkChord(chord, plucks, seconds) {
  const check = new StringCheck(chordTargets(chord));
  run(recording(plucks, seconds), (r) => {
    check.update(r);
    return !check.finished;
  });
  return check;
}

const emTargets = chordTargets(CHORDS.Em);

test("chord targets skip muted strings and name the notes", () => {
  assert.deepEqual(emTargets.map((t) => t.note), ["E2", "B2", "E3", "G3", "B3", "E4"]);
  assert.deepEqual(chordTargets(CHORDS.Am).map((t) => t.note), ["A2", "E3", "A3", "C4", "E4"]);
});

test("a clean E minor passes, string by string", () => {
  const plucks = emTargets.map((t, k) => ({ at: 0.3 + k * 1.2, freq: t.freq }));
  const check = checkChord(CHORDS.Em, plucks, 8);
  assert.equal(check.finished, true);
  assert.equal(check.clean, true, JSON.stringify(check.results.map((r) => [r.note, r.ok, r.heard])));
});

test("a clean A minor passes", () => {
  const targets = chordTargets(CHORDS.Am);
  const plucks = targets.map((t, k) => ({ at: 0.3 + k * 1.2, freq: t.freq }));
  assert.equal(checkChord(CHORDS.Am, plucks, 7).clean, true);
});

test("a wrong note is caught and named", () => {
  // G string fretted by mistake at the 1st fret: G♯3 instead of G3
  const plucks = emTargets.map((t, k) => ({ at: 0.3 + k * 1.2, freq: t.index === 3 ? fretFreq(3, 1) : t.freq }));
  const check = checkChord(CHORDS.Em, plucks, 14);
  const g = check.results.find((r) => r.index === 3);
  assert.equal(g.ok, false);
  assert.equal(g.heard, "G♯3");
  assert.equal(check.clean, false);
  assert.ok(check.results.filter((r) => r.index !== 3).every((r) => r.ok), "other strings still pass");
});

test("the previous string ringing on does not pass the next one", () => {
  // Only the low E is plucked, loudly; the check must not move past the A string.
  const check = checkChord(CHORDS.Em, [{ at: 0.3, freq: emTargets[0].freq, gain: 1.5 }], 5);
  assert.equal(check.results.length, 1);
  assert.equal(check.results[0].ok, true);
  assert.equal(check.pos, 1);
});

test("a note an octave up does not pass for the string below it", () => {
  // Waiting on the A string (B2), the player plucks the B string (B3) instead.
  const plucks = [{ at: 0.3, freq: emTargets[0].freq }, { at: 1.5, freq: emTargets[4].freq }];
  const check = checkChord(CHORDS.Em, plucks, 4);
  assert.equal(check.results[0].ok, true);
  assert.equal(check.results[1].ok, false);
  assert.equal(check.results[1].heard, "B3");
});

test("a muted string fails once the wait runs out", () => {
  const check = new StringCheck(chordTargets(CHORDS.Em), { waitMs: 3000 });
  run(recording([], 4), (r) => {
    check.update(r);
    return check.results.length === 0;
  });
  assert.equal(check.results[0].ok, false);
  assert.equal(check.results[0].timedOut, true);
});

test("tuning: a string counts once held in tune, and the clock runs from the first note", () => {
  const tt = new TuneTracker({ holdMs: 700 });
  let now = 1000;
  const feed = (freq, ms) => {
    for (let t = 0; t < ms; t += 40) tt.update({ freq, now: (now += 40) });
  };
  feed(110 * 2 ** (-30 / 1200), 1000); // flat A: not tuned
  assert.equal(tt.tuned.size, 0);
  feed(110.1, 400); // in tune, but not held long enough
  assert.equal(tt.tuned.size, 0);
  feed(110.1, 400);
  assert.ok(tt.tuned.has(5));
  for (const s of STRINGS) feed(s.freq, 800);
  assert.equal(tt.done, true);
  assert.ok(Math.abs(tt.seconds - 6.52) < 0.1, `took ${tt.seconds}s`);
});

test("tuning ignores sounds nowhere near a string", () => {
  const tt = new TuneTracker();
  const r = tt.update({ freq: 900, now: 0 });
  assert.equal(r.target, null);
  assert.equal(tt.startedAt, null);
});
