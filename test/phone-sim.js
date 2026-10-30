// A rough model of an acoustic guitar heard through a phone mic, for tests:
// plucked strings with a little detune and brightness variation, the phone
// mic's weak low end (a steep high-pass around 150 Hz), and background hiss.

import { pluck, fretFreq } from "../public/lib/pitch.js";

export const SR = 48000;

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

// two cascaded 2nd-order high-pass filters (≈24 dB/octave below fc)
function highpass(x, fc = 150) {
  const w = (2 * Math.PI * fc) / SR, cosw = Math.cos(w), alpha = Math.sin(w) / (2 * 0.707);
  const b0 = (1 + cosw) / 2, b1 = -(1 + cosw), b2 = (1 + cosw) / 2, a0 = 1 + alpha, a1 = -2 * cosw, a2 = 1 - alpha;
  let y = x;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v;
    }
    y = out;
  }
  return y;
}

// plucks: [{ at, s, f, gain, cents, until }] — string/fret, optional detune and mute time
export function phoneTake(plucks, seconds, { seed = 1, hiss = 0.004, level = 0.25, fast = false } = {}) {
  const r = rng(seed);
  const out = new Float32Array(Math.floor(seconds * SR));
  plucks.forEach((p, k) => {
    const freq = (p.freq ?? fretFreq(p.s, p.f)) * 2 ** ((p.cents ?? (r() - 0.5) * 12) / 1200);
    // fast: notes die in a fraction of a second, as with the phone's call-style noise suppression
    const decay = fast ? 0.97 + r() * 0.01 : 0.994 + r() * 0.004;
    const sig = pluck(freq, SR, seconds - p.at, { seed: 7 + k * 13, decay });
    const st = Math.floor(p.at * SR);
    const stop = p.until ? Math.floor((p.until - p.at) * SR) : Infinity;
    const g = (p.gain ?? 0.7 + r() * 0.6) * level;
    for (let i = 0; i < sig.length && st + i < out.length; i++) {
      const m = i < stop ? 1 : Math.max(0, 1 - (i - stop) / (0.05 * SR));
      out[st + i] += g * m * sig[i];
    }
  });
  const y = highpass(out);
  for (let i = 0; i < y.length; i++) y[i] += hiss * (r() * 2 - 1) * 1.7;
  return y;
}
