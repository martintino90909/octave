import { UNITS, STAGES, CHORDS, findSkill, findUnit, skillChords, runBars } from "./lib/path.js";
import {
  rateReps, rateLadder, recordChanges, skillState, nextSkill, skillUnlocked, unitUnlocked,
  currentUnit, unitProgress, currentBpm, practiceMinutes, streakDays,
} from "./lib/progress.js";
import { load, save } from "./lib/store.js";
import { chordSvg } from "./lib/chord.js";
import { Metronome, audio, beep, keepAwake } from "./lib/metronome.js";
import { EAR, makeQuestion, toScore as earScore } from "./lib/ear.js";
import { noteTargets } from "./lib/tunecheck.js";
import { mountTuner, mountStringCheck, mountNoteCheck, describeNote, stringName } from "./micui.js";
import { demoFor, guideFor, strumDemo } from "./lib/demo.js";
import { playScore, stopDemo, loadBank } from "./lib/demoplay.js";
import { SONGS, findSong, songChords, sectionSkill, listenUrl } from "./lib/songs.js";

let state = load();
const main = document.getElementById("main");
let cleanup = null;

function commit(next) {
  state = next;
  save(state);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const buzz = () => navigator.vibrate?.(8);

function toast(text) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// ---------- routing ----------

function route() {
  cleanup?.();
  cleanup = null;
  stopDemo();
  keepAwake(false);
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, page, id, sub] = hash.split("/");
  document.querySelectorAll(".tabs a").forEach((a) => {
    const on = (page || "path") === a.dataset.tab || ((page === "skill" || page === "unit") && a.dataset.tab === "path") || (page === "song" && a.dataset.tab === "songs");
    a.toggleAttribute("aria-current", on);
  });
  if (page === "skill" && id) renderSkill(id);
  else if (page === "metronome") renderMetronome();
  else if (page === "tuner") renderTuner();
  else if (page === "songs") renderSongs();
  else if (page === "song" && id) renderSong(id, sub);
  else renderPath(page === "unit" ? id : null);
  main.scrollTop = 0;
}
window.addEventListener("hashchange", route);

// ---------- path ----------

const ICON_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_LOCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

function renderPath(unitId) {
  const unit = (unitId && findUnit(unitId)) || currentUnit(state, UNITS);
  const ui = UNITS.indexOf(unit);
  const open = unitUnlocked(state, UNITS, ui);
  const prog = unitProgress(state, unit);
  const next = open ? nextSkill(state, unit) : null;
  const following = UNITS[ui + 1];
  const stage = STAGES.find((s) => s.id === unit.stage);
  const working = currentUnit(state, UNITS);

  const steps = unit.skills.map((s, i) => {
    const ss = skillState(state, s.id);
    const can = skillUnlocked(state, UNITS, unit, i);
    const cls = ss.passed ? "done" : s === next ? "current" : can ? "open" : "locked";
    const node = ss.passed ? ICON_CHECK : can ? `<span>${i + 1}</span>` : ICON_LOCK;
    const body = `<span class="node">${node}</span>
      <span class="text"><span class="title">${esc(s.title)}</span><span class="gate">${esc(s.gate)}</span></span>`;
    return can
      ? `<li class="step ${cls}"><a href="#/skill/${s.id}">${body}</a></li>`
      : `<li class="step ${cls}"><div aria-disabled="true">${body}</div></li>`;
  });

  let resume;
  if (!open) {
    resume = `<div class="resume finished"><span>Locked</span><b>Finish Unit ${unit.number - 1} to open this</b></div>`;
  } else if (next) {
    resume = `<a class="resume" href="#/skill/${next.id}"><span>Next up</span><b>${esc(next.title)}</b></a>`;
  } else if (following) {
    resume = `<a class="resume" href="#/unit/${following.id}"><span>Unit ${unit.number} complete. Next: unit ${following.number}</span><b>${esc(following.title)}</b></a>`;
  } else {
    resume = `<div class="resume finished"><span>Path complete</span><b>Every gate passed</b></div>`;
  }

  const unitList = STAGES.map((st) => {
    const rows = UNITS.filter((u) => u.stage === st.id).map((u) => {
      const k = UNITS.indexOf(u);
      const p = unitProgress(state, u);
      const can = unitUnlocked(state, UNITS, k);
      const cls = [p.done ? "done" : can ? "open" : "locked", u === unit ? "viewing" : "", u === working ? "working" : ""].join(" ");
      const status = p.done ? ICON_CHECK : can ? `<span class="frac">${p.passed}/${p.total}</span>` : ICON_LOCK;
      const inner = `<span class="un">${u.number}</span><span class="ut">${esc(u.title)}</span><span class="us">${status}</span>`;
      return `<li class="${cls}">${can ? `<a href="#/unit/${u.id}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
    });
    return `<div class="stage-block"><h3>${esc(st.name)}</h3><p>${esc(st.goal)}</p><ol>${rows.join("")}</ol></div>`;
  });

  main.innerHTML = `
    <header class="top">
      <div class="wordmark">Octave</div>
      <div class="stats">
        <span><b>${practiceMinutes(state)}</b> min today</span>
        <span><b>${streakDays(state)}</b>-day streak</span>
      </div>
    </header>
    <section class="unit-head">
      <p class="where">${esc(stage.name)}, unit ${unit.number} of ${UNITS.length}</p>
      <h1>${esc(unit.title)}</h1>
      <p class="summary">${esc(unit.summary)}</p>
      <div class="segments" aria-hidden="true">${unit.skills.map((s) => `<i class="${skillState(state, s.id).passed ? "on" : ""}"></i>`).join("")}</div>
      <p class="count">${prog.passed} of ${prog.total} gates passed</p>
    </section>
    ${resume}
    <ol class="path">${steps.join("")}</ol>
    <section class="later">
      <h2>The road to jazz</h2>
      ${unitList.join("")}
    </section>`;
}

