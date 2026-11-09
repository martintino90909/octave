import test from "node:test";
import assert from "node:assert/strict";
import { CHORDS, UNITS } from "../public/lib/path.js";
import { SONGS, sectionSkill } from "../public/lib/songs.js";
import { chartFor, Grader, scoreRun, advice, graded, guideScore, canPlay, playBpm } from "../public/lib/play.js";
import { renderScore } from "../public/lib/demo.js";
import { prepare, prober, presence, attack } from "../public/lib/pitch.js";
import { phoneTake, SR } from "./phone-sim.js";

const FRAME = 4096;
const STEP = 0.04;
// how far behind real time a reading's onset lands; the app subtracts the same
export const READ_LAG = 0.045;

// Feeds a take to a grader the way the app does: a reading every 40 ms of the
// last 4096 samples.
function grade(chart, audio, { mode = "time", ...opts } = {}) {
  const g = new Grader(chart, { mode, ...opts });
  for (let T = FRAME / SR; T < audio.length / SR; T += STEP) {
    const end = Math.floor(T * SR);
    const raw = audio.subarray(end - FRAME, end);
    const frame = prepare(raw, SR);
    const { hf, prev } = attack(raw);
    g.update({ t: T - READ_LAG, wall: T, level: frame.level, probe: prober(frame, SR, { gate: 0.003 }), hf, hfPrev: prev });
  }
  // flush: a little silence after the end
  const quiet = prepare(new Float32Array(FRAME), SR);
  for (let k = 1; k < 20; k++) g.update({ t: audio.length / SR + k * STEP, wall: audio.length / SR + k * STEP, level: 0, probe: () => 0 });
  void quiet;
  return { g, score: scoreRun(g.results, g.total, { speed: chart.speed }) };
}

// The plucks a player makes for a chart: every event played, shifted by
// `late` seconds; `change` alters an event's plucks (wrong notes, missed ones).
function performance(chart, { late = 0, jitter = 0.02, change, seed = 3, ups = true } = {}) {
  let r = seed;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647) - 0.5;
  const plucks = [];
  for (const ev of chart.events) {
    if (ev.kind === "strum" && ev.dir === "U" && !ups) continue;
    const at = ev.t + late + rand() * jitter;
    let ps = [];
    if (ev.kind === "note") ps = [{ at, s: ev.s, freq: ev.freq }];
    if (ev.kind === "strum") {
      const order = ev.dir === "U" ? ev.tones.slice(-4).reverse() : ev.tones;
      ps = order.map((x, k) => ({ at: at + k * 0.012, s: x.s, freq: x.freq, gain: ev.dir === "U" ? 0.5 : 0.9 }));
    }
    if (change) ps = change(ev, ps) ?? ps;
    plucks.push(...ps);
  }
  return phoneTake(damped(plucks), chart.length + 0.8, { seed });
}

// A string stops ringing when it's played again, as on a real guitar.
function damped(plucks) {
  const last = new Map();
  const out = plucks.map((p) => ({ ...p })).sort((a, b) => a.at - b.at);
  for (const p of out) {
    const s = p.s ?? Math.round(p.freq);
    if (last.has(s)) last.get(s).until ??= p.at;
    last.set(s, p);
  }
  return out;
}

const notesSkill = UNITS.flatMap((u) => u.skills).find((s) => s.check === "notes" && s.notes?.length >= 8 && s.notes.every((n) => Array.isArray(n)));
const song = (id) => {
  const so = SONGS.find((s) => s.id === id);
  return { ...sectionSkill(so, so.sections[0]), capo: 0 };
};

test("prober gives the same values as presence, for one pass", () => {
  const audio = phoneTake([{ at: 0, s: 1, f: 3 }], 0.5);
  const frame = prepare(audio.subarray(4000, 4000 + FRAME), SR);
  const p = prober(frame, SR);
  for (const f of [82.41, 110, 130.81, 196, 261.63, 329.63]) assert.ok(Math.abs(p(f) - presence(frame, SR, f)) < 1e-6, String(f));
});

