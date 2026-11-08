import test from "node:test";
import assert from "node:assert/strict";
import { CHORDS, UNITS } from "../public/lib/path.js";
import { SONGS, sectionSkill, songChords } from "../public/lib/songs.js";
import {
  chordDemo, patternDemo, changesDemo, notesDemo, tuningDemo, demoFor, guideFor,
  renderScore, noteMidi, chordMidis, TOKEN_RE,
} from "../public/lib/demo.js";
import { detectPitch, freqFromMidi, cents, presence } from "../public/lib/pitch.js";

const SR = 44100;
const window = (audio, t, len = 4096) => audio.slice(Math.floor(t * SR), Math.floor(t * SR) + len);
const peak = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test("capo and retuned strings move the right notes", () => {
  assert.equal(noteMidi(0, 3), 43); // G on the low E
  assert.equal(noteMidi(1, 0, { capo: 2 }), 47);
  assert.equal(noteMidi(5, 0, { tuning: [0, 0, 0, 0, 0, -2] }), 62); // high E down to D
  assert.deepEqual(chordMidis(CHORDS.Am), [null, 45, 52, 57, 60, 64]);
});

test("a chord demo strums, then plays every sounding string on its own, at pitch", () => {
  const score = chordDemo(CHORDS.Am);
  const singles = score.cues.filter((c) => c.string !== undefined);
  assert.deepEqual(singles.map((c) => c.string), [1, 2, 3, 4, 5], "the muted low E is skipped");
  const audio = renderScore(score, SR);
  const midis = chordMidis(CHORDS.Am);
  for (const c of singles) {
    const p = detectPitch(window(audio, c.t + 0.15), SR);
    assert.ok(p && Math.abs(cents(p.freq, freqFromMidi(midis[c.string]))) < 15, `string ${c.string}`);
  }
  assert.ok(peak(audio) <= 0.81);
});

test("tuning demo plays the open strings low to high", () => {
  const score = tuningDemo();
  const audio = renderScore(score, SR);
  [82.41, 110, 146.83, 196, 246.94, 329.63].forEach((f, s) => {
    const p = detectPitch(window(audio, score.cues[s].t + 0.2), SR);
    assert.ok(Math.abs(cents(p.freq, f)) < 15, `string ${s}`);
  });
});

test("strum patterns land on the grid: downs low to high, ups high to low, rests ring on", () => {
  const score = patternDemo({ bars: [CHORDS.G], pattern: "D - D U - U D U", beatsPerBar: 4, bpm: 120, countIn: 1 });
  const clicks = score.events.filter((e) => e.kind === "click");
  assert.equal(clicks.length, 4);
  assert.ok(clicks[0].accent && !clicks[1].accent);
  const plucks = score.events.filter((e) => e.kind === "pluck");
  // step = 0.25 s; the bar starts after a 2 s count-in
  const strumAt = (t) => plucks.filter((e) => e.t >= t - 1e-9 && e.t < t + 0.1);
  const first = strumAt(2);
  assert.deepEqual(first.map((e) => e.s), [0, 1, 2, 3, 4, 5]);
  const up = strumAt(2.75);
  assert.deepEqual(up.map((e) => e.s), [5, 4, 3, 2], "up strum: top four strings, high to low");
  assert.ok(up.every((e) => e.gain < first[0].gain));
  assert.equal(strumAt(2.25).length, 0, "nothing new on a rest");
  assert.ok(first.every((e) => e.until <= 2.5 + 1e-9), "each strum stops the one before");
  assert.equal(score.cues.filter((c) => c.step !== undefined).length, 8);
});

test("chucks mute, palm-mutes cut short, and picking tokens pluck single strings", () => {
  const chuck = patternDemo({ bars: [CHORDS.Am], pattern: "D U X U D U X U", bpm: 100, countIn: 0 });
  assert.equal(chuck.events.filter((e) => e.kind === "chuck").length, 2);
  const muted = patternDemo({ bars: [CHORDS.E5], pattern: "D D D D D D D D", bpm: 100, countIn: 0, mute: true });
  assert.ok(muted.events.filter((e) => e.kind === "pluck").every((e) => e.until - e.t < 0.2));
  const picked = patternDemo({ bars: [CHORDS.Am], pattern: "T 3 2 1 T 3 2 3", bpm: 60, countIn: 0 });
  const p = picked.events.filter((e) => e.kind === "pluck");
  assert.deepEqual(p.slice(0, 4).map((e) => e.s), [1, 3, 4, 5], "thumb on the A (Am's root), then G, B, high E");
});