// ---------- skill ----------

function renderSkill(id) {
  const found = findSkill(id);
  if (!found) return (location.hash = "#/");
  const { skill, unit } = found;
  const index = unit.skills.indexOf(skill);
  if (!skillUnlocked(state, UNITS, unit, index)) return (location.hash = `#/unit/${unit.id}`);
  const ss = skillState(state, skill.id);
  const next = nextSkill(state, unit);
  const following = UNITS[UNITS.indexOf(unit) + 1];
  const chords = skillChords(skill);

  main.innerHTML = `
    <header class="bar">
      <a class="back" href="#/unit/${unit.id}" aria-label="Back to unit ${unit.number}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <span>Unit ${unit.number}, skill ${index + 1} of ${unit.skills.length}</span>
    </header>
    <section class="skill-head">
      <h1>${esc(skill.title)}</h1>
      <p class="gate-line ${ss.passed ? "passed" : ""}">${ss.passed ? ICON_CHECK : ""}<span>${esc(skill.gate)}</span></p>
    </section>
    ${ss.passed ? `<div class="passed-note">
        <span>Gate passed. Keep drilling it, or move on.</span>
        ${next ? `<a href="#/skill/${next.id}">Next: ${esc(next.title)}</a>`
          : following ? `<a href="#/unit/${following.id}">Unit ${unit.number} done. On to unit ${following.number}: ${esc(following.title)}</a>`
          : `<a href="#/">Back to the path</a>`}
      </div>` : ""}
    <section class="demo" id="demo"></section>
    <div id="panel"></div>
    ${chordFigures(chords)}
    <section class="how">
      <h2>How to do it</h2>
      <ol>${skill.how.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
    </section>`;

  const panel = main.querySelector("#panel");
  const rerender = (passedBefore) => {
    const passedNow = skillState(state, skill.id).passed;
    renderSkill(skill.id);
    if (passedNow && !passedBefore) {
      toast(`Gate passed: ${skill.title}`);
      buzz();
    }
  };
  if (skill.type === "reps") repsPanel(panel, skill, rerender);
  if (skill.type === "ladder") ladderPanel(panel, skill, rerender);
  if (skill.type === "changes") changesPanel(panel, skill, rerender);
  if (skill.type === "ear") earPanel(panel, skill, rerender);
  mountDemo(main.querySelector("#demo"), skill, panel, { bpm: skill.type === "ladder" ? currentBpm(state, skill) : null });
  wireChordTaps(skill);
}

// ---------- demos ----------

const STRING_NAMES = ["Low E", "A", "D", "G", "B", "High E"];
const PC = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const OPEN = [40, 45, 50, 55, 59, 64];
const ICON_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>`;
const ICON_STOP = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor"/></svg>`;

// Open-string names under chord boxes, for retuned songs.
const stringNames = (tuning) => OPEN.map((m, i) => PC[(m + (tuning?.[i] || 0)) % 12]);

function chordFigures(ids, tuning) {
  if (!ids.length) return "";
  const names = stringNames(tuning);
  return `<div class="chords">${ids.map((c) => `<figure data-chord="${c}" role="button" tabindex="0" aria-label="Hear ${esc(CHORDS[c].name)}">
    ${chordSvg(CHORDS[c], "", names)}<figcaption>${esc(CHORDS[c].name)}</figcaption></figure>`).join("")}</div>
    <p class="tap-hint">Tap a chord box to hear it</p>`;
}

// Tapping a chord box strums it, at the song's capo and tuning if it has them.
function wireChordTaps(skill) {
  main.querySelectorAll(".chords figure[data-chord]").forEach((fig) => {
    const play = () => {
      fig.classList.add("sounding");
      playScore(strumDemo(CHORDS[fig.dataset.chord], { capo: skill.capo || 0, tuning: skill.tuning }), {
        onEnd: () => fig.classList.remove("sounding"),
      });
    };
    fig.addEventListener("click", play);
    fig.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), play()));
  });
}

