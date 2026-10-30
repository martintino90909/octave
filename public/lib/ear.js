// Ear training: questions are pure data (so they're testable); render() turns
// one into plucked-string audio with the same synth the mic tests use.

import { freqFromMidi, pluck } from "./pitch.js";

export const EAR = {
  // intervals, played low then high
  m3: { label: "Minor 3rd", kind: "interval", steps: [0, 3] },
  M3: { label: "Major 3rd", kind: "interval", steps: [0, 4] },
  P4: { label: "4th", kind: "interval", steps: [0, 5] },
  P5: { label: "5th", kind: "interval", steps: [0, 7] },
  P8: { label: "Octave", kind: "interval", steps: [0, 12] },
  // chords, strummed low to high
  maj: { label: "Major", kind: "chord", steps: [0, 4, 7, 12] },
  min: { label: "Minor", kind: "chord", steps: [0, 3, 7, 12] },
  maj7: { label: "Major 7th", kind: "chord", steps: [0, 4, 7, 11] },
  dom7: { label: "Dominant 7th", kind: "chord", steps: [0, 4, 7, 10] },
  m7: { label: "Minor 7th", kind: "chord", steps: [0, 3, 7, 10] },
};

// A random question from the given answer options. rand() returns 0..1.
export function makeQuestion(options, rand = Math.random) {
  const answer = options[Math.floor(rand() * options.length)];
  const spec = EAR[answer];
  const root = 45 + Math.floor(rand() * 10); // A2 to F#3: guitar range
  return {
    answer,
    kind: spec.kind,
    midis: spec.steps.map((s) => root + s),
  };
}

// Mono samples for a question: intervals as two separate notes, chords as a strum.
export function render(question, sampleRate) {
  const gap = question.kind === "interval" ? 0.7 : 0.045;
  const length = (question.midis.length - 1) * gap + 2.2;
  const out = new Float32Array(Math.floor(length * sampleRate));
  question.midis.forEach((m, k) => {
    const start = Math.floor(k * gap * sampleRate);
    const note = pluck(freqFromMidi(m), sampleRate, length - k * gap, { seed: 3 + k, decay: 0.997 });
    for (let i = 0; i < note.length && start + i < out.length; i++) out[start + i] += note[i];
  });
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.8 / peak;
  return out;
}
