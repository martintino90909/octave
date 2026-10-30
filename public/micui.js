// The mic screens: the tuner (also used, timed, by the Setup skill), the
// string-by-string chord check, and the note-by-note sequence check.

import { openMic, listen, micMessage } from "./lib/listen.js";
import { STRINGS } from "./lib/pitch.js";
import { TuneTracker, StringCheck, chordTargets, noteTargets } from "./lib/tunecheck.js";
import { keepAwake } from "./lib/metronome.js";

const STRING_NAMES = ["Low E", "A", "D", "G", "B", "High E"];
export const stringName = (index) => `${STRING_NAMES[index]} string`;

const SHORT = ["E", "A", "D", "G", "B", "e"];
const fretWords = (f) => (f === 0 ? "open" : `${f}${f === 1 ? "st" : f === 2 ? "nd" : f === 3 ? "rd" : "th"} fret`);

// Plain words for one note of a sequence: "G string, 7th fret, bend up to E4".
export function describeNote(t, hide = false) {
  const where = hide ? `${t.note} on the ${stringName(t.index)}` : `${stringName(t.index)}, ${fretWords(t.fret)}`;
  if (t.label) return `${where}, ${t.label} to ${t.note}`;
  if (t.legato) return `${where}, without picking`;
  return where;
}

// A live input bar, and a warning when no sound at all reaches the app.
function levelMeter(el) {
  const bar = el.querySelector(".level i");
  const warn = el.querySelector(".no-sound");
  let started = null, loudest = 0;
  return {
    update({ level, now }) {
      started ??= now;
      loudest = Math.max(loudest, level);
      bar.style.width = `${Math.min(100, Math.sqrt(level / 0.15) * 100)}%`;
      warn.hidden = !(now - started > 4000 && loudest < 0.001);
    },
    reset() {
      started = null;
      loudest = 0;
      bar.style.width = "0%";
      warn.hidden = true;
    },
  };
}

const METER = `
  <div class="level" aria-hidden="true"><i></i></div>
  <p class="mic-error no-sound" role="alert" hidden>No sound is reaching Octave from the mic. Fully close Octave (swipe it away) and reopen it, and check nothing else, like a call, is using the mic.</p>`;

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------- tuner ----------