// The "Hear it" card: plays the skill's demo and lights up the screen in time.
// panel.view, when a ladder panel set one, shows the beat, strum and chord.
function mountDemo(el, skill, panel, { bpm, note } = {}) {
  const d = demoFor(skill, CHORDS, { bpm });
  const listen = skill.listen;
  if (!d && !listen) return el.remove();
  if (d) loadBank(); // fetch the guitar notes while you read
  // default to the goal tempo: the demo is what you're aiming for
  let speed = d?.speeds ? d.speeds[d.speeds.length - 1] : null;
  el.innerHTML = `
    ${d ? `<div class="demo-row">
      <button type="button" class="demo-play" id="demo-play">${ICON_PLAY}<span>Hear it</span></button>
      ${d.speeds?.length > 1 ? `<div class="demo-speeds" role="radiogroup" aria-label="Demo tempo">
        ${d.speeds.map((b) => `<button type="button" role="radio" data-bpm="${b}" aria-checked="${b === speed}">${b}</button>`).join("")}
        <span>BPM</span></div>` : d.speeds ? `<span class="demo-at">${d.speeds[0]} BPM</span>` : ""}
    </div>
    <p class="demo-cap" id="demo-cap" aria-live="polite">${esc(d.caption)}</p>` : ""}
    ${note ? `<p class="demo-note">${esc(note)}</p>` : ""}
    ${listen ? `<a class="listen" href="${listenUrl(listen)}" target="_blank" rel="noopener">Hear ${esc(listen.title)} on Spotify<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h9v9M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : ""}`;
  if (!d) return;

  const btn = el.querySelector("#demo-play");
  const cap = el.querySelector("#demo-cap");
  const figs = [...main.querySelectorAll(".chords figure")];
  let handle = null;
  const total = skill.notes?.length || 0;

  const reset = () => {
    handle = null;
    btn.innerHTML = `${ICON_PLAY}<span>Hear it</span>`;
    btn.classList.remove("playing");
    cap.textContent = d.caption;
    panel?.view?.reset();
    figs.forEach((f) => f.classList.remove("sounding"));
  };
  const onCue = (c) => {
    if (c.countIn !== undefined || c.step !== undefined) panel?.view?.show(c);
    if (c.countIn) cap.textContent = `Count-in: ${c.beat + 1}`;
    else if (c.bar) cap.textContent = `Bar ${c.bar}`;
    if (c.string !== undefined) cap.textContent = `${STRING_NAMES[c.string]} string`;
    else if (c.label) cap.textContent = c.label;
    if (c.index !== undefined) cap.textContent = `Note ${c.index + 1} of ${total}`;
    if (c.chord !== undefined) {
      const id = skill.pair[c.chord];
      figs.forEach((f) => f.classList.toggle("sounding", f.dataset.chord === id));
      cap.textContent = CHORDS[id].name;
    }
  };

  btn.addEventListener("click", () => {
    if (handle) return handle.stop();
    btn.innerHTML = `${ICON_STOP}<span>Stop</span>`;
    btn.classList.add("playing");
    panel?.view?.prepare?.();
    handle = playScore(d.score(speed), { onCue, onEnd: reset, onLoading: () => (cap.textContent = "Loading guitar sounds…") });
  });
  el.querySelectorAll("[data-bpm]").forEach((b) =>
    b.addEventListener("click", () => {
      speed = Number(b.dataset.bpm);
      el.querySelectorAll("[data-bpm]").forEach((x) => x.setAttribute("aria-checked", x === b));
      if (handle) {
        handle.stop();
        btn.click();
      }
    }),
  );
}

// The last mic check per skill, shown again after the page redraws.
const lastCheck = {};

function repsPanel(panel, skill, rerender) {
  const ss = skillState(state, skill.id);
  const streak = Math.min(ss.streak || 0, skill.streak);
  const mic = ["tuning", "strings", "notes"].includes(skill.check);
  const last = lastCheck[skill.id];
  panel.innerHTML = `
    <div class="panel">
      ${skill.streak > 1 ? `
        <div class="big"><span>${streak}</span><small>of ${skill.streak}</small></div>
        <p class="caption">clean in a row</p>
        <div class="pips" aria-hidden="true">${Array.from({ length: skill.streak }, (_, i) => `<i class="${i < streak ? "on" : ""}"></i>`).join("")}</div>` : ""}
      ${last ? `<p class="last-check ${last.ok ? "ok" : "bad"}">${esc(last.text)}</p>` : ""}
      ${mic ? `<div id="mic-area"></div>` : ""}
      <div class="manual" ${mic ? "hidden" : ""}>
        <p class="question">${esc(skill.rateLabel)}</p>
        <div class="rate two">
          <button type="button" data-r="miss">No</button>
          <button type="button" data-r="clean" class="primary">Yes</button>
        </div>
      </div>
      ${mic ? `<button type="button" class="linkish" id="manual-toggle">No mic? Rate it yourself</button>` : ""}
    </div>`;

  const record = (clean, text, results) => {
    const before = skillState(state, skill.id).passed;
    commit(rateReps(state, skill, clean));
    lastCheck[skill.id] = text ? { ok: clean, text, results } : null;
    buzz();
    rerender(before);
  };

  panel.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => record(b.dataset.r === "clean")));
  panel.querySelector("#manual-toggle")?.addEventListener("click", (e) => {
    panel.querySelector(".manual").hidden = false;
    e.target.remove();
  });

  const area = panel.querySelector("#mic-area");
  if (skill.check === "tuning") {
    cleanup = mountTuner(area, {
      timed: true,
      limit: 120,
      onDone: (secs) => {
        const t = `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")}`;
        record(secs <= 120, secs <= 120 ? `Tuned in ${t}` : `Tuned in ${t}. Under 2:00 passes the gate.`);
      },
    });
  }
  if (skill.check === "strings") {
    cleanup = mountStringCheck(area, CHORDS[skill.chord], {
      onResult: (clean, results) => {
        const bad = results.filter((r) => !r.ok);
        const text = clean
          ? "Clean try: every string rang true"
          : `Not clean: ${bad.map((r) => `${stringName(r.index)} ${r.heard ? `sounded ${r.heard}` : "didn't ring"}`).join(", ")}`;
        record(clean, text, results);
      },
      previous: last?.results,
    });
  }
  if (skill.check === "notes") {
    cleanup = mountNoteCheck(area, skill, {
      onResult: (clean, results) => {
        const bad = results.map((r, k) => ({ r, k })).filter(({ r }) => !r.ok);
        const miss = ({ r, k }) => `note ${k + 1} (${describeNote(r, skill.hideFrets)}) ${r.heard ? `sounded ${r.heard}` : "wasn't heard"}`;
        const text = clean
          ? "Clean run: every note right"
          : `Not clean: ${bad.slice(0, 2).map(miss).join("; ")}${bad.length > 2 ? `, and ${bad.length - 2} more` : ""}`;
        record(clean, text, results);
      },
      previous: last?.results,
    });
  }
}

