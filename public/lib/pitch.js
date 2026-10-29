// Pitch detection (YIN) and note helpers. Pure functions: no audio APIs here,
// so they run the same in the browser and in Node tests.

export const A4 = 440;
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// Standard tuning, low (6th string) to high (1st string).
export const STRINGS = [
  { n: 6, name: "E", label: "E2", freq: 82.41 },
  { n: 5, name: "A", label: "A2", freq: 110.0 },
  { n: 4, name: "D", label: "D3", freq: 146.83 },
  { n: 3, name: "G", label: "G3", freq: 196.0 },
  { n: 2, name: "B", label: "B3", freq: 246.94 },
  { n: 1, name: "E", label: "E4", freq: 329.63 },
];

export const cents = (freq, ref) => 1200 * Math.log2(freq / ref);

export function midiFromFreq(freq) {
  return 69 + 12 * Math.log2(freq / A4);
}

export function freqFromMidi(midi) {
  return A4 * 2 ** ((midi - 69) / 12);
}

export function noteFromFreq(freq) {
  const m = midiFromFreq(freq);
  const midi = Math.round(m);
  return {
    midi,
    name: NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    cents: Math.round((m - midi) * 100),
  };
}

export function noteName(midi) {
  return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// The open string nearest to a pitch, and how far off it is in cents.
export function nearestString(freq) {
  let best = null;
  for (const s of STRINGS) {
    const c = cents(freq, s.freq);
    if (!best || Math.abs(c) < Math.abs(best.cents)) best = { string: s, cents: c };
  }
  return best;
}

// The note a string sounds at a given fret.
export function fretFreq(stringIndex, fret) {
  return STRINGS[stringIndex].freq * 2 ** (fret / 12);
}

// Does a detected pitch match the expected note? Low strings get one
// allowance: detectors sometimes report them an octave high.
export function matches(freq, expected, tolerance = 45) {
  if (Math.abs(cents(freq, expected)) <= tolerance) return true;
  return expected < 115 && Math.abs(cents(freq, expected * 2)) <= tolerance;
}

export function rms(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

// Halve the sample rate (with a simple low-pass) to keep the maths cheap on a
// phone; guitar pitches stay well below the new Nyquist limit.
function halve(input, sampleRate) {
  const half = Math.floor(input.length / 2);
  const buf = new Float32Array(half);
  for (let i = 0; i < half; i++) buf[i] = 0.5 * (input[2 * i] + input[2 * i + 1]);
  return { buf, sr: sampleRate / 2 };
}

// YIN's cumulative mean normalised difference: near 0 at lags where the
// signal repeats itself, near 1 where it doesn't.
function normalisedDifference(buf, tauMax) {
  const W = Math.floor(buf.length / 2);
  const dn = new Float32Array(tauMax + 1);
  dn[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    running += sum;
    dn[tau] = running > 0 ? (sum * tau) / running : 1;
  }
  return dn;
}

// YIN pitch detection on a mono buffer. Returns { freq, clarity } or null
// when there is no clear pitch.
export function detectPitch(input, sampleRate, { threshold = 0.15, minFreq = 70, maxFreq = 1000, gate = 0.008 } = {}) {
  if (rms(input) < gate) return null;
  const { buf, sr } = halve(input, sampleRate);
  const W = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sr / maxFreq));
  const tauMax = Math.min(W, Math.ceil(sr / minFreq));
  if (tauMax <= tauMin + 2) return null;
  const dn = normalisedDifference(buf, tauMax);

  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (dn[t] < threshold) {
      while (t + 1 <= tauMax && dn[t + 1] < dn[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // parabolic interpolation around the dip
  let better = tau;
  if (tau > 1 && tau < tauMax) {
    const a = dn[tau - 1], b = dn[tau], c = dn[tau + 1];
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  const freq = sr / better;
  if (freq < minFreq || freq > maxFreq) return null;
  return { freq, clarity: 1 - dn[tau] };
}

// How strongly the buffer repeats at one expected note's period (0 = not at
// all, 1 = perfectly). Asking "is this note here?" holds up when other strings
// are still ringing, where "what note is this?" often has no clean answer.
export function presence(input, sampleRate, freq, { gate = 0.008 } = {}) {
  if (rms(input) < gate) return 0;
  const { buf, sr } = halve(input, sampleRate);
  const tau = sr / freq;
  const tauMax = Math.ceil(tau) + 1;
  if (tauMax >= Math.floor(buf.length / 2)) return 0;
  const dn = normalisedDifference(buf, tauMax);
  return 1 - Math.min(dn[Math.floor(tau)], dn[Math.ceil(tau)]);
}

// Smooths a stream of readings: reports a pitch once the last few agree,
// which filters out pick noise and the odd octave slip.
export class PitchSmoother {
  constructor(size = 5, agree = 3, spread = 30) {
    Object.assign(this, { size, agree, spread });
    this.recent = [];
  }

  push(reading) {
    this.recent.push(reading ? reading.freq : null);
    if (this.recent.length > this.size) this.recent.shift();
    const vals = this.recent.filter((v) => v !== null).sort((a, b) => a - b);
    if (vals.length < this.agree) return null;
    const median = vals[Math.floor(vals.length / 2)];
    const close = vals.filter((v) => Math.abs(cents(v, median)) <= this.spread);
    if (close.length < this.agree) return null;
    return close.reduce((s, v) => s + v, 0) / close.length;
  }

  reset() {
    this.recent = [];
  }
}

// Generates a plucked-string sound (Karplus-Strong) for tests and demos.
export function pluck(freq, sampleRate, seconds, { decay = 0.996, seed = 1 } = {}) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  // loop delay = line length − 0.5 (averaging with the next sample) + all-pass delay
  const total = sampleRate / freq + 0.5;
  const n = Math.max(2, Math.floor(total - 0.1));
  const frac = total - n;
  const C = (1 - frac) / (1 + frac);
  const line = Float32Array.from({ length: n }, rand);
  const out = new Float32Array(Math.floor(sampleRate * seconds));
  let idx = 0, prevIn = 0, prevOut = 0;
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx];
    const nxt = line[(idx + 1) % n];
    const avg = decay * 0.5 * (cur + nxt);
    const ap = C * avg + prevIn - C * prevOut;
    prevIn = avg;
    prevOut = ap;
    line[idx] = ap;
    out[i] = cur * 0.5;
    idx = (idx + 1) % n;
  }
  return out;
}
