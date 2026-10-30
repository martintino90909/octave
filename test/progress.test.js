import test from "node:test";
import assert from "node:assert/strict";
import { UNITS, STAGES, CHORDS, findSkill, runBars, allSkills, skillChords } from "../public/lib/path.js";
import { EAR } from "../public/lib/ear.js";
import { noteTargets } from "../public/lib/tunecheck.js";
import { baseFret } from "../public/lib/chord.js";
import {
  emptyState, rateReps, rateLadder, recordChanges, isUnlocked, nextSkill,
  unitProgress, currentBpm, practiceMinutes, streakDays, skillState,
  unitUnlocked, skillUnlocked, currentUnit,
} from "../public/lib/progress.js";
import { load, save } from "../public/lib/store.js";
import { chordSvg } from "../public/lib/chord.js";

const unit = UNITS[0];
const skill = (id) => findSkill(id).skill;

test("every skill has a known type, a gate, and valid content", () => {
  const ids = new Set();
  for (const s of allSkills()) {
    assert.ok(["reps", "ladder", "changes", "ear"].includes(s.type), s.id);
    assert.ok(s.gate && s.how.length && s.title, s.id);
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`);
    ids.add(s.id);
    for (const c of skillChords(s)) assert.ok(CHORDS[c], `${s.id}: unknown chord ${c}`);
    if (s.type === "ladder") {
      assert.ok(s.startBpm < s.targetBpm && s.step > 0 && (s.targetBpm - s.startBpm) % s.step === 0, `${s.id} tempo ladder`);
      assert.ok(s.bars || s.seconds, `${s.id} run length`);
      if (s.pattern) assert.ok([8, 16].includes(s.pattern.split(" ").length) && /^[DUX-]( [DUX-])*$/.test(s.pattern), `${s.id} pattern`);
      if (s.progression && s.bars) assert.equal(s.bars % s.progression.length, 0, `${s.id}: whole loops per run`);
    }
    if (s.type === "reps") {
      assert.ok(s.streak >= 1 && s.rateLabel, s.id);
      if (s.check === "strings") assert.ok(CHORDS[s.chord], s.id);
      if (s.check === "notes") {
        const t = noteTargets(s.notes);
        assert.ok(t.length >= 2, s.id);
        t.forEach((n, k) => {
          assert.ok(n.index >= 0 && n.index <= 5 && n.fret >= 0 && n.sound <= 15, `${s.id} note ${k}`);
          if (k > 0) assert.notEqual(n.freq, t[k - 1].freq, `${s.id}: notes ${k - 1} and ${k} are the same pitch`);
          if (n.legato) assert.ok(k > 0 && t[k - 1].index === n.index, `${s.id}: legato note ${k} must follow a note on its string`);
        });
      }
    }
    if (s.type === "changes") assert.ok(s.pair.length === 2 && s.target > 0, s.id);
    if (s.type === "ear") assert.ok(s.options.length >= 2 && s.options.every((o) => EAR[o]) && s.streak > 1, s.id);
  }
});

test("units are numbered in order, each in a known stage, stages in order", () => {
  UNITS.forEach((u, i) => {
    assert.equal(u.number, i + 1);
    assert.ok(STAGES.some((st) => st.id === u.stage), u.id);
    assert.ok(u.skills.length >= 3, u.id);
  });
  const order = UNITS.map((u) => STAGES.findIndex((st) => st.id === u.stage));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "units stay grouped by stage");
  assert.ok(STAGES.every((st) => UNITS.some((u) => u.stage === st.id)), "every stage has units");
});

test("every chord is used somewhere", () => {
  const used = new Set(allSkills().flatMap(skillChords));
  for (const id of Object.keys(CHORDS)) assert.ok(used.has(id), `${id} is never used`);
});

test("chord shapes have six strings and fingers only on fretted notes", () => {
  for (const [name, c] of Object.entries(CHORDS)) {
    assert.equal(c.frets.length, 6, name);
    c.frets.forEach((f, i) => assert.equal(f > 0, c.fingers[i] > 0, `${name} string ${i}`));
    assert.ok(c.sym && c.name, name);
    const fretted = c.frets.filter((f) => f > 0);
    if (fretted.length) assert.ok(Math.max(...fretted) - baseFret(c) < 4, `${name} fits in a 4-fret box`);
    if (c.barre) {
      const { fret, from, to } = c.barre;
      for (let i = from; i <= to; i++) assert.ok(c.frets[i] >= fret, `${name}: barre under string ${i}`);
      assert.equal(c.frets[from], fret, `${name}: barre starts on a barred note`);
      assert.equal(c.frets[to], fret, `${name}: barre ends on a barred note`);
    }
    assert.match(chordSvg(c), /^<svg[\s\S]*<\/svg>$/);
  }
  assert.equal(baseFret(CHORDS.Em), 1);
  assert.equal(baseFret(CHORDS.Dm7sh), 5);
  assert.match(chordSvg(CHORDS.Dm7sh), /5fr/);
  assert.equal(baseFret(CHORDS.Bm), 1, "a 2nd-fret barre stays beside the nut");
  assert.equal(baseFret(CHORDS.Gbarre), 3, "frets 3 to 5 are drawn from the 3rd fret");
});

test("chord shapes sound the notes their names say", () => {
  // pitch classes from the frets, against the chord's intended notes
  const PC = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const OPEN = [4, 9, 2, 7, 11, 4];
  const notes = (c) => [...new Set(c.frets.map((f, i) => (f < 0 ? null : PC[(OPEN[i] + f) % 12])).filter(Boolean))].sort();
  const want = {
    Em: "E G B", Am: "A C E", C: "C E G", G: "G B D", D: "D F♯ A", Dm: "D F A", F: "F A C",
    E5: "E B", A5: "A E", D5: "D A", G5: "G D", E5x7: "E B", Ds5x6: "D♯ A♯",
    Fbarre: "F A C", Bm: "B D F♯", Gbarre: "G B D", Ambarre: "A C E", Cm: "C D♯ G",
    E7: "E G♯ B D", A7: "A C♯ E G", D7: "D F♯ A C", G7: "G B D F", Cmaj7: "C E G B",
    Am7: "A C E G", Dm7: "D F A C", Em7: "E G B D", Fmaj7: "F A C E", Cmaj9: "C E B D", Em9: "E G B D F♯",
    Gmaj7sh: "G F♯ B", G7sh: "G F B", Gm7sh: "G F A♯", Cmaj7sh: "C B E", C7sh: "C A♯ E", Cm7sh: "C A♯ D♯",
    Dm7sh: "D C F", D7sh: "D C F♯", Am7sh: "A G C", Am7b5sh: "A G C", F7sh: "F D♯ A", Bb7sh: "A♯ G♯ D",
    Bbmaj7sh: "A♯ A D", Ebmaj7sh: "D♯ D G",
  };
  for (const [id, c] of Object.entries(CHORDS)) {
    assert.ok(want[id], `no expected notes for ${id}`);
    assert.deepEqual(notes(c), want[id].split(" ").sort(), id);
  }
});

test("only the first skill is unlocked at the start", () => {
  const s = emptyState();
  assert.equal(isUnlocked(s, unit, 0), true);
  assert.equal(isUnlocked(s, unit, 1), false);
  assert.equal(nextSkill(s, unit).id, "u1-setup");
});

test("reps: passes after the streak and a miss resets it", () => {
  const em = skill("u1-em");
  let s = emptyState();
  for (let i = 0; i < 4; i++) s = rateReps(s, em, true);
  s = rateReps(s, em, false);
  assert.equal(skillState(s, em.id).streak, 0);
  assert.equal(skillState(s, em.id).passed, false);
  for (let i = 0; i < 5; i++) s = rateReps(s, em, true);
  assert.equal(skillState(s, em.id).passed, true);
  assert.equal(skillState(s, em.id).attempts, 10);
  // a later miss never un-passes a gate
  s = rateReps(s, em, false);
  assert.equal(skillState(s, em.id).passed, true);
});

test("ladder: clean steps up, missed steps down, clean at target passes", () => {
  const st = skill("u1-strum");
  let s = emptyState();
  assert.equal(currentBpm(s, st), 60);
  s = rateLadder(s, st, "clean");
  assert.equal(currentBpm(s, st), 65);
  s = rateLadder(s, st, "sloppy");
  assert.equal(currentBpm(s, st), 65);
  s = rateLadder(s, st, "missed");
  s = rateLadder(s, st, "missed");
  assert.equal(currentBpm(s, st), 60, "never below the start tempo");
  for (let i = 0; i < 4; i++) s = rateLadder(s, st, "clean");
  assert.equal(currentBpm(s, st), 80);
  assert.equal(skillState(s, st.id).passed, false, "reaching 80 is not playing 80 clean");
  s = rateLadder(s, st, "clean");
  assert.equal(skillState(s, st.id).passed, true);
  assert.equal(skillState(s, st.id).best, 80);
  assert.throws(() => rateLadder(s, st, "great"));
});

test("changes: best is kept and the gate passes at the target", () => {
  const ch = skill("u1-changes");
  let s = recordChanges(emptyState(), ch, 18);
  s = recordChanges(s, ch, 12);
  assert.equal(skillState(s, ch.id).best, 18);
  assert.equal(skillState(s, ch.id).last, 12);
  assert.equal(skillState(s, ch.id).passed, false);
  s = recordChanges(s, ch, 30);
  assert.equal(skillState(s, ch.id).passed, true);
  assert.throws(() => recordChanges(s, ch, -1));
});

test("units open in order, and the path follows the first unfinished one", () => {
  let s = emptyState();
  assert.equal(unitUnlocked(s, UNITS, 0), true);
  assert.equal(unitUnlocked(s, UNITS, 1), false);
  assert.equal(currentUnit(s, UNITS).id, "u1");
  assert.equal(skillUnlocked(s, UNITS, UNITS[1], 0), false, "unit 2's first skill waits for unit 1");
  for (const sk of UNITS[0].skills) s = { ...s, skills: { ...s.skills, [sk.id]: { passed: true, attempts: 1 } } };
  assert.equal(unitUnlocked(s, UNITS, 1), true);
  assert.equal(skillUnlocked(s, UNITS, UNITS[1], 0), true);
  assert.equal(skillUnlocked(s, UNITS, UNITS[1], 1), false);
  assert.equal(currentUnit(s, UNITS).id, "u2");
  for (const sk of allSkills()) s = { ...s, skills: { ...s.skills, [sk.id]: { passed: true, attempts: 1 } } };
  assert.equal(currentUnit(s, UNITS).id, UNITS.at(-1).id, "all done: the last unit");
});

test("passing a skill unlocks the next and counts toward the unit", () => {
  let s = rateReps(emptyState(), skill("u1-setup"), true);
  assert.equal(isUnlocked(s, unit, 1), true);
  assert.equal(nextSkill(s, unit).id, "u1-em");
  assert.deepEqual(unitProgress(s, unit), { passed: 1, total: 6, done: false });
});

test("run length: fixed bars, or a minute's worth at the current tempo", () => {
  assert.equal(runBars(skill("u1-strum"), 70), 8);
  assert.equal(runBars(skill("u1-loop"), 80), 20);
  assert.equal(runBars(skill("u1-loop"), 60), 15);
});

test("practice minutes and streak come from the log", () => {
  const day = new Date(2026, 9, 29, 18, 0);
  const at = (d, h, m) => new Date(2026, 9, d, h, m).getTime();
  const s = {
    ...emptyState(),
    log: [
      { at: at(27, 18, 0) }, { at: at(28, 18, 0) },
      { at: at(29, 17, 0) }, { at: at(29, 17, 3) }, { at: at(29, 17, 6) }, // 6 min + 1
      { at: at(29, 17, 30) }, // after a long gap: +0
    ],
  };
  assert.equal(practiceMinutes(s, day), 7);
  assert.equal(streakDays(s, day), 3);
  assert.equal(streakDays(s, new Date(2026, 9, 30, 9)), 3, "not practised yet today keeps the streak");
  assert.equal(streakDays(s, new Date(2026, 10, 1, 9)), 0);
});

test("store survives missing, broken and full storage", () => {
  const mem = new Map();
  const fake = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.deepEqual(load(fake), emptyState());
  const s = rateReps(emptyState(), skill("u1-setup"), true, 1);
  assert.equal(save(s, fake), true);
  assert.deepEqual(load(fake), s);
  mem.set("octave:v1", "{not json");
  assert.deepEqual(load(fake), emptyState());
  const full = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.equal(save(s, full), false);
  const blocked = { getItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(load(blocked), emptyState());
});