function ladderRungs(skill, bpm, best) {
  const rungs = [];
  for (let t = skill.startBpm; t <= skill.targetBpm; t += skill.step) rungs.push(t);
  return rungs.map((t) => `<li class="${t === bpm ? "now" : t <= best ? "cleared" : ""}">${t}</li>`).join("");
}

function ladderPanel(panel, skill, rerender) {
  const ss = skillState(state, skill.id);
  const bpm = currentBpm(state, skill);
  const bars = runBars(skill, bpm);
  const prog = skill.progression || null;
  const sym = (id) => esc(CHORDS[id].sym);
  const tokens = skill.pattern ? skill.pattern.split(" ") : null;
  const per = tokens ? tokens.length / skill.beatsPerBar : 0;
  const counts = tokens ? countLabels(tokens.length, skill.beatsPerBar) : [];
  const picking = tokens?.some((t) => /^[T1-6]$/.test(t));
  const hasGuide = !!guideFor(skill, CHORDS, bpm, 1);
  if (hasGuide) loadBank();
  state.prefs ||= {};
  panel.innerHTML = `
    <div class="panel ladder ${prog ? "has-prog" : ""}">
      ${prog ? `
        <div class="pnow" aria-live="polite"><span class="pchord" id="p-now">${sym(prog[0])}</span><span class="pnext">then <b id="p-next">${sym(prog[1 % prog.length])}</b></span></div>
        <ol class="pchips" aria-label="Chord per bar">${prog.map((c, i) => `<li data-i="${i}">${sym(c)}</li>`).join("")}</ol>` : ""}
      <div class="tempo"><span class="bpm">${bpm}</span><span class="unit">BPM</span></div>
      <ol class="rungs" aria-label="Tempo ladder">${ladderRungs(skill, bpm, ss.best || 0)}</ol>
      <div class="beats" aria-hidden="true">${Array.from({ length: skill.beatsPerBar }, (_, i) => `<i class="${i === 0 ? "one" : ""}"></i>`).join("")}</div>
      ${tokens ? `<ol class="pattern ${tokens.length === 16 ? "sixteen" : ""}" style="grid-template-columns: repeat(${tokens.length}, 1fr)" aria-label="${picking ? "Picking" : "Strum"} pattern">${tokens.map((t, i) => `<li data-i="${i}" class="${t === "-" ? "rest" : t === "X" ? "chuck" : /^[T1-6]$/.test(t) ? "pick" : ""}"><b>${t === "-" ? "·" : t}</b><small>${counts[i]}</small></li>`).join("")}</ol>
        <p class="pkey">${picking ? "T thumb on the bass note; 1, 2, 3 pluck the high E, B and G strings" : `D down, U up${tokens.includes("X") ? ", X muted chuck" : ""}${tokens.includes("-") ? ", dot: hand moves but misses the strings" : ""}`}</p>` : ""}
      ${hasGuide ? `<label class="guide"><input type="checkbox" id="guide" ${state.prefs.guide ? "checked" : ""}> Guide guitar plays along with the run</label>` : ""}
      <p class="caption" id="barline">${bars} bars per run, after a 1-bar count-in</p>
      <button type="button" class="go" id="go">Start run</button>
      <div class="rate-wrap" id="rate" hidden>
        <p class="question">How was that run?</p>
        <div class="rate three">
          <button type="button" data-r="missed">Couldn't</button>
          <button type="button" data-r="sloppy">Sloppy</button>
          <button type="button" data-r="clean" class="primary">Clean</button>
        </div>
        <p class="hint">Clean moves up ${skill.step} BPM. Sloppy repeats this tempo. Couldn't moves down ${skill.step}.</p>
      </div>
    </div>`;

  const go = panel.querySelector("#go");
  const rate = panel.querySelector("#rate");
  const barline = panel.querySelector("#barline");
  const dots = [...panel.querySelectorAll(".beats i")];
  const cells = [...panel.querySelectorAll(".pattern li")];
  const chips = [...panel.querySelectorAll(".pchips li")];
  let metro = null;
  let guide = null;

  const showBar = (bar) => {
    if (!prog) return;
    const i = Math.max(0, bar - 1) % prog.length;
    const now = panel.querySelector("#p-now");
    now.textContent = CHORDS[prog[i]].sym;
    fitChord(now);
    panel.querySelector("#p-next").textContent = CHORDS[prog[(i + 1) % prog.length]].sym;
    chips.forEach((c, k) => c.classList.toggle("now", k === i));
  };

  fitChord(panel.querySelector("#p-now") || document.createElement("i"));

  const finish = () => {
    metro?.stop();
    metro = null;
    guide?.stop();
    guide = null;
    keepAwake(false);
    dots.forEach((d) => d.classList.remove("hit"));
    cells.forEach((c) => c.classList.remove("hit"));
    chips.forEach((c) => c.classList.remove("now"));
    showBar(1);
    go.textContent = "Run again";
    go.classList.remove("stop");
    panel.querySelector(".ladder").classList.remove("running");
    barline.textContent = "Rate the run, or run it again";
    rate.hidden = false;
  };

  go.addEventListener("click", () => {
    if (metro) return finish();
    rate.hidden = true;
    go.textContent = "Stop";
    go.classList.add("stop");
    keepAwake(true);
    // keep what you play from (the chord, the beat) on screen during the run
    panel.querySelector(".ladder").classList.add("running");
    panel.scrollIntoView({ block: "start", behavior: "smooth" });
    stopDemo();
    const guideScore = panel.querySelector("#guide")?.checked ? guideFor(skill, CHORDS, bpm, bars) : null;
    metro = new Metronome({
      bpm, beatsPerBar: skill.beatsPerBar, countInBars: 1, bars,
      onBeat: ({ beat, bar, countIn }) => {
        if (!metro) return;
        dots.forEach((d, i) => d.classList.toggle("hit", i === beat));
        cells.forEach((c, i) => c.classList.toggle("hit", !countIn && Math.floor(i / per) === beat));
        barline.textContent = countIn ? `Count-in: ${beat + 1}` : `Bar ${bar} of ${bars}`;
        showBar(countIn ? 1 : bar);
      },
      onEnd: () => metro && finish(),
    });
    metro.start();
    if (guideScore) guide = playScore(guideScore, { at: metro.startTime + (skill.beatsPerBar * 60) / bpm, volume: 0.5 });
  });

  panel.querySelector("#guide")?.addEventListener("change", (e) => {
    state.prefs = { ...state.prefs, guide: e.target.checked };
    save(state);
  });

  // lets the demo light up the beat, strum and chord as it plays
  panel.view = {
    prepare: () => {
      if (metro) finish();
    },
    show: ({ countIn, beat, bar, step }) => {
      dots.forEach((d, i) => d.classList.toggle("hit", i === beat));
      cells.forEach((c, i) => c.classList.toggle("hit", !countIn && i === step));
      showBar(countIn ? 1 : bar);
    },
    reset: () => {
      dots.forEach((d) => d.classList.remove("hit"));
      cells.forEach((c) => c.classList.remove("hit"));
      chips.forEach((c) => c.classList.remove("now"));
      showBar(1);
      if (prog) chips.forEach((c) => c.classList.remove("now"));
    },
  };

  rate.querySelectorAll("[data-r]").forEach((b) =>
    b.addEventListener("click", () => {
      const before = skillState(state, skill.id).passed;
      commit(rateLadder(state, skill, b.dataset.r));
      const after = currentBpm(state, skill);
      if (after !== bpm && !skillState(state, skill.id).passed) toast(after > bpm ? `Up to ${after} BPM` : `Back to ${after} BPM`);
      rerender(before);
    }),
  );

  cleanup = () => {
    metro?.stop();
    metro = null;
    guide?.stop();
    guide = null;
  };
}

