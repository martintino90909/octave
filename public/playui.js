// Play mode screen: set up a run, play it on a scrolling tab while the mic
// grades every note, then see the score and stars. Logic is in lib/play.js.

import { CHORDS } from "./lib/path.js";
import { chartFor, Grader, scoreRun, advice, guideScore, graded, STAR_AT } from "./lib/play.js";
import { openMic, micMessage } from "./lib/listen.js";
import { prepare, prober, attack } from "./lib/pitch.js";
import { playScore, stopDemo, loadBank } from "./lib/demoplay.js";
import { audio, keepAwake } from "./lib/metronome.js";
import { chordSvg } from "./lib/chord.js";

const SPEEDS = [0.6, 0.8, 1];
const READ_LAG = 0.045; // a reading's onset lands this far after the pluck (measured on recorded takes, test/play.test.js)
const PPS = 150; // pixels per second of scroll
const LINE_X = 64;
const H = 236;
const LANE_TOP = 58;
const LANE_GAP = 30;
const POP_LIFE = 0.75;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const laneY = (s) => LANE_TOP + (5 - s) * LANE_GAP; // tab order: high E on top
const STAR = (on, size = 40) => `<svg class="star ${on ? "on" : ""}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>`;
export const starsHtml = (n, size) => `<span class="stars" role="img" aria-label="${n} of 3 stars">${[0, 1, 2].map((k) => STAR(k < n, size)).join("")}</span>`;

const ICON_BACK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const playRecord = (state, id) => state.play?.[id] || { stars: 0, pct: 0, runs: 0 };

