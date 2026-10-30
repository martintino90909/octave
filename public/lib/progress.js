// Pure progress logic: no DOM, no storage. Every function takes the current
// state and returns a new one, so it can be tested in Node and later synced.

const LOG_LIMIT = 1000;

export function emptyState() {
  return { version: 1, skills: {}, log: [] };
}

export function skillState(state, id) {
  return state.skills[id] || { passed: false, attempts: 0 };
}

export function isUnlocked(state, unit, index) {
  if (index === 0) return true;
  return skillState(state, unit.skills[index - 1].id).passed;
}

export function nextSkill(state, unit) {
  return unit.skills.find((s, i) => isUnlocked(state, unit, i) && !skillState(state, s.id).passed) || null;
}

export function unitProgress(state, unit) {
  const passed = unit.skills.filter((s) => skillState(state, s.id).passed).length;
  return { passed, total: unit.skills.length, done: passed === unit.skills.length };
}

// A unit opens once every gate in the unit before it is passed.
export function unitUnlocked(state, units, index) {
  if (index === 0) return true;
  return unitProgress(state, units[index - 1]).done;
}

// Within an open unit, a skill opens once the skill before it is passed.
export function skillUnlocked(state, units, unit, index) {
  return unitUnlocked(state, units, units.indexOf(unit)) && isUnlocked(state, unit, index);
}

// The unit to work on: the first open one that isn't finished, else the last.
export function currentUnit(state, units) {
  const i = units.findIndex((u, k) => unitUnlocked(state, units, k) && !unitProgress(state, u).done);
  return units[i === -1 ? units.length - 1 : i];
}

export function currentBpm(state, skill) {
  return skillState(state, skill.id).bpm ?? skill.startBpm;
}

function update(state, skill, entry, change, now) {
  const prev = skillState(state, skill.id);
  const next = { ...prev, ...change, attempts: prev.attempts + 1, lastAt: now };
  if (next.passed && !prev.passed) next.passedAt = now;
  const log = [...state.log, { at: now, skill: skill.id, ...entry }].slice(-LOG_LIMIT);
  return { ...state, skills: { ...state.skills, [skill.id]: next }, log };
}

// "reps": a clean try extends the streak; any miss resets it.
export function rateReps(state, skill, clean, now = Date.now()) {
  const prev = skillState(state, skill.id);
  const streak = clean ? (prev.streak || 0) + 1 : 0;
  const passed = prev.passed || streak >= skill.streak;
  return update(state, skill, { kind: "reps", clean }, { streak, passed }, now);
}

// "ladder": clean at the target tempo passes; clean below it steps up;
// sloppy stays; missed steps back down (never below the start tempo).
export function rateLadder(state, skill, rating, now = Date.now()) {
  if (!["clean", "sloppy", "missed"].includes(rating)) throw new Error(`Unknown rating: ${rating}`);
  const prev = skillState(state, skill.id);
  const bpm = currentBpm(state, skill);
  let nextBpm = bpm;
  let passed = prev.passed;
  if (rating === "clean") {
    if (bpm >= skill.targetBpm) passed = true;
    else nextBpm = Math.min(skill.targetBpm, bpm + skill.step);
  } else if (rating === "missed") {
    nextBpm = Math.max(skill.startBpm, bpm - skill.step);
  }
  const best = rating === "clean" ? Math.max(prev.best || 0, bpm) : prev.best || 0;
  return update(state, skill, { kind: "ladder", rating, bpm }, { bpm: nextBpm, best, passed }, now);
}

// "changes": one-minute count; passes at the target.
export function recordChanges(state, skill, count, now = Date.now()) {
  if (!Number.isInteger(count) || count < 0) throw new Error(`Bad count: ${count}`);
  const prev = skillState(state, skill.id);
  const best = Math.max(prev.best || 0, count);
  const passed = prev.passed || count >= skill.target;
  return update(state, skill, { kind: "changes", count }, { last: count, best, passed }, now);
}

// Minutes practised on a given local day, estimated from the log:
// gaps under 5 minutes between entries count as practice time.
export function practiceMinutes(state, day = new Date()) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = start + 864e5;
  const times = state.log.map((e) => e.at).filter((t) => t >= start && t < end).sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap < 5 * 60e3) ms += gap;
  }
  if (times.length) ms += 60e3; // the first entry stands for about a minute of work
  return Math.round(ms / 60e3);
}

export function streakDays(state, today = new Date()) {
  const days = new Set(
    state.log.map((e) => {
      const d = new Date(e.at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(key(d))) d.setDate(d.getDate() - 1); // today not practised yet keeps yesterday's streak
  let n = 0;
  while (days.has(key(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