// Long chord names (Gmaj7, Am(add9)) shrink so they fit beside "then".
function fitChord(el) {
  const n = el.textContent.length;
  el.style.fontSize = n > 5 ? "54px" : n > 3 ? "68px" : n > 2 ? "84px" : "";
}

// Count labels under a pattern: 1 & 2 & for eighths, 1 e & a for sixteenths,
// 1 to 6 for a bar of 6/8.
function countLabels(n, beats) {
  const per = n / beats;
  const sub = per === 4 ? ["", "e", "&", "a"] : per === 2 ? ["", "&"] : null;
  if (!sub) return Array.from({ length: n }, (_, i) => String(i + 1));
  return Array.from({ length: n }, (_, i) => (i % per === 0 ? String(i / per + 1) : sub[i % per]));
}

function changesPanel(panel, skill, rerender) {
  const ss = skillState(state, skill.id);
  const [a, b] = skill.pair;
  panel.innerHTML = `
    <div class="panel changes">
      <div class="idle" id="idle">
        <div class="big"><span>${ss.last ?? 0}</span><small>last</small></div>
        <p class="caption">Best ${ss.best || 0}. The gate is ${skill.target}.</p>
        <button type="button" class="go" id="go">Start the minute</button>
      </div>
      <button type="button" class="tap" id="tap" hidden aria-live="polite">
        <span class="clock" id="clock">60s</span>
        <span class="count" id="count">3</span>
        <span class="tap-label" id="tap-label">Get ready: ${esc(a)} first</span>
      </button>
      <div class="run-controls" id="controls" hidden>
        <button type="button" id="undo">Undo last tap</button>
        <button type="button" id="cancel">Cancel</button>
      </div>
    </div>`;

  const $ = (sel) => panel.querySelector(sel);
  let count = 0;
  let timer = null;
  let live = false;

  const end = (record) => {
    clearInterval(timer);
    timer = null;
    keepAwake(false);
    if (record) {
      const before = skillState(state, skill.id).passed;
      commit(recordChanges(state, skill, count));
      toast(`${count} changes`);
      rerender(before);
    } else {
      changesPanel(panel, skill, rerender);
    }
  };

  $("#go").addEventListener("click", () => {
    const ac = audio();
    $("#idle").hidden = true;
    $("#tap").hidden = false;
    $("#controls").hidden = false;
    keepAwake(true);
    let lead = 3;
    beep(ac.currentTime + 0.02, { freq: 880 });
    timer = setInterval(() => {
      if (!live) {
        lead--;
        if (lead > 0) {
          $("#count").textContent = lead;
          beep(ac.currentTime + 0.02, { freq: 880 });
          return;
        }
        live = true;
        count = 0;
        const startAt = Date.now();
        beep(ac.currentTime + 0.02, { freq: 1568, length: 0.15 });
        $("#count").textContent = "0";
        $("#tap-label").textContent = `Tap each clean change, ${a} to ${b} and back`;
        clearInterval(timer);
        timer = setInterval(() => {
          const left = Math.max(0, 60 - Math.floor((Date.now() - startAt) / 1000));
          $("#clock").textContent = `${left}s`;
          if (left <= 0) {
            beep(audio().currentTime + 0.02, { freq: 1568, length: 0.4 });
            end(true);
          }
        }, 200);
      }
    }, 1000);
  });

  $("#tap").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!live) return;
    count++;
    $("#count").textContent = count;
    buzz();
  });
  $("#undo").addEventListener("click", () => {
    if (!live || count === 0) return;
    count--;
    $("#count").textContent = count;
  });
  $("#cancel").addEventListener("click", () => end(false));

  cleanup = () => {
    clearInterval(timer);
    timer = null;
  };
}

