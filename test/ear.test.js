import test from "node:test";
import assert from "node:assert/strict";
import { EAR, makeQuestion, render } from "../public/lib/ear.js";
import { detectPitch, presence, freqFromMidi, cents } from "../public/lib/pitch.js";

test("questions use only the given options and stay in guitar range", () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const q = makeQuestion(["m3", "M3", "P5"], rand);
    seen.add(q.answer);
    assert.ok(["m3", "M3", "P5"].includes(q.answer));
    assert.deepEqual(q.midis.map((m) => m - q.midis[0]), EAR[q.answer].steps);
    assert.ok(q.midis[0] >= 45 && q.midis.at(-1) <= 54 + 12);
  }
  assert.equal(seen.size, 3, "every option comes up");
});

test("an interval renders as two notes at the right pitches", () => {
  const SR = 44100;
  const q = { answer: "P5", kind: "interval", midis: [48, 55] };
  const audio = render(q, SR);
  const first = detectPitch(audio.slice(Math.floor(0.2 * SR), Math.floor(0.2 * SR) + 4096), SR);
  const later = audio.slice(Math.floor(0.75 * SR), Math.floor(0.75 * SR) + 4096);
  assert.ok(Math.abs(cents(first.freq, freqFromMidi(48))) < 10);
  assert.ok(presence(later, SR, freqFromMidi(55)) > 0.5, "second note sounds after the first");
  assert.ok(presence(audio.slice(Math.floor(0.2 * SR), Math.floor(0.2 * SR) + 4096), SR, freqFromMidi(55)) < 0.3, "and not before");
  assert.ok(audio.reduce((m, v) => Math.max(m, Math.abs(v)), 0) <= 0.81, "normalised, no clipping");
});
