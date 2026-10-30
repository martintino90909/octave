// Regression guard on phone-like audio: correct playing must pass and wrong
// frets must be caught, across clean, fast, short-ringing and noisy takes.
// Before tuning, fast playing passed 62% and noisy 78%; keep it well above.

import test from "node:test";
import assert from "node:assert/strict";
import { phoneTake, SR } from "./phone-sim.js";
import { detectPitch, presence, prepare, PitchSmoother } from "../public/lib/pitch.js";
import { StringCheck, chordTargets, noteTargets } from "../public/lib/tunecheck.js";
import { CHORDS, findSkill } from "../public/lib/path.js";

const HOP = Math.round(0.04 * SR), WIN = 4096;

function run(targets, sig) {
  const c = new StringCheck(targets);
  const sm = new PitchSmoother();
  for (let end = WIN; end <= sig.length && !c.finished; end += HOP) {
    const fr = prepare(sig.subarray(end - WIN, end), SR);
    const raw = detectPitch(fr, SR, { threshold: 0.25, gate: 0.003 });
    c.update({ raw, freq: sm.push(raw), level: fr.level, now: (end / SR) * 1000, probe: (f) => presence(fr, SR, f, { gate: 0.003 }) });
  }
  return c;
}

function drills(gap) {
  const out = [];
  for (const name of ["Em", "C", "G"]) {
    const t = chordTargets(CHORDS[name]);
    out.push({ t, plucks: t.map((x, k) => ({ at: 0.4 + k * gap, s: x.index, f: x.fret })), secs: 1 + t.length * gap + 1.5 });
  }
  const t = noteTargets(findSkill("u9-up").skill.notes);
  out.push({ t, plucks: t.map((x, k) => ({ at: 0.4 + k * gap, s: x.index, f: x.fret, until: 0.4 + (k + 1) * gap + 0.8 })), secs: 1 + t.length * gap + 1.5 });
  return out;
}

for (const [name, gap, opts] of [
  ["clean", 1.1, {}],
  ["fast", 0.6, {}],
  ["noisy", 0.8, { hiss: 0.008, level: 0.1 }],
]) {
  test(`phone-like ${name} playing: right notes pass, wrong frets are caught`, () => {
    let good = 0, goodN = 0, caught = 0, caughtN = 0;
    for (const d of drills(gap)) {
      for (const seed of [1, 2, 3]) {
        goodN++;
        if (run(d.t, phoneTake(d.plucks, d.secs, { seed, ...opts })).clean) good++;
        const k = seed % d.t.length;
        const wrong = d.plucks.map((p, i) => (i === k ? { ...p, f: p.f + 1 } : p));
        caughtN++;
        const r = run(d.t, phoneTake(wrong, d.secs, { seed: seed + 100, ...opts })).results[k];
        if (r && !r.ok) caught++;
      }
    }
    assert.ok(good / goodN >= 0.9, `${name}: only ${good}/${goodN} correct takes passed`);
    assert.ok(caught / caughtN >= 0.75, `${name}: only ${caught}/${caughtN} wrong frets caught`);
  });
}