test("charts: every playable skill and every song section builds, with times in order", () => {
  for (const s of UNITS.flatMap((u) => u.skills)) {
    if (!canPlay(s)) continue;
    const c = chartFor(s, CHORDS, {});
    assert.ok(c && c.events.length, s.id);
    assert.ok(c.events.every((e, k) => k === 0 || e.t >= c.events[k - 1].t), `${s.id} in order`);
    assert.ok(c.events[0].t >= c.countIn - 1e-9 && c.events.at(-1).t < c.length, `${s.id} inside`);
  }
  for (const so of SONGS) for (const sec of so.sections) assert.ok(chartFor(sectionSkill(so, sec), CHORDS, {}).events.some((e) => graded(e)), so.id);
});

test("speed scales the tempo and caps the stars", () => {
  const s = song("knockin");
  assert.equal(chartFor(s, CHORDS, { speed: 0.5 }).bpm, Math.round(playBpm(s) * 0.5));
  const res = (n) => Array.from({ length: n }, (_, i) => ({ ev: { t: i }, ok: true, grade: "perfect", dt: 0 }));
  assert.equal(scoreRun(res(10), 10, { speed: 1 }).stars, 3);
  assert.equal(scoreRun(res(10), 10, { speed: 0.8 }).stars, 2);
  assert.equal(scoreRun(res(10), 10, { speed: 0.6 }).stars, 1);
  assert.equal(scoreRun(res(4), 10).stars, 0);
  assert.equal(scoreRun(res(8), 10).stars, 2);
});

test("single notes played on time score three stars, centred on the beat", () => {
  const chart = chartFor(notesSkill, CHORDS, {});
  const { score } = grade(chart, performance(chart));
  assert.ok(score.pct >= 90 && score.stars === 3, JSON.stringify(score));
  // READ_LAG is set from recorded-guitar takes, whose attack is sharper than
  // this model's, so the model reads a touch late; still well inside Perfect
  assert.ok(Math.abs(score.median) < 0.075, `median ${score.median}`);
});

test("late notes still count, as good and late, and the advice says so", () => {
  const chart = chartFor(notesSkill, CHORDS, {});
  const { score } = grade(chart, performance(chart, { late: 0.16, jitter: 0.01 }));
  assert.ok(score.good >= score.total * 0.7, JSON.stringify(score));
  assert.ok(score.late >= 3 && /late/.test(advice(score)));
});

test("a wrong fret is a miss for a wrong note", () => {
  const chart = chartFor(notesSkill, CHORDS, {});
  const wrong = new Set(chart.events.filter((_, k) => k % 2).map((e) => e.i));
  const audio = performance(chart, { change: (ev, ps) => (wrong.has(ev.i) ? ps.map((p) => ({ ...p, freq: p.freq * 2 ** (1 / 12) })) : ps) });
  const { g, score } = grade(chart, audio);
  const missed = g.results.filter((r) => !r.ok);
  assert.ok(missed.length >= wrong.size - 1 && missed.every((r) => wrong.has(r.ev.i)), JSON.stringify(score));
  assert.ok(missed.filter((r) => r.why === "note").length >= wrong.size / 2);
  assert.ok(score.stars <= 1);
});

test("silence scores nothing, and the run still finishes", () => {
  const chart = chartFor(notesSkill, CHORDS, {});
  const { g, score } = grade(chart, phoneTake([], chart.length + 0.5));
  assert.ok(g.done && score.pct === 0 && score.stars === 0);
  assert.ok(g.results.every((r) => r.why === "silent"));
});

test("the count-in and beat ticks aren't heard as notes", () => {
  const chart = chartFor(notesSkill, CHORDS, {});
  const ticks = renderScore(guideScore(chart), SR, { peak: 0.3 });
  const audio = phoneTake([], chart.length + 0.5);
  for (let i = 0; i < ticks.length && i < audio.length; i++) audio[i] += ticks[i];
  const { score } = grade(chart, audio);
  assert.equal(score.perfect + score.good, 0);
});