// ---------- ear training ----------

const lastEar = {};

function earPanel(panel, skill, rerender) {
  const ss = skillState(state, skill.id);
  const streak = Math.min(ss.streak || 0, skill.streak);
  const last = lastEar[skill.id];
  const q = makeQuestion(skill.options);
  let heard = false;

  panel.innerHTML = `
    <div class="panel ear">
      <div class="big"><span>${streak}</span><small>of ${skill.streak}</small></div>
      <p class="caption">right in a row</p>
      ${last ? `<p class="last-check ${last.correct ? "ok" : "bad"}">${last.correct ? `Right: ${esc(EAR[last.q.answer].label)}` : `It was ${esc(EAR[last.q.answer].label)}`}
        <button type="button" class="linkish inline" id="replay-last">Hear it again</button></p>` : ""}
      <button type="button" class="go" id="play">Play ${q.kind === "interval" ? "the two notes" : "the chord"}</button>
      <p class="question">What did you hear?</p>
      <div class="ear-options">
        ${skill.options.map((o) => `<button type="button" data-o="${o}" disabled>${esc(EAR[o].label)}</button>`).join("")}
      </div>
    </div>`;

  loadBank();
  const play = (question) => playScore(earScore(question));

  panel.querySelector("#play").addEventListener("click", () => {
    play(q);
    heard = true;
    panel.querySelector("#play").textContent = "Play again";
    panel.querySelectorAll("[data-o]").forEach((b) => (b.disabled = false));
  });
  panel.querySelector("#replay-last")?.addEventListener("click", () => play(last.q));
  panel.querySelectorAll("[data-o]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!heard) return;
      const correct = b.dataset.o === q.answer;
      const before = skillState(state, skill.id).passed;
      commit(rateReps(state, skill, correct));
      lastEar[skill.id] = { correct, q };
      buzz();
      rerender(before);
    }),
  );
}

