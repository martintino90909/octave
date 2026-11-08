// Plays a demo score through Web Audio and fires its cues in time, so the
// screen can light up the beat, strum or chord as you hear it.
// Only one demo plays at a time: starting one stops the last.
//
// Demos are mixed from recorded guitar notes (public/samples/guitar), loaded
// once on first use, with a little room reverb on top.

import { renderScore } from "./demo.js";
import { audio } from "./metronome.js";

const RATE = 44100; // the samples' rate; the buffer plays at any device rate
const FIRST = 40;
const LAST = 84;

let bankPromise = null;
let bank = null;

// Starts loading the recorded notes. Safe to call often; returns the same promise.
export function loadBank() {
  if (bankPromise) return bankPromise;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const dec = new Offline(1, 1, RATE);
  const note = async (midi) => {
    const res = await fetch(`/samples/guitar/${midi}.mp3`);
    if (!res.ok) throw new Error(`sample ${midi}: ${res.status}`);
    const bytes = await res.arrayBuffer();
    // callback form too, for older Safari
    const buf = await new Promise((ok, fail) => dec.decodeAudioData(bytes, ok, fail)?.catch?.(fail));
    // mix to mono at the bank's rate
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < out.length; i++) out[i] += ch[i] / buf.numberOfChannels;
    }
    return [midi, out];
  };
  bankPromise = Promise.all(Array.from({ length: LAST - FIRST + 1 }, (_, k) => note(FIRST + k)))
    .then((pairs) => (bank = new Map(pairs)))
    .catch(() => {
      // offline with nothing cached, or a decode failure: the synth stands in
      bankPromise = null;
      return null;
    });
  return bankPromise;
}

export const bankReady = () => !!bank;

let reverb = null; // { ac, node }
// A small-room reverb from a decaying noise impulse.
function room(ac) {
  if (reverb?.ac === ac) return reverb.node;
  const len = Math.floor(ac.sampleRate * 1.3);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  const node = ac.createConvolver();
  node.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.22;
  node.connect(wet).connect(ac.destination);
  reverb = { ac, node };
  return node;
}

let current = null;

export function stopDemo() {
  current?.stop();
  current = null;
}

// score: from demo.js. onCue(cue) fires as each cue's time arrives; onEnd()
// when the score finishes or is stopped. `at` (AudioContext time) starts it
// in sync with something else, such as a metronome run; `volume` scales it.
// Returns a handle with stop(). If the recorded notes are still loading it
// waits for them (onLoading() fires first), unless `at` is set: a synced
// guide can't wait, so it uses the synth until the notes arrive.
export function playScore(score, { onCue, onEnd, onLoading, at, volume = 1 } = {}) {
  stopDemo();
  const ac = audio(); // created inside the tap, so iOS allows sound
  let stopped = false;
  let src = null;
  let raf = 0;
  const handle = {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      try {
        src?.stop();
      } catch {}
      if (current === handle) current = null;
      onEnd?.();
    },
  };
  current = handle;

  const start = (notes) => {
    if (stopped) return;
    const samples = renderScore(score, RATE, { bank: notes });
    const buf = ac.createBuffer(1, samples.length, RATE);
    buf.copyToChannel(samples, 0);
    src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(ac.destination);
    gain.connect(room(ac));
    const t0 = Math.max(at ?? 0, ac.currentTime + 0.05);
    src.start(t0);

    const cues = [...score.cues].sort((a, b) => a.t - b.t);
    let next = 0;
    const frame = () => {
      if (stopped) return;
      const now = ac.currentTime - t0;
      while (next < cues.length && cues[next].t <= now) onCue?.(cues[next++]);
      if (now >= score.length) return handle.stop();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  if (bank || at !== undefined) {
    start(bank);
  } else {
    onLoading?.();
    loadBank().then((notes) => start(notes));
  }
  return handle;
}
