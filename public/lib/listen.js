// Microphone input: opens the mic with the phone's voice processing turned
// off (it would distort pitch), then reads pitch and loudness ~25 times a second.

import { audio } from "./metronome.js";
import { detectPitch, presence, rms, PitchSmoother } from "./pitch.js";

export class MicError extends Error {}

export async function openMic() {
  if (!navigator.mediaDevices?.getUserMedia) throw new MicError("unsupported");
  try {
    if (navigator.audioSession) navigator.audioSession.type = "play-and-record";
  } catch {}
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
  } catch (e) {
    throw new MicError(e && e.name === "NotAllowedError" ? "denied" : "failed");
  }
  const ac = audio();
  const source = ac.createMediaStreamSource(stream);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 4096;
  source.connect(analyser);
  return {
    ac,
    analyser,
    close() {
      stream.getTracks().forEach((t) => t.stop());
      source.disconnect();
      try {
        if (navigator.audioSession) navigator.audioSession.type = "playback";
      } catch {}
    },
  };
}

// Calls onReading({ freq, raw, level, now, probe }) until the returned stop() is
// called. probe(f) says how strongly the note f is sounding in this reading.
export function listen(mic, onReading, { every = 40, smoother = new PitchSmoother() } = {}) {
  const buf = new Float32Array(mic.analyser.fftSize);
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    mic.analyser.getFloatTimeDomainData(buf);
    const level = rms(buf);
    const raw = detectPitch(buf, mic.ac.sampleRate, { threshold: 0.25 });
    const freq = smoother.push(raw);
    const probe = (f) => presence(buf, mic.ac.sampleRate, f);
    onReading({ freq, raw, level, now: performance.now(), probe });
    setTimeout(tick, every);
  };
  tick();
  return () => {
    stopped = true;
  };
}

export function micMessage(err) {
  if (err?.message === "denied") return "Octave isn't allowed to use the mic. Allow microphone access for this site in Safari, then try again.";
  if (err?.message === "unsupported") return "This browser can't use the mic. Open Octave in Safari.";
  return "The mic didn't start. Close other apps using it and try again.";
}