// ---------- songs ----------

const unitOf = (song) => findUnit(song.after);
const songReady = (song) => unitProgress(state, unitOf(song)).done;
const sectionsAtTempo = (song) => song.sections.filter((sec) => skillState(state, sectionSkill(song, sec).id).passed).length;

function songMeta(song) {
  return [
    song.capo ? `Capo ${song.capo}` : "No capo",
    song.tuning ? song.tuning.name : "",
    `about ${song.bpm} BPM`,
    song.beatsPerBar === 2 ? "6/8" : song.beatsPerBar === 3 ? "3/4" : "",
  ].filter(Boolean);
}

function renderSongs() {
  const order = (s) => UNITS.indexOf(unitOf(s));
  const sorted = [...SONGS].sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title));
  const row = (song) => {
    const done = sectionsAtTempo(song);
    const chords = songChords(song).map((c) => CHORDS[c].sym);
    const syms = chords.filter((c, i) => chords.indexOf(c) === i);
    return `<li><a href="#/song/${song.id}">
      <span class="st">${esc(song.title)}</span>
      <span class="sa">${esc(song.artist)}</span>
      <span class="sm">${songMeta(song).slice(0, 2).map(esc).join(" · ")}${songReady(song) ? "" : ` · after unit ${unitOf(song).number}`}</span>
      <span class="sc">${syms.map((c) => `<i>${esc(c)}</i>`).join("")}</span>
      ${done ? `<span class="sd">${done === song.sections.length ? ICON_CHECK : `${done}/${song.sections.length}`}</span>` : ""}
    </a></li>`;
  };
  const ready = sorted.filter(songReady);
  const later = sorted.filter((s) => !songReady(s));
  main.innerHTML = `
    <header class="top"><div class="wordmark">Songs</div></header>
    <p class="songs-intro">Hear the chords, then play along from a slow tempo up to the record's. Every song is open; the unit tag says when the path has taught what it needs.</p>
    ${ready.length ? `<h2 class="songs-h">Ready now</h2><ol class="songlist">${ready.map(row).join("")}</ol>` : ""}
    ${later.length ? `<h2 class="songs-h">Coming up on the path</h2><ol class="songlist">${later.map(row).join("")}</ol>` : ""}`;
}