test("strummed chords on time score high; the wrong chord doesn't", () => {
  const s = song("knockin");
  const chart = chartFor(s, CHORDS, {});
  const good = grade(chart, performance(chart)).score;
  assert.ok(good.pct >= 90 && good.stars === 3, JSON.stringify(good));
  assert.ok(Math.abs(good.median) < 0.05, `median ${good.median}`);
  // C shape all the way through
  const audio = performance(chart, {
    change: (ev, ps) => (ev.kind === "strum" ? ps.map((p, k) => ({ ...p, freq: [130.81, 164.81, 196, 261.63, 329.63][k % 5] })) : ps),
  });
  const bad = grade(chart, audio);
  const onC = bad.g.results.filter((r) => r.ev.chord === "C");
  // Am shares two of its three notes with C, so only G and D must fail
  const offC = bad.g.results.filter((r) => r.ev.chord === "G" || r.ev.chord === "D");
  assert.ok(offC.every((r) => !r.ok), JSON.stringify(bad.score));
  assert.ok(onC.filter((r) => r.ok).length >= onC.length * 0.7);
  assert.ok(bad.score.why.chord >= 3);
});

test("fingerpicked songs grade each picked note", () => {
  const s = song("exitmusic");
  const chart = chartFor(s, CHORDS, {});
  assert.ok(chart.events.every((e) => e.kind === "note"));
  const { score } = grade(chart, performance(chart, { jitter: 0.015 }));
  assert.ok(score.pct >= 80, JSON.stringify(score));
});

test("wait mode stops at each note until it's played", () => {
  const chart = chartFor(notesSkill, CHORDS, {});
  const g = new Grader(chart, { mode: "wait" });
  // a slow player: the first note just after the count-in, then one every
  // 1.3 s, slower than the chart's beat, so it has to wait each time
  const start = chart.countIn + 0.5;
  const plucks = g.todo.map((ev, k) => ({ at: start + k * 1.3, s: ev.s, freq: ev.freq }));
  const len = start + g.todo.length * 1.3 + 1;
  const audio = phoneTake(damped(plucks), len);
  let chartT = 0;
  let doneAt = null;
  for (let T = FRAME / SR; T < len; T += STEP) {
    const cur = g.current;
    chartT = cur ? Math.min(chartT + STEP, cur.t) : chartT + STEP;
    const end = Math.floor(T * SR);
    const frame = prepare(audio.subarray(end - FRAME, end), SR);
    g.update({ t: chartT, wall: T, level: frame.level, probe: prober(frame, SR, { gate: 0.003 }) });
    if (g.done && doneAt === null) doneAt = { T, chartT };
  }
  assert.ok(g.done, `${g.results.length} of ${g.total}`);
  assert.ok(g.results.every((r) => r.ok && r.grade === "perfect"));
  // the chart stood at the last note until it was played, long after its time
  assert.ok(Math.abs(doneAt.chartT - chart.events.at(-1).t) < 0.01 && doneAt.T > chart.events.at(-1).t + 4, JSON.stringify(doneAt));
});

test("guide score: ticks every beat, guide plucks only when asked, wait mode gets only the count-in", () => {
  const chart = chartFor(song("yellow"), CHORDS, {});
  const plain = guideScore(chart);
  assert.ok(plain.events.every((e) => e.kind === "tick"));
  assert.equal(plain.events.length, chart.ticks.length);
  assert.ok(guideScore(chart, { guide: true }).events.some((e) => e.kind === "pluck"));
  assert.equal(guideScore(chart, { mode: "wait" }).events.length, chart.beatsPerBar);
});

test("notes played well after the window are misses marked late, and the advice points at timing", () => {
  const chart = chartFor(notesSkill, CHORDS, {});
  const { g, score } = grade(chart, performance(chart, { late: 0.36, jitter: 0.01 }));
  const late = g.results.filter((r) => r.why === "late").length;
  assert.ok(late >= score.total * 0.6, JSON.stringify(score));
  assert.match(advice(score), /mic delay/);
});
