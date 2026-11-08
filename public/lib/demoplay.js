// Plays a demo score through Web Audio and fires its cues in time, so the
// screen can light up the beat, strum or chord as you hear it.
// Only one demo plays at a time: starting one stops the last.

import { renderScore } from "./demo.js";
import { audio } from "./metronome.js";

let current = null;

export function stopDemo() {
  current?.stop();
  current = null;
}

// score: from demo.js. onCue(cue) fires as each cue's time arrives; onEnd()
// when the score finishes or is stopped. `at` (AudioContext time) starts it
// in sync with something else, such as a metronome run; `volume` scales it.
export function playScore(score, { onCue, onEnd, at, volume = 1 } = {}) {
  stopDemo();
  const ac = audio();
  const samples = renderScore(score, ac.sampleRate);
  const buf = ac.createBuffer(1, samples.length, ac.sampleRate);
  buf.copyToChannel(samples, 0);
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain).connect(ac.destination);
  const t0 = Math.max(at ?? 0, ac.currentTime + 0.05);
  src.start(t0);

  const cues = [...score.cues].sort((a, b) => a.t - b.t);
  let next = 0;
  let raf = 0;
  let stopped = false;
  const handle = {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      try {
        src.stop();
      } catch {}
      if (current === handle) current = null;
      onEnd?.();
    },
  };
  const frame = () => {
    if (stopped) return;
    const now = ac.currentTime - t0;
    while (next < cues.length && cues[next].t <= now) onCue?.(cues[next++]);
    if (now >= score.length) return handle.stop();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  current = handle;
  return handle;
}
