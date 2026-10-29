import test from "node:test";
import assert from "node:assert/strict";
import { UNITS, CHORDS, findSkill, runBars, allSkills } from "../public/lib/path.js";
import {
  emptyState, rateReps, rateLadder, recordChanges, isUnlocked, nextSkill,
  unitProgress, currentBpm, practiceMinutes, streakDays, skillState,
} from "../public/lib/progress.js";
import { load, save } from "../public/lib/store.js";
import { chordSvg } from "../public/lib/chord.js";

const unit = UNITS[0];
const skill = (id) => findSkill(id).skill;

test("every skill has a known type, a gate, and valid chords", () => {
  const ids = new Set();
  for (const s of allSkills()) {
    assert.ok(["reps", "ladder", "changes"].includes(s.type), s.id);
    assert.ok(s.gate && s.how.length, s.id);
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`);
    ids.add(s.id);
    for (const c of [s.chord, ...(s.pair || [])].filter(Boolean)) assert.ok(CHORDS[c], `${s.id}: ${c}`);
    if (s.type === "ladder") assert.ok(s.startBpm < s.targetBpm && s.step > 0, s.id);
  }
});

test("chord shapes have six strings and fingers only on fretted notes", () => {
  for (const [name, c] of Object.entries(CHORDS)) {
    assert.equal(c.frets.length, 6, name);
    c.frets.forEach((f, i) => assert.equal(f > 0, c.fingers[i] > 0, `${name} string ${i}`));
    assert.match(chordSvg(c), /^<svg[\s\S]*<\/svg>$/);
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