function renderSong(id, sectionId) {
  const song = findSong(id);
  if (!song) return (location.hash = "#/songs");
  cleanup?.();
  cleanup = null;
  stopDemo();
  const section = song.sections.find((s) => s.id === sectionId) || song.sections[0];
  state.prefs ||= {};
  const capoOn = state.prefs.demoCapo !== false;
  const skill = { ...sectionSkill(song, section), listen: song };
  if (!capoOn) skill.capo = 0;
  const ss = skillState(state, skill.id);
  const unit = unitOf(song);

  main.innerHTML = `
    <header class="bar">
      <a class="back" href="#/songs" aria-label="Back to songs">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <span>${esc(song.artist)}</span>
    </header>
    <section class="skill-head">
      <h1>${esc(song.title)}</h1>
      <p class="song-meta">${songMeta(song).map((m) => `<span>${esc(m)}</span>`).join("")}</p>
      ${songReady(song) ? "" : `<p class="song-after">Best after unit ${unit.number}, ${esc(unit.title)}. Try it anyway.</p>`}
    </section>
    ${song.sections.length > 1 ? `<nav class="sections" aria-label="Sections">${song.sections.map((s) => `<a href="#/song/${song.id}/${s.id}" ${s === section ? `aria-current="page"` : ""}>${esc(s.name)}${skillState(state, sectionSkill(song, s).id).passed ? ICON_CHECK : ""}</a>`).join("")}</nav>` : ""}
    ${ss.passed ? `<div class="passed-note"><span>${esc(section.name)} played clean at the record's tempo.</span></div>` : ""}
    <section class="demo" id="demo"></section>
    ${song.capo ? `<label class="guide capo-toggle"><input type="checkbox" id="capo" ${capoOn ? "checked" : ""}> Demos with the capo on (the record's key). No capo? Untick so they match you.</label>` : ""}
    <div id="panel"></div>
    ${chordFigures(section.progression.filter((c, i) => section.progression.indexOf(c) === i), skill.tuning)}
    <section class="how">
      <h2>How to play it</h2>
      <ol>${song.how.map((h) => `<li>${esc(h)}</li>`).join("")}
        <li>Charts and tempos here follow common arrangements. Check them against the record by ear.</li></ol>
    </section>`;

  const panel = main.querySelector("#panel");
  ladderPanel(panel, skill, (before) => {
    const now = skillState(state, skill.id).passed;
    renderSong(song.id, section.id);
    if (now && !before) {
      toast(`${section.name} at record tempo`);
      buzz();
    }
  });
  mountDemo(main.querySelector("#demo"), skill, panel, { bpm: currentBpm(state, skill) });
  wireChordTaps(skill);
  main.querySelector("#capo")?.addEventListener("change", (e) => {
    state.prefs = { ...state.prefs, demoCapo: e.target.checked };
    save(state);
    renderSong(song.id, section.id);
  });
}

// ---------- tuner ----------

function renderTuner() {
  main.innerHTML = `
    <header class="top"><div class="wordmark">Tuner</div></header>
    <div class="panel" id="tuner-area"></div>
    <p class="note-under">Standard tuning, low to high: E A D G B E.</p>`;
  cleanup = mountTuner(main.querySelector("#tuner-area"));
}

// ---------- free metronome ----------

function renderMetronome() {
  state.prefs ||= {};
  let bpm = state.prefs.metroBpm || 80;
  let beats = state.prefs.metroBeats || 4;
  let metro = null;

  main.innerHTML = `
    <header class="top"><div class="wordmark">Metronome</div></header>
    <div class="panel free">
      <div class="tempo"><span class="bpm" id="bpm">${bpm}</span><span class="unit">BPM</span></div>
      <div class="nudge">
        <button type="button" data-d="-5" aria-label="Down 5">−5</button>
        <button type="button" data-d="-1" aria-label="Down 1">−1</button>
        <button type="button" data-d="1" aria-label="Up 1">+1</button>
        <button type="button" data-d="5" aria-label="Up 5">+5</button>
      </div>
      <input type="range" id="slider" min="40" max="200" value="${bpm}" aria-label="Tempo">
      <div class="beats" id="beats" aria-hidden="true"></div>
      <div class="seg" role="radiogroup" aria-label="Beats per bar">
        ${[2, 3, 4].map((n) => `<button type="button" role="radio" data-b="${n}" aria-checked="${n === beats}">${n} beats</button>`).join("")}
      </div>
      <button type="button" class="go" id="go">Start</button>
    </div>`;

  const $ = (sel) => main.querySelector(sel);
  const drawBeats = () => {
    $("#beats").innerHTML = Array.from({ length: beats }, (_, i) => `<i class="${i === 0 ? "one" : ""}"></i>`).join("");
  };
  drawBeats();

  const persist = () => {
    state.prefs = { ...state.prefs, metroBpm: bpm, metroBeats: beats };
    save(state);
  };
  const setBpm = (v) => {
    bpm = Math.max(40, Math.min(200, v));
    $("#bpm").textContent = bpm;
    $("#slider").value = bpm;
    if (metro) metro.bpm = bpm;
    persist();
  };
  const stop = () => {
    metro?.stop();
    metro = null;
    keepAwake(false);
    $("#go").textContent = "Start";
    $("#go").classList.remove("stop");
    main.querySelectorAll("#beats i").forEach((d) => d.classList.remove("hit"));
  };
  const start = () => {
    keepAwake(true);
    $("#go").textContent = "Stop";
    $("#go").classList.add("stop");
    metro = new Metronome({
      bpm, beatsPerBar: beats, countInBars: 0,
      onBeat: ({ beat }) => main.querySelectorAll("#beats i").forEach((d, i) => d.classList.toggle("hit", i === beat)),
    });
    metro.start();
  };

  main.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => setBpm(bpm + Number(b.dataset.d))));
  $("#slider").addEventListener("input", (e) => setBpm(Number(e.target.value)));
  main.querySelectorAll("[data-b]").forEach((b) =>
    b.addEventListener("click", () => {
      beats = Number(b.dataset.b);
      main.querySelectorAll("[data-b]").forEach((x) => x.setAttribute("aria-checked", x === b));
      drawBeats();
      persist();
      if (metro) {
        stop();
        start();
      }
    }),
  );
  $("#go").addEventListener("click", () => (metro ? stop() : start()));
  cleanup = stop;
}

route();