export function mountTuner(el, { timed = false, limit = 120, onDone } = {}) {
  el.innerHTML = `
    <div class="tuner">
      ${timed ? `<p class="tclock"><span id="t-clock">0:00</span> <small>of ${clock(limit)}</small></p>` : ""}
      <div class="tnote"><span id="t-name">–</span><small id="t-oct"></small></div>
      <div class="meter" aria-hidden="true">
        <span>♭</span>
        <div class="track"><i class="zone"></i><i class="mid"></i><i class="needle" id="t-needle"></i></div>
        <span>♯</span>
      </div>
      <p class="thint" id="t-hint">${timed ? "Start, then pluck one open string at a time, palm resting on the others. The clock starts at your first note." : "Start the tuner, then pluck one open string. Rest your palm on the others so only that one rings."}</p>
      <ol class="tstrings" aria-label="Strings tuned">
        ${STRINGS.map((s) => `<li data-n="${s.n}"><b>${s.name}</b><small>${s.n === 6 ? "low" : s.n === 1 ? "high" : ""}</small></li>`).join("")}
      </ol>
      ${METER}
      <p class="mic-error" id="t-error" role="alert" hidden></p>
      <button type="button" class="go" id="t-go">${timed ? "Start timed tuning" : "Start tuner"}</button>
    </div>`;

  const $ = (s) => el.querySelector(s);
  const meter = levelMeter(el);
  let mic = null, stopListening = null, tracker = null, timer = null;

  const stop = () => {
    stopListening?.();
    mic?.close();
    clearInterval(timer);
    mic = stopListening = null;
    keepAwake(false);
    $("#t-go").textContent = timed ? "Start timed tuning" : "Start tuner";
    $("#t-go").classList.remove("stop");
  };

  const show = (r) => {
    const needle = $("#t-needle");
    el.querySelectorAll(".tstrings li").forEach((li) => {
      const n = Number(li.dataset.n);
      li.classList.toggle("done", tracker.tuned.has(n));
      li.classList.toggle("now", r.target?.n === n);
    });
    if (!r.target) {
      needle.style.opacity = "0.25";
      return;
    }
    const c = Math.max(-50, Math.min(50, r.cents));
    needle.style.opacity = "1";
    needle.style.left = `${50 + c}%`;
    needle.classList.toggle("ok", r.inTune);
    $("#t-name").textContent = r.target.name;
    $("#t-oct").textContent = r.target.n === 6 ? "low" : r.target.n === 1 ? "high" : "";
    const name = stringName(6 - r.target.n);
    if (r.justTuned) $("#t-hint").textContent = `${name} tuned`;
    else if (r.inTune) $("#t-hint").textContent = "In tune. Let it ring…";
    else if (r.cents < 0) $("#t-hint").textContent = r.cents < -15 ? `Tighten the ${name}` : "Tighten slightly";
    else $("#t-hint").textContent = r.cents > 15 ? `Loosen the ${name}` : "Loosen slightly";
  };

  $("#t-go").addEventListener("click", async () => {
    if (mic) return stop();
    $("#t-error").hidden = true;
    try {
      mic = await openMic();
    } catch (e) {
      $("#t-error").textContent = micMessage(e);
      $("#t-error").hidden = false;
      return;
    }
    tracker = new TuneTracker();
    meter.reset();
    keepAwake(true);
    $("#t-go").textContent = "Stop";
    $("#t-go").classList.add("stop");
    $("#t-hint").textContent = "Pluck an open string";
    if (timed) {
      timer = setInterval(() => {
        if (tracker.startedAt) $("#t-clock").textContent = clock(tracker.seconds);
      }, 250);
    }
    stopListening = listen(mic, (reading) => {
      meter.update(reading);
      const r = tracker.update(reading);
      show(r);
      if (tracker.done) {
        const secs = tracker.seconds;
        stop();
        $("#t-hint").textContent = `All six strings in tune in ${clock(secs)}`;
        if (timed) $("#t-clock").textContent = clock(secs);
        onDone?.(secs);
      }
    });
  });

  return stop;
}

// ---------- chord check ----------

export function mountStringCheck(el, chord, { onResult, previous } = {}) {
  const targets = chordTargets(chord);
  const muted = chord.frets.map((f, i) => (f < 0 ? i : -1)).filter((i) => i >= 0);
  const rows = STRINGS.map((s, i) => {
    const t = targets.find((x) => x.index === i);
    return t
      ? `<li data-i="${i}"><span class="sn">${s.n}</span><span class="sl">${stringName(i)}</span><span class="snote">${t.note}</span><span class="sstat"></span></li>`
      : `<li class="skip"><span class="sn">${s.n}</span><span class="sl">${stringName(i)}</span><span class="snote">don't play</span><span class="sstat"></span></li>`;
  });

  el.innerHTML = `
    <div class="scheck">
      <p class="shint" id="s-hint">Hold ${chord.name}. Pluck each string on its own, low to high${muted.length ? ", skipping the ones marked" : ""}.</p>
      <ol class="srows">${rows.join("")}</ol>
      ${METER}
      <p class="mic-error" id="s-error" role="alert" hidden></p>
      <button type="button" class="go" id="s-go">Check with the mic</button>
    </div>`;

  const $ = (s) => el.querySelector(s);
  const meter = levelMeter(el);
  let mic = null, stopListening = null, check = null;

  const stop = () => {
    stopListening?.();
    mic?.close();
    mic = stopListening = null;
    keepAwake(false);
    $("#s-go").textContent = "Check again";
    $("#s-go").classList.remove("stop");
  };

  const mark = () => {
    el.querySelectorAll(".srows li[data-i]").forEach((li) => {
      const i = Number(li.dataset.i);
      const r = check.results.find((x) => x.index === i);
      const now = check.current?.index === i;
      li.className = r ? (r.ok ? "ok" : "bad") : now ? "now" : "";
      li.querySelector(".sstat").textContent = r
        ? r.ok ? "rang true" : r.heard ? `sounded ${r.heard}` : "didn't ring"
        : now ? "pluck it" : "";
    });
    if (check.current) $("#s-hint").textContent = `Pluck the ${stringName(check.current.index)}.`;
  };

  // show the last try's marks until a new check starts
  if (previous) {
    check = { results: previous, current: null };
    mark();
    $("#s-go").textContent = "Check again";
  }

  $("#s-go").addEventListener("click", async () => {
    if (mic) return stop();
    $("#s-error").hidden = true;
    try {
      mic = await openMic();
    } catch (e) {
      $("#s-error").textContent = micMessage(e);
      $("#s-error").hidden = false;
      return;
    }
    check = new StringCheck(targets);
    meter.reset();
    keepAwake(true);
    $("#s-go").textContent = "Cancel";
    $("#s-go").classList.add("stop");
    mark();
    stopListening = listen(mic, (reading) => {
      meter.update(reading);
      if (check.update(reading)) mark();
      if (check.finished) {
        stop();
        onResult?.(check.clean, check.results);
      }
    });
  });

  return stop;
}