// cfg: { id, title, subtitle, back, skill, getState, setState, notes: [chips] }
// Returns a cleanup function.
export function renderPlay(main, cfg) {
  let stop = null;
  const state = () => cfg.getState();
  const prefs = () => state().prefs || {};
  const setPrefs = (p) => cfg.setState({ ...state(), prefs: { ...prefs(), ...p } });

  const setup = () => {
    stop?.();
    stop = null;
    const rec = playRecord(state(), cfg.id);
    const mode = prefs().playMode || "time";
    const speed = prefs().playSpeed?.[cfg.id] ?? 1;
    const preview = chartFor(cfg.skill, CHORDS, { speed });
    main.innerHTML = `
      <header class="bar">
        <a class="back" href="${cfg.back}" aria-label="Back">${ICON_BACK}</a>
        <span>Play along</span>
      </header>
      <section class="skill-head">
        <h1>${esc(cfg.title)}</h1>
        ${cfg.notes?.length ? `<p class="song-meta">${cfg.notes.map((n) => `<span>${esc(n)}</span>`).join("")}</p>` : ""}
        <p class="play-best">${starsHtml(rec.stars, 26)}<span>${rec.runs ? `Best ${rec.pct}%${rec.speed && rec.speed < 1 ? ` at ${Math.round(rec.speed * 100)}% speed` : ""}` : "Not played yet"}</span></p>
      </section>
      <div class="highway preview"><canvas id="hw" height="${H}" aria-label="Preview of the tab"></canvas></div>
      <div class="seg two" role="radiogroup" aria-label="Mode">
        <button type="button" role="radio" data-mode="time" aria-checked="${mode === "time"}">Keep time</button>
        <button type="button" role="radio" data-mode="wait" aria-checked="${mode === "wait"}">Wait for me</button>
      </div>
      <p class="mode-line" id="mode-line"></p>
      <div class="seg" role="radiogroup" aria-label="Speed" id="speeds" ${mode === "wait" ? "hidden" : ""}>
        ${SPEEDS.map((s) => `<button type="button" role="radio" data-speed="${s}" aria-checked="${s === speed}">${Math.round(s * 100)}%<small>${Math.round(preview.base * s)} BPM</small></button>`).join("")}
      </div>
      <label class="guide" id="guide-row" ${mode === "wait" ? "hidden" : ""}><input type="checkbox" id="guide" ${prefs().playGuide ? "checked" : ""}> Guide guitar plays along. Wear headphones, or the mic hears the guide instead of you.</label>
      <button type="button" class="go" id="start">Start</button>
      <p class="mic-err" id="err" role="alert" hidden></p>
      <section class="how">
        <h2>How it works</h2>
        <ol>
          <li>The tab scrolls right to left, high E string on top. Numbers are frets. Play each one as it reaches the yellow line.</li>
          <li>The mic grades every note and down-strum: <b>Perfect</b> on the beat, <b>Good</b> a little early or late, or <b>Miss</b>. Up-strums are shown dimmer and aren't graded.</li>
          <li>Stars: ${Math.round(STAR_AT[0] * 100)}% for one, ${Math.round(STAR_AT[1] * 100)}% for two, ${Math.round(STAR_AT[2] * 100)}% for three. Three stars only at full speed.</li>
          <li><b>Wait for me</b> stops at each note and chord change until you play it. Good for learning the shapes; it doesn't give stars.</li>
          <li>Prop the phone up near the guitar in a quiet room.</li>
        </ol>
      </section>`;

    const line = main.querySelector("#mode-line");
    const showMode = (m) => {
      line.textContent = m === "time" ? "Scrolls at the tempo. Graded on time and on the notes." : "Stops at each note until you play it. Not timed.";
      main.querySelector("#speeds").hidden = m === "wait";
      main.querySelector("#guide-row").hidden = m === "wait";
    };
    showMode(mode);
    main.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        main.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-checked", x === b));
        setPrefs({ playMode: b.dataset.mode });
        showMode(b.dataset.mode);
      }),
    );
    main.querySelectorAll("[data-speed]").forEach((b) =>
      b.addEventListener("click", () => {
        main.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-checked", x === b));
        setPrefs({ playSpeed: { ...(prefs().playSpeed || {}), [cfg.id]: Number(b.dataset.speed) } });
      }),
    );
    main.querySelector("#guide").addEventListener("change", (e) => {
      setPrefs({ playGuide: e.target.checked });
      if (e.target.checked) loadBank();
    });
    if (prefs().playGuide) loadBank();

    const hw = makeHighway(main.querySelector("#hw"), preview, { mode });
    hw.draw(preview.countIn - 0.25, null);
    const onResize = () => hw.draw(preview.countIn - 0.25, null);
    window.addEventListener("resize", onResize);
    stop = () => window.removeEventListener("resize", onResize);

    main.querySelector("#start").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const m = prefs().playMode || "time";
      const sp = prefs().playSpeed?.[cfg.id] ?? 1;
      const guide = m === "time" && !!prefs().playGuide;
      let mic;
      try {
        audio();
        mic = await openMic();
      } catch (err) {
        btn.disabled = false;
        const box = main.querySelector("#err");
        box.hidden = false;
        box.textContent = micMessage(err);
        return;
      }
      if (guide) {
        btn.textContent = "Loading guitar sounds…";
        await loadBank();
      }
      run(mic, { mode: m, speed: sp, guide });
    });
  };

  const run = (mic, { mode, speed, guide }) => {
    stop?.();
    const chart = chartFor(cfg.skill, CHORDS, { speed });
    const grader = new Grader(chart, { mode });
    const ids = [...new Set(chart.bars.map((b) => b.chord).filter(Boolean))];
    main.innerHTML = `
      <header class="bar play-bar">
        <button type="button" class="back" id="quit" aria-label="Stop">${ICON_BACK}</button>
        <span>${esc(cfg.title)}</span>
      </header>
      <div class="hud">
        <div class="hud-score">${mode === "wait" ? `<b id="pct">0</b><small>/${grader.total}</small>` : `<b id="pct">0</b><small>%</small>`}</div>
        <div class="hud-streak"><b id="streak">0</b><small>streak</small></div>
        <div class="hud-mic" aria-hidden="true"><i id="lvl"></i><small>mic</small></div>
      </div>
      <div class="hud-prog" aria-hidden="true"><i id="prog"></i></div>
      <div class="highway"><canvas id="hw" height="${H}" aria-label="Tab of what to play"></canvas></div>
      <p class="hud-msg" id="msg" aria-live="polite">${mode === "wait" ? "Play each note when the chart stops on it" : "Get ready"}</p>
      ${ids.length ? `<div class="hud-chords" id="chords">${ids.map((c) => `<figure data-chord="${c}">${chordSvg(CHORDS[c])}<figcaption>${esc(CHORDS[c].sym)}</figcaption></figure>`).join("")}</div>` : ""}
      <button type="button" class="go stop" id="stop">Stop</button>`;

    keepAwake(true);
    const ac = mic.ac;
    const hw = makeHighway(main.querySelector("#hw"), chart, { mode });
    const $ = (s) => main.querySelector(s);
    const figs = [...main.querySelectorAll("#chords figure")];
    const status = new Map(); // ev.i → result
    let streak = 0;
    let points = 0;
    let judged = 0;
    const inputLag = (mic.latency ?? 0.02) + READ_LAG + (prefs().playOffset || 0);
    const outLag = ac.outputLatency || ac.baseLatency || 0;

    // audio: ticks (and the guide) from chart time 0
    const t0 = ac.currentTime + 0.25;
    playScore(guideScore(chart, { guide, mode }), { at: t0, volume: guide ? 0.6 : 1 });

    let clock = 0; // chart time on screen
    let lastAc = t0;
    let raf = 0;
    let timer = 0;
    let over = false;
    const chordAt = (t) => [...chart.bars].reverse().find((b) => b.t <= t + 0.05)?.chord;

    const onResult = (r) => {
      status.set(r.ev.i, r);
      judged++;
      if (r.ok) {
        streak++;
        points += r.grade === "perfect" ? 1 : 0.75;
      } else streak = 0;
      const label = r.ok ? (r.grade === "perfect" ? "Perfect" : `Good · ${r.dt > 0 ? "late" : "early"}`) : missLabel(r);
      hw.pop(label, r.ok ? (r.grade === "perfect" ? "good" : "cobalt") : "bad", r.ev);
      $("#pct").textContent = mode === "wait" ? grader.results.filter((x) => x.ok).length : Math.round((points / grader.total) * 100);
      $("#streak").textContent = streak;
      $("#prog").style.width = `${(judged / grader.total) * 100}%`;
      if (mode === "wait" && r.ok) $("#msg").textContent = r.tries > 1 ? `Got it, after ${r.tries} tries` : "Got it";
    };

    const listenTick = () => {
      if (over) return;
      const buf = mic.buf || (mic.buf = new Float32Array(mic.analyser.fftSize));
      mic.analyser.getFloatTimeDomainData(buf);
      const frame = prepare(buf, ac.sampleRate);
      const probe = prober(frame, ac.sampleRate, { gate: 0.003 });
      const t = mode === "wait" ? clock : ac.currentTime - t0 - outLag - inputLag;
      const { hf, prev } = attack(buf);
      for (const r of grader.update({ t, wall: ac.currentTime, level: frame.level, probe, hf, hfPrev: prev })) onResult(r);
      $("#lvl").style.transform = `scaleY(${Math.min(1, frame.level * 40)})`;
      timer = setTimeout(listenTick, 35);
    };

    const frameTick = () => {
      if (over) return;
      const now = ac.currentTime;
      if (mode === "time") clock = now - t0 - outLag;
      else {
        const dt = Math.max(0, now - lastAc);
        const cur = grader.current;
        clock = now < t0 ? now - t0 : cur ? Math.min(clock + dt, cur.t) : clock + dt;
      }
      lastAc = now;
      hw.draw(clock, status, grader.current);
      const id = chordAt(clock);
      figs.forEach((f) => f.classList.toggle("now", f.dataset.chord === id));
      if (clock < chart.countIn) {
        const left = Math.ceil((chart.countIn - clock) / chart.beat);
        $("#msg").textContent = clock < 0 ? "Get ready" : `${left}`;
      } else if (/^\d|Get ready/.test($("#msg").textContent)) {
        $("#msg").textContent = mode === "wait" ? "Play it when the chart stops on it" : "";
      }
      const end = mode === "time" ? clock > chart.length : grader.done && clock > chart.events.at(-1).t + 0.8;
      if (end) return finish();
      raf = requestAnimationFrame(frameTick);
    };

    const halt = () => {
      over = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      stopDemo();
      mic.close();
      keepAwake(false);
      window.removeEventListener("resize", onResize);
    };
    const finish = () => {
      halt();
      // anything still open at the end is a miss
      const missed = grader.todo.filter((e) => !status.has(e.i));
      for (const ev of missed) grader.results.push({ ev, ok: false, grade: "miss", why: "silent", dt: null });
      results(chart, grader, { mode, speed });
    };
    const onResize = () => hw.draw(clock, status, grader.current);
    window.addEventListener("resize", onResize);
    stop = halt;
    $("#stop").addEventListener("click", () => {
      halt();
      setup();
    });
    $("#quit").addEventListener("click", () => {
      halt();
      location.hash = cfg.back;
    });
    raf = requestAnimationFrame(frameTick);
    listenTick();
  };

  const results = (chart, grader, { mode, speed }) => {
    stop = null;
    const score = scoreRun(grader.results, grader.total, { speed });
    const prev = playRecord(state(), cfg.id);
    let rec = { ...prev, runs: prev.runs + 1, lastAt: Date.now() };
    const newBest = mode === "time" && (score.stars > prev.stars || (score.stars === prev.stars && score.pct > prev.pct));
    if (newBest) rec = { ...rec, stars: score.stars, pct: score.pct, speed };
    const s = state();
    const log = [...(s.log || []), { at: Date.now(), skill: cfg.id, play: mode === "time" ? score.pct : null }].slice(-500);
    cfg.setState({ ...s, play: { ...(s.play || {}), [cfg.id]: rec }, log });

    // how far off the timing is, from hits and from near misses
    const offs = mode === "time"
      ? grader.results.map((r) => (r.ok ? r.dt : r.off)).filter((x) => x !== null && x !== undefined).sort((a, b) => a - b)
      : [];
    const shift = offs.length ? offs[Math.floor(offs.length / 2)] : 0;
    const offsetTip = offs.length >= 6 && Math.abs(shift) > 0.05;
    const tries = grader.results.reduce((n, r) => n + Math.max(0, (r.tries || 1) - 1), 0);
    const faster = SPEEDS.find((x) => x > speed);
    main.innerHTML = `
      <header class="bar">
        <a class="back" href="${cfg.back}" aria-label="Back">${ICON_BACK}</a>
        <span>${esc(cfg.title)}</span>
      </header>
      <section class="result">
        ${mode === "time" ? `${starsHtml(score.stars, 56)}
          <p class="result-pct"><b>${score.pct}</b>%</p>
          <p class="result-sub">${newBest && prev.runs ? "New best · " : ""}${Math.round(speed * 100)}% speed, ${chart.bpm} BPM</p>
          <ul class="result-counts">
            <li><b>${score.perfect}</b>Perfect</li><li><b>${score.good}</b>Good</li><li><b>${score.missed}</b>Missed</li><li><b>${score.bestStreak}</b>Best streak</li>
          </ul>`
        : `<p class="result-pct"><b>${grader.results.filter((r) => r.ok).length}</b>/${grader.total}</p>
          <p class="result-sub">notes and chord changes, ${tries ? `${tries} retr${tries === 1 ? "y" : "ies"}` : "no retries"}</p>`}
        <p class="result-tip">${esc(advice(score, { mode }))}</p>
        ${offsetTip ? `<div class="result-cal">
          <p>You played ${shift > 0 ? "late" : "early"} by about ${Math.round(Math.abs(shift) * 1000)} ms on average. If that felt on time to you, it's your phone's mic delay.</p>
          <button type="button" id="cal">Adjust timing by ${Math.round(Math.abs(shift) * 1000)} ms</button>
        </div>` : ""}
        ${mode === "time" ? missList(grader) : ""}
      </section>
      <div class="rate two">
        <button type="button" class="primary" id="again">Play again</button>
        ${mode === "time" && faster && score.stars >= 2 ? `<button type="button" id="faster">Try ${Math.round(faster * 100)}%</button>`
          : mode === "time" && speed > SPEEDS[0] && score.stars === 0 ? `<button type="button" id="slower">Try ${Math.round(SPEEDS[SPEEDS.indexOf(speed) - 1] * 100)}%</button>`
          : `<button type="button" id="setup">Settings</button>`}
      </div>`;
    const go = (sp) => {
      if (sp !== undefined) setPrefs({ playSpeed: { ...(prefs().playSpeed || {}), [cfg.id]: sp } });
      setup();
      main.querySelector("#start").click();
    };
    main.querySelector("#again").addEventListener("click", () => go());
    main.querySelector("#faster")?.addEventListener("click", () => go(faster));
    main.querySelector("#slower")?.addEventListener("click", () => go(SPEEDS[SPEEDS.indexOf(speed) - 1]));
    main.querySelector("#setup")?.addEventListener("click", () => setup());
    main.querySelector("#cal")?.addEventListener("click", (e) => {
      const next = Math.max(-0.15, Math.min(0.4, (prefs().playOffset || 0) + shift));
      setPrefs({ playOffset: next });
      e.currentTarget.textContent = "Timing adjusted";
      e.currentTarget.disabled = true;
    });
  };

  setup();
  return () => stop?.();
}