test("a progression demo sounds each bar's chord", () => {
  const score = patternDemo({ bars: [CHORDS.Em, CHORDS.C], pattern: "D - - - - - - -", bpm: 60, countIn: 0 });
  const audio = renderScore(score, SR);
  assert.ok(presence(window(audio, 0.3, 8192), SR, freqFromMidi(40)) > 0.3, "low E under Em");
  assert.ok(presence(window(audio, 4.3, 8192), SR, freqFromMidi(48)) > 0.3, "C under C");
});

test("changes demo alternates the pair at the gate pace", () => {
  const score = changesDemo([CHORDS.G, CHORDS.C], 30);
  assert.deepEqual(score.cues.slice(0, 4).map((c) => [c.t, c.chord]), [[0, 0], [2, 1], [4, 0], [6, 1]]);
});

test("note demos follow the run, with bends at the bent pitch", () => {
  const score = notesDemo([[3, 7], { s: 3, f: 7, sound: 9, legato: true }]);
  const p = score.events.filter((e) => e.kind === "pluck");
  assert.deepEqual(p.map((e) => e.midi), [62, 64]);
  assert.ok(p[1].soft && p[1].gain < p[0].gain);
});

test("every path skill with something to play has a demo that builds", () => {
  const none = [];
  for (const u of UNITS) {
    for (const s of u.skills) {
      const d = demoFor(s, CHORDS, { bpm: s.startBpm });
      if (!d) {
        none.push(s.id);
        continue;
      }
      const score = d.score(d.speeds?.[0]);
      assert.ok(score.length > 0 && score.events.length > 0, s.id);
      if (s.type === "ladder") assert.ok(guideFor(s, CHORDS, s.startBpm, 4), `${s.id} guide`);
    }
  }
  // only ear drills (which already play) and things a phone can't demo are left out
  for (const id of none) {
    const s = UNITS.flatMap((u) => u.skills).find((k) => k.id === id);
    assert.ok(s.type === "ear" || (s.type === "reps" && !s.chord && !s.notes && !s.progression && !s.check), id);
  }
});

test("songs: every chord exists, patterns are valid, sections become ladders up to the record tempo", () => {
  const ids = new Set();
  for (const song of SONGS) {
    assert.ok(!ids.has(song.id), `${song.id} unique`);
    ids.add(song.id);
    assert.ok(UNITS.some((u) => u.id === song.after), `${song.id} after`);
    for (const c of songChords(song)) assert.ok(CHORDS[c], `${song.id}: ${c}`);
    for (const sec of song.sections) {
      const tokens = (sec.pattern || song.pattern).split(" ");
      assert.ok(tokens.every((t) => TOKEN_RE.test(t)), `${song.id} pattern`);
      assert.equal(tokens.length % song.beatsPerBar, 0, `${song.id} pattern fits the bar`);
      const sk = sectionSkill(song, sec);
      assert.ok(sk.startBpm <= sk.targetBpm && sk.targetBpm === song.bpm);
      assert.ok(sk.bars >= 8 && sk.bars % sec.progression.length === 0);
      assert.ok(demoFor(sk, CHORDS, {}).score(sk.targetBpm).events.length);
    }
  }
});

test("a retuned song's demo plays the retuned string", () => {
  const sparks = SONGS.find((s) => s.id === "sparks");
  const sk = sectionSkill(sparks, sparks.sections[0]);
  const score = guideFor(sk, CHORDS, sk.targetBpm, 1);
  const top = score.events.find((e) => e.kind === "pluck" && e.s === 5);
  assert.equal(top.midi, 64 - 2 + 6, "high E down to D, capo 6");
});

test("recorded notes are used when the bank has them, the synth when it doesn't", () => {
  // a fake bank: pure sines, so we can tell them from the synth
  const sine = (midi) => Float32Array.from({ length: SR * 2 }, (_, i) => 0.2 * Math.sin((2 * Math.PI * freqFromMidi(midi) * i) / SR));
  const bank = new Map([[57, sine(57)]]);
  const score = { events: [{ t: 0, kind: "pluck", s: 3, midi: 57, gain: 1, until: 0.9 }, { t: 1, kind: "pluck", s: 1, midi: 45, gain: 1, until: 2 }], cues: [], length: 2.5 };
  const audio = renderScore(score, SR, { bank });
  const early = window(audio, 0.5);
  // a pure sine has no second harmonic; a plucked string does
  assert.ok(presence(early, SR, freqFromMidi(57)) > 0.5);
  assert.ok(presence(early, SR, freqFromMidi(69)) < 0.05, "the A3 came from the bank");
  const p = detectPitch(window(audio, 1.3), SR);
  assert.ok(Math.abs(cents(p.freq, freqFromMidi(45))) < 15, "the A2 fell back to the synth");
  assert.ok(peak(audio) <= 0.81);
});
