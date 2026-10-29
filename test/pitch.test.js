import test from "node:test";
import assert from "node:assert/strict";
import {
  detectPitch, pluck, noteFromFreq, nearestString, matches, cents, fretFreq,
  STRINGS, PitchSmoother, noteName,
} from "../public/lib/pitch.js";

const SR = 48000;
const FRAME = 4096;

// Detect pitch on a frame taken a little after the attack, as the tuner would.
function detect(freq, { at = 0.15, noise = 0, seed = 7 } = {}) {
  const sig = pluck(freq, SR, at + 0.2, { seed });
  const start = Math.floor(at * SR);
  const frame = sig.slice(start, start + FRAME);
  if (noise) {
    let s = 99;
    for (let i = 0; i < frame.length; i++) {
      s = (s * 16807) % 2147483647;
      frame[i] += noise * ((s / 2147483647) * 2 - 1);
    }
  }
  return detectPitch(frame, SR);
}

test("detects every open string within 5 cents", () => {
  for (const s of STRINGS) {
    const r = detect(s.freq);
    assert.ok(r, `no pitch for ${s.label}`);
    const c = cents(r.freq, s.freq);
    assert.ok(Math.abs(c) < 5, `${s.label}: off by ${c.toFixed(1)} cents (${r.freq.toFixed(2)} Hz)`);
  }
});

test("detects fretted notes up to the 12th fret of the high E", () => {
  for (const [str, fret] of [[0, 2], [1, 2], [2, 2], [3, 2], [4, 1], [5, 3], [5, 12]]) {
    const f = fretFreq(str, fret);
    const r = detect(f, { seed: 3 + fret });
    assert.ok(r && Math.abs(cents(r.freq, f)) < 6, `string ${str} fret ${fret}`);
  }
});

test("hears a slightly flat string as flat", () => {
  const flat = 110 * 2 ** (-20 / 1200);
  const r = detect(flat);
  assert.ok(Math.abs(cents(r.freq, 110) + 20) < 4);
});

test("copes with background noise", () => {
  for (const s of STRINGS) {
    const r = detect(s.freq, { noise: 0.05 });
    assert.ok(r && Math.abs(cents(r.freq, s.freq)) < 8, s.label);
  }
});

test("silence gives no pitch", () => {
  assert.equal(detectPitch(new Float32Array(FRAME), SR), null);
  const hiss = new Float32Array(FRAME).map((_, i) => 0.004 * Math.sin(i * 12.9898) * Math.cos(i * 78.233));
  assert.equal(detectPitch(hiss, SR), null);
});

test("note names and nearest string", () => {
  assert.deepEqual(noteFromFreq(440), { midi: 69, name: "A", octave: 4, cents: 0 });
  assert.equal(noteFromFreq(82.41).name, "E");
  assert.equal(noteFromFreq(82.41).octave, 2);
  assert.equal(noteName(64), "E4");
  assert.equal(nearestString(112).string.label, "A2");
  assert.equal(nearestString(320).string.label, "E4");
});

test("matching allows an octave slip only on low strings", () => {
  assert.ok(matches(82.6, 82.41));
  assert.ok(matches(164.9, 82.41), "low E heard an octave up");
  assert.ok(!matches(87.3, 82.41), "F is not E");
  assert.ok(!matches(330, 164.81), "no octave allowance above the A string");
});

test("smoother waits for agreement and ignores a stray reading", () => {
  const sm = new PitchSmoother(5, 3, 30);
  assert.equal(sm.push({ freq: 110 }), null);
  assert.equal(sm.push({ freq: 220 }), null);
  assert.equal(sm.push({ freq: 110.2 }), null);
  const v = sm.push({ freq: 110.1 });
  assert.ok(Math.abs(v - 110.1) < 0.2);
});
