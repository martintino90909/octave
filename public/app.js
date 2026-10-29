import { UNITS, STAGES, CHORDS, findSkill, runBars } from "./lib/path.js";
import {
  rateReps, rateLadder, recordChanges, skillState, isUnlocked, nextSkill,
  unitProgress, currentBpm, practiceMinutes, streakDays,
} from "./lib/progress.js";
import { load, save } from "./lib/store.js";
import { chordSvg } from "./lib/chord.js";
import { Metronome, audio, beep, keepAwake } from "./lib/metronome.js";
import { mountTuner, mountStringCheck, stringName } from "./micui.js";

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
  keepAwake(false);
  const hash = location.hash.replace(/^#/, "") || "/";
  const [, page, id] = hash.split("/");
  document.querySelectorAll(".tabs a").forEach((a) => {
    const on = (page || "path") === a.dataset.tab || (page === "skill" && a.dataset.tab === "path");
    a.toggleAttribute("aria-current", on);
  });
  if (page === "skill" && id) renderSkill(id);
  else if (page === "metronome") renderMetronome();
  else if (page === "tuner") renderTuner();
  else renderPath();
  main.scrollTop = 0;
}
window.addEventListener("hashchange", route);

// ---------- path ----------

const ICON_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_LOCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor"/><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

function renderPath() {
  const unit = UNITS[0];
  const prog = unitProgress(state, unit);
  const next = nextSkill(state, unit);
  const mins = practiceMinutes(state);
  const streak = streakDays(state);
  const stage = STAGES.find((s) => s.id === unit.stage);

  const steps = unit.skills.map((s, i) => {
    const ss = skillState(state, s.id);
    const open = isUnlocked(state, unit, i);
    const cls = ss.passed ? "done" : s === next ? "current" : open ? "open" : "locked";
    const node = ss.passed ? ICON_CHECK : open ? `<span>${i + 1}</span>` : ICON_LOCK;
    const body = `<span class="node">${node}</span>
      <span class="text"><span class="title">${esc(s.title)}</span><span class="gate">${esc(s.gate)}</span></span>`;
    return open
      ? `<li class="step ${cls}"><a href="#/skill/${s.id}">${body}</a></li>`
      : `<li class="step ${cls}"><div aria-disabled="true">${body}</div></li>`;
  });

  main.innerHTML = `
    <header class="top">
      <div class="wordmark">Octave</div>
      <div class="stats">
        <span><b>${mins}</b> min today</span>
        <span><b>${streak}</b>-day streak</span>
      </div>
    </header>
    <section class="unit-head">
      <p class="where">${esc(stage.name)}, unit ${unit.number}</p>
      <h1>${esc(unit.title)}</h1>
      <p class="summary">${esc(unit.summary)}</p>
      <div class="segments" aria-hidden="true">${unit.skills.map((s) => `<i class="${skillState(state, s.id).passed ? "on" : ""}"></i>`).join("")}</div>
      <p class="count">${prog.passed} of ${prog.total} gates passed</p>
    </section>
    ${next ? `<a class="resume" href="#/skill/${next.id}"><span>Next up</span><b>${esc(next.title)}</b></a>`
      : `<div class="resume finished"><span>Unit ${unit.number} complete</span><b>Unit 2 is being written</b></div>`}
    <ol class="path">${steps.join("")}</ol>
    <section class="later">
      <h2>The road to jazz</h2>
      <ol class="stages">
        ${STAGES.map((s) => `<li class="${s.id === unit.stage ? "here" : ""}"><b>${esc(s.name)}</b><span>${esc(s.goal)}</span></li>`).join("")}
      </ol>
    </section>`;
}

// ---------- skill ----------

function renderSkill(id) {
  const found = findSkill(id);
  if (!found) return (location.hash = "#/");
  const { skill, unit } = found;
  const index = unit.skills.indexOf(skill);
  if (!isUnlocked(state, unit, index)) return (location.hash = "#/");
  const ss = skillState(state, skill.id);
  const next = nextSkill(state, unit);
  const chords = [skill.chord, ...(skill.pair || [])].filter((c, i, a) => c && a.indexOf(c) === i);

  main.innerHTML = `
    <header class="bar">
      <a class="back" href="#/" aria-label="Back to the path">
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
        ${next ? `<a href="#/skill/${next.id}">Next: ${esc(next.title)}</a>` : `<a href="#/">Back to the path</a>`}
      </div>` : ""}
    <div id="panel"></div>
    ${chords.length ? `<div class="chords">${chords.map((c) => `<figure>${chordSvg(CHORDS[c])}<figcaption>${esc(CHORDS[c].name)}</figcaption></figure>`).join("")}</div>` : ""}
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
}

// The last mic check per skill, shown again after the page redraws.
const lastCheck = {};

function repsPanel(panel, skill, rerender) {
  const ss = skillState(state, skill.id);
  const streak = Math.min(ss.streak || 0, skill.streak);
  const mic = skill.check === "tuning" || skill.check === "strings";
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
  panel.innerHTML = `
    <div class="panel ladder">
      <div class="tempo"><span class="bpm">${bpm}</span><span class="unit">BPM</span></div>
      <ol class="rungs" aria-label="Tempo ladder">${ladderRungs(skill, bpm, ss.best || 0)}</ol>
      <div class="beats" aria-hidden="true">${Array.from({ length: skill.beatsPerBar }, (_, i) => `<i class="${i === 0 ? "one" : ""}"></i>`).join("")}</div>
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
  let metro = null;

  const finish = () => {
    metro?.stop();
    metro = null;
    keepAwake(false);
    dots.forEach((d) => d.classList.remove("hit"));
    go.textContent = "Run again";
    go.classList.remove("stop");
    barline.textContent = "Rate the run, or run it again";
    rate.hidden = false;
  };

  go.addEventListener("click", () => {
    if (metro) return finish();
    rate.hidden = true;
    go.textContent = "Stop";
    go.classList.add("stop");
    keepAwake(true);
    metro = new Metronome({
      bpm, beatsPerBar: skill.beatsPerBar, countInBars: 1, bars,
      onBeat: ({ beat, bar, countIn }) => {
        if (!metro) return;
        dots.forEach((d, i) => d.classList.toggle("hit", i === beat));
        barline.textContent = countIn ? `Count-in: ${beat + 1}` : `Bar ${bar} of ${bars}`;
      },
      onEnd: () => metro && finish(),
    });
    metro.start();
  });

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
  };
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
