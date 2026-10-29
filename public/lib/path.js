// The learning path as data. New units are added here, not in app code.
//
// Skill types:
//   "reps"    — try it, rate each attempt; pass after `streak` clean tries in a row.
//   "ladder"  — play with the metronome; a clean run steps the tempo up by `step`
//               until `targetBpm` is played clean, which passes the gate.
//   "changes" — one-minute changes between two chords; pass at `target` changes.

export const CHORDS = {
  // frets listed low E → high E. -1 = don't play, 0 = open.
  // fingers: 1 index, 2 middle, 3 ring, 4 little (0 = none).
  Em: { name: "E minor", frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Am: { name: "A minor", frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
};

export const STAGES = [
  { id: "foundation", name: "Foundation", goal: "Open chords, steady strumming, clean changes" },
  { id: "rhythm", name: "Rhythm", goal: "Strum patterns, muting, barre chords" },
  { id: "lead", name: "Lead and ear", goal: "Pentatonic riffs, bends, hearing intervals" },
  { id: "harmony", name: "Fretboard and harmony", goal: "Note names, CAGED, 7th chords" },
  { id: "jazz", name: "Jazz", goal: "Shell voicings, ii–V–I, chord melody" },
];

export const UNITS = [
  {
    id: "u1",
    stage: "foundation",
    number: 1,
    title: "First chords",
    summary: "From picking up the guitar to looping a two-chord minor groove in time.",
    skills: [
      {
        id: "u1-setup",
        type: "reps",
        title: "Setup",
        how: [
          "Sit with the guitar's waist on your right leg, body upright.",
          "Thumb rests behind the neck, roughly behind your middle finger.",
          "Tune all six strings. Octave's own tuner comes in a later update, so use any tuner app for now.",
        ],
        gate: "All six strings in tune in under 2 minutes",
        streak: 1,
        rateLabel: "Tuned in under 2 minutes?",
      },
      {
        id: "u1-em",
        type: "reps",
        title: "E minor",
        chord: "Em",
        how: [
          "Middle finger on the A string, 2nd fret. Ring finger on the D string, 2nd fret.",
          "Press just behind the fret wire, on your fingertips.",
          "Strum all six strings once, then play each string alone to check it rings.",
        ],
        gate: "All 6 strings ring clean, 5 tries in a row",
        streak: 5,
        rateLabel: "Did every string ring?",
      },
      {
        id: "u1-am",
        type: "reps",
        title: "A minor",
        chord: "Am",
        how: [
          "Index on the B string, 1st fret. Middle on the D string, 2nd fret. Ring on the G string, 2nd fret.",
          "Skip the low E string. Strum from the A string down.",
          "Check each of the five strings rings on its own.",
        ],
        gate: "5 strings ring clean, 5 tries in a row",
        streak: 5,
        rateLabel: "Did every string ring?",
      },
      {
        id: "u1-strum",
        type: "ladder",
        title: "Steady down-strums",
        chord: "Em",
        how: [
          "Hold Em. Strum down with your thumb or the backs of your fingers, once per click.",
          "Play 8 bars without a gap, then rate the run.",
          "Clean steps the tempo up. Keep your strumming hand moving even if a chord buzzes.",
        ],
        gate: "8 bars with no gaps at 80 BPM",
        bars: 8,
        startBpm: 60,
        targetBpm: 80,
        step: 5,
        beatsPerBar: 4,
      },
      {
        id: "u1-changes",
        type: "changes",
        title: "Em ↔ Am changes",
        pair: ["Em", "Am"],
        how: [
          "Switch between Em and Am for one minute, strumming once on each chord.",
          "Tap the screen for every clean change.",
          "Your middle and ring fingers keep the same shape. Move them across together.",
        ],
        gate: "30 clean changes in a minute",
        target: 30,
      },
      {
        id: "u1-loop",
        type: "ladder",
        title: "Anchor loop",
        pair: ["Em", "Am"],
        how: [
          "Em for 2 bars, Am for 2 bars, repeat for a full minute.",
          "Four down-strums per bar. Change on beat 1 without stopping.",
          "This is the Em → Am move inside E85, your Foundation goal song.",
        ],
        gate: "1 minute with no stops at 80 BPM",
        seconds: 60,
        startBpm: 60,
        targetBpm: 80,
        step: 5,
        beatsPerBar: 4,
      },
    ],
  },
];

// How many bars one run of a ladder drill lasts at a given tempo.
export function runBars(skill, bpm) {
  if (skill.bars) return skill.bars;
  if (skill.seconds) return Math.max(1, Math.round((skill.seconds * bpm) / 60 / skill.beatsPerBar));
  return 8;
}

export function allSkills() {
  return UNITS.flatMap((u) => u.skills.map((s) => ({ ...s, unit: u.id })));
}

export function findSkill(id) {
  for (const u of UNITS) {
    const s = u.skills.find((k) => k.id === id);
    if (s) return { skill: s, unit: u };
  }
  return null;
}