// ---------- note sequence check ----------

export function mountNoteCheck(el, skill, { onResult, previous } = {}) {
  const targets = noteTargets(skill.notes);
  const hide = Boolean(skill.hideFrets);
  const chips = targets.map((t, k) => `
    <li data-k="${k}" class="${t.legato ? "legato" : ""}">
      <span class="ns">${SHORT[t.index]}</span>
      <b class="nf">${hide ? "?" : t.fret}${t.sound !== t.fret ? "↑" : ""}</b>
      <span class="nn">${t.note}</span>
    </li>`);

  el.innerHTML = `
    <div class="ncheck">
      <p class="shint" id="n-hint">${hide ? "Find each note on its string, in order." : "Play each note in order. The next one lights up when the mic hears the last."}</p>
      <ol class="nrow" aria-label="Notes to play">${chips.join("")}</ol>
      <p class="nkey">Top: string · middle: fret${targets.some((t) => t.legato) ? " · ⌒ means don't pick again" : ""}</p>
      ${METER}
      <p class="mic-error" id="n-error" role="alert" hidden></p>
      <button type="button" class="go" id="n-go">Check with the mic</button>
    </div>`;

  const $ = (s) => el.querySelector(s);
  const meter = levelMeter(el);
  let mic = null, stopListening = null, check = null;

  const stop = () => {
    stopListening?.();
    mic?.close();
    mic = stopListening = null;
    keepAwake(false);
    $("#n-go").textContent = "Check again";
    $("#n-go").classList.remove("stop");
  };

  const mark = () => {
    el.querySelectorAll(".nrow li").forEach((li) => {
      const k = Number(li.dataset.k);
      const r = check.results[k];
      const now = check.pos === k && !check.finished;
      li.classList.toggle("ok", Boolean(r?.ok));
      li.classList.toggle("bad", Boolean(r && !r.ok));
      li.classList.toggle("now", now);
      li.querySelector(".nn").textContent = r && !r.ok ? (r.heard ? r.heard : "–") : targets[k].note;
    });
    const t = check.current;
    if (t) $("#n-hint").textContent = `${t.legato ? "Now" : "Play"}: ${describeNote(t, hide)}`;
  };

  if (previous) {
    check = { results: previous, pos: previous.length, finished: true, current: null };
    mark();
    $("#n-go").textContent = "Check again";
  }

  $("#n-go").addEventListener("click", async () => {
    if (mic) return stop();
    $("#n-error").hidden = true;
    try {
      mic = await openMic();
    } catch (e) {
      $("#n-error").textContent = micMessage(e);
      $("#n-error").hidden = false;
      return;
    }
    check = new StringCheck(targets);
    meter.reset();
    keepAwake(true);
    $("#n-go").textContent = "Cancel";
    $("#n-go").classList.add("stop");
    mark();
    stopListening = listen(mic, (reading) => {
      meter.update(reading);
      if (check.update(reading)) mark();
      if (check.finished) {
        stop();
        onResult?.(check.clean, check.results);
      }
    });
  });

  return stop;
}
