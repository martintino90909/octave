// Web Audio metronome with a look-ahead scheduler, so clicks stay in time even
// when the page is busy. Beat 1 of each bar is accented.

let ctx = null;

export function audio() {
  if (!ctx) {
    // iOS: "playback" lets sound through with the ring/silent switch on.
    try {
      if (navigator.audioSession) navigator.audioSession.type = "playback";
    } catch {}
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function beep(time, { freq = 1000, length = 0.05, volume = 0.6 } = {}) {
  const ac = audio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  osc.connect(gain).connect(ac.destination);
  osc.start(time);
  osc.stop(time + length + 0.02);
}

export class Metronome {
  constructor({ bpm = 60, beatsPerBar = 4, countInBars = 1, bars = 0, onBeat, onEnd } = {}) {
    Object.assign(this, { bpm, beatsPerBar, countInBars, bars, onBeat, onEnd });
    this.timer = null;
    this.running = false;
    this.gen = 0;
  }

  get totalBeats() {
    return this.bars ? (this.countInBars + this.bars) * this.beatsPerBar : Infinity;
  }

  start() {
    if (this.running) return;
    const ac = audio();
    this.running = true;
    this.beat = 0;
    this.nextTime = ac.currentTime + 0.12;
    const tick = () => {
      while (this.running && this.nextTime < ac.currentTime + 0.12) {
        this.schedule(this.beat, this.nextTime);
        this.beat++;
        this.nextTime += 60 / this.bpm;
        if (this.beat >= this.totalBeats) {
          const endAt = this.nextTime;
          const gen = this.gen;
          this.running = false;
          setTimeout(() => gen === this.gen && this.onEnd?.(), Math.max(0, (endAt - ac.currentTime) * 1000));
        }
      }
      if (this.running) this.timer = setTimeout(tick, 25);
    };
    tick();
  }

  schedule(beat, time) {
    const inBar = beat % this.beatsPerBar;
    const countIn = beat < this.countInBars * this.beatsPerBar;
    beep(time, { freq: inBar === 0 ? 1568 : 1046, volume: countIn ? 0.35 : 0.6 });
    const bar = Math.floor(beat / this.beatsPerBar) - this.countInBars + 1; // 0 or less during count-in
    const delay = Math.max(0, (time - audio().currentTime) * 1000);
    const gen = this.gen;
    setTimeout(() => gen === this.gen && this.onBeat?.({ beat: inBar, bar, countIn }), delay);
  }

  stop() {
    this.running = false;
    this.gen = (this.gen || 0) + 1; // drops visual beats already queued
    clearTimeout(this.timer);
  }
}

// Keeps the screen awake during a drill, where the browser allows it.
let lock = null;
export async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator && !lock) {
      lock = await navigator.wakeLock.request("screen");
      lock.addEventListener("release", () => (lock = null));
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {}
}