function missLabel(r) {
  if (r.why === "silent") return "Miss";
  if (r.why === "late" || r.why === "early") return `Miss · too ${r.why}`;
  if (r.why === "chord") return "Miss · chord";
  if (r.heard) return `Miss · ${Math.abs(r.heard) === 1 ? "1 fret" : "2 frets"} ${r.heard > 0 ? "high" : "low"}`;
  return "Miss · wrong note";
}

// The spots to work on: chords or notes missed most.
function missList(grader) {
  const by = new Map();
  for (const r of grader.results) {
    if (r.ok) continue;
    const ev = r.ev;
    const key = ev.kind === "strum" ? (CHORDS[ev.chord]?.sym || ev.chord) : ev.kind === "note" ? `${["Low E", "A", "D", "G", "B", "High E"][ev.s]} string, fret ${ev.f}` : "Muted strum";
    by.set(key, (by.get(key) || 0) + 1);
  }
  const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) return "";
  return `<div class="result-miss"><h2>Missed most</h2><ul>${top.map(([k, n]) => `<li><span>${esc(k)}</span><b>${n}×</b></li>`).join("")}</ul></div>`;
}

// ---------- the scrolling tab ----------

function makeHighway(canvas, chart, { mode }) {
  const ctx = canvas.getContext("2d");
  const pops = [];
  let size = 0;
  const css = getComputedStyle(document.documentElement);
  const C = {
    ink: css.getPropertyValue("--ink").trim() || "#12182B",
    muted: css.getPropertyValue("--muted").trim() || "#5A6378",
    line: css.getPropertyValue("--line").trim() || "#D5DAE5",
    surface: css.getPropertyValue("--surface").trim() || "#fff",
    cobalt: css.getPropertyValue("--cobalt").trim() || "#2443C9",
    cobaltInk: css.getPropertyValue("--cobalt-ink").trim() || "#fff",
    amber: css.getPropertyValue("--amber").trim() || "#FFB81C",
    good: css.getPropertyValue("--good").trim() || "#1F8A5B",
    bad: css.getPropertyValue("--bad").trim() || "#D64545",
    display: css.getPropertyValue("--f-display").trim() || "sans-serif",
  };
  const fit = () => {
    const w = canvas.parentElement.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    if (size !== w * dpr) {
      size = w * dpr;
      canvas.width = w * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${H}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return w;
  };
  const colorOf = (ev, r, cur) => {
    if (r) return r.ok ? C.good : C.bad;
    if (!graded(ev, mode)) return null;
    if (mode === "wait" && cur && cur.i === ev.i) return C.amber; // where the chart is waiting
    return C.cobalt;
  };
  const playedSpan = (ev) => {
    const ss = ev.tones.map((x) => x.s);
    return [laneY(Math.max(...ss)) - 12, laneY(Math.min(...ss)) + 12];
  };

  const draw = (now, status, cur) => {
    const w = fit();
    const x = (t) => LINE_X + (t - now) * PPS;
    ctx.clearRect(0, 0, w, H);
    // already-played side
    ctx.fillStyle = C.line;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, LINE_X, H);
    ctx.globalAlpha = 1;
    // strings
    for (let s = 0; s < 6; s++) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1 + (5 - s) * 0.35; // low strings thicker
      ctx.beginPath();
      ctx.moveTo(0, laneY(s));
      ctx.lineTo(w, laneY(s));
      ctx.stroke();
    }
    // bar lines, beats and chord names
    const tFrom = now - LINE_X / PPS - 0.5;
    const tTo = now + (w - LINE_X) / PPS + 0.5;
    let prevChord;
    // the chord being played stays named beside the line until the next takes over
    const nowBar = [...chart.bars].reverse().find((b) => b.t <= now);
    const nextChange = chart.bars.find((b) => b.t > now && b.chord !== nowBar?.chord);
    if (nowBar?.chord) {
      const room = nextChange ? x(nextChange.t) - (LINE_X + 6) : Infinity;
      ctx.fillStyle = C.ink;
      ctx.globalAlpha = room < 40 ? Math.max(0, room / 40) : 1;
      ctx.font = `800 24px ${C.display}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(CHORDS[nowBar.chord]?.sym || nowBar.chord, LINE_X + 6, 30);
      ctx.globalAlpha = 1;
    }
    chart.bars.forEach((b) => {
      const show = b.chord && b.chord !== prevChord && b.t > now;
      prevChord = b.chord;
      if (b.t > tTo || b.t + chart.bar < tFrom) return;
      const bx = x(b.t);
      ctx.strokeStyle = C.muted;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, LANE_TOP - 14);
      ctx.lineTo(bx, laneY(0) + 14);
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      for (let j = 1; j < chart.beatsPerBar; j++) {
        const jx = x(b.t + j * chart.beat);
        ctx.beginPath();
        ctx.moveTo(jx, LANE_TOP - 14);
        ctx.lineTo(jx, LANE_TOP - 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (show) {
        ctx.fillStyle = C.ink;
        ctx.font = `800 24px ${C.display}`;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillText(CHORDS[b.chord]?.sym || b.chord, bx + 4, 30);
      }
    });

    // the play line, under the notes so the one on it stays readable
    ctx.fillStyle = C.amber;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(LINE_X - 14, LANE_TOP - 22, 28, laneY(0) - LANE_TOP + 44);
    ctx.globalAlpha = 1;
    ctx.fillRect(LINE_X - 2, LANE_TOP - 22, 4, laneY(0) - LANE_TOP + 44);

    // events, back to front
    for (let k = chart.events.length - 1; k >= 0; k--) {
      const ev = chart.events[k];
      if (ev.t < tFrom || ev.t > tTo) continue;
      const ex = x(ev.t);
      const r = status?.get(ev.i);
      const col = colorOf(ev, r, cur);
      const faded = r && ev.t < now - 0.15;
      ctx.globalAlpha = faded ? 0.55 : 1;
      if (ev.kind === "note") {
        const y = laneY(ev.s);
        ctx.fillStyle = col || C.surface;
        ctx.strokeStyle = col || C.muted;
        ctx.lineWidth = 2;
        roundRect(ctx, ex - 15, y - 13, 30, 26, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = col ? (col === C.amber ? "#2A1C00" : "#fff") : C.ink;
        ctx.font = `800 18px ${C.display}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ev.bend ? `${ev.f}↗` : String(ev.f), ex, y + 1);
        if (ev.legato) {
          ctx.fillStyle = C.muted;
          ctx.font = `700 11px sans-serif`;
          ctx.fillText("legato", ex, y - 20);
        }
      } else if (ev.kind === "strum") {
        const [top, bot] = playedSpan(ev);
        const ups = ev.dir === "U";
        ctx.fillStyle = col || C.surface;
        ctx.strokeStyle = col || C.muted;
        ctx.lineWidth = 2;
        roundRect(ctx, ex - 6, top, 12, bot - top, 6);
        if (col) ctx.fill();
        ctx.stroke();
        // arrow head
        ctx.fillStyle = col || C.muted;
        ctx.beginPath();
        if (ups) {
          ctx.moveTo(ex - 10, top + 8);
          ctx.lineTo(ex, top - 6);
          ctx.lineTo(ex + 10, top + 8);
        } else {
          ctx.moveTo(ex - 10, bot - 8);
          ctx.lineTo(ex, bot + 6);
          ctx.lineTo(ex + 10, bot - 8);
        }
        ctx.closePath();
        ctx.fill();
      } else if (ev.kind === "chuck") {
        ctx.strokeStyle = col || C.muted;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        const y = (laneY(5) + laneY(0)) / 2;
        ctx.beginPath();
        ctx.moveTo(ex - 9, y - 9);
        ctx.lineTo(ex + 9, y + 9);
        ctx.moveTo(ex + 9, y - 9);
        ctx.lineTo(ex - 9, y + 9);
        ctx.stroke();
        ctx.lineCap = "butt";
      }
      ctx.globalAlpha = 1;
    }

    // feedback
    const t = performance.now() / 1000;
    for (let k = pops.length - 1; k >= 0; k--) {
      const p = pops[k];
      const age = t - p.born;
      if (age > POP_LIFE) {
        pops.splice(k, 1);
        continue;
      }
      const a = 1 - age / POP_LIFE;
      ctx.globalAlpha = a;
      // ring at the line
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(LINE_X, p.y, 14 + age * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.font = `800 20px ${C.display}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(p.text, LINE_X + 22, H - 18 - age * 16);
      ctx.globalAlpha = 1;
    }
  };

  const pop = (text, kind, ev) => {
    const color = kind === "good" ? C.good : kind === "bad" ? C.bad : C.cobalt;
    const y = ev.kind === "note" ? laneY(ev.s) : (laneY(5) + laneY(0)) / 2;
    pops.splice(0, pops.length - 2); // keep it readable when notes come fast
    pops.push({ text, color, y, born: performance.now() / 1000 });
  };

  return { draw, pop };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
