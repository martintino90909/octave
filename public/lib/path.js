// The learning path as data. New units are added here, not in app code.
//
// Skill types:
//   "reps"    — try it, rate each attempt; pass after `streak` clean tries in a row.
//               check: "tuning" | "strings" (a chord, string by string) |
//               "notes" (a sequence of single notes) — the mic does the rating.
//   "ladder"  — play with the metronome; a clean run steps the tempo up by `step`
//               until `targetBpm` is played clean, which passes the gate.
//               Optional: `progression` (chord ids, one per bar), `pattern`
//               (8 or 16 strum tokens: D, U, X for a muted chuck, - for a miss).
//   "changes" — one-minute changes between two chords; pass at `target` changes.
//   "ear"     — hear it, name it; `options` are keys of EAR in ear.js.
//
// Strings are numbered 0 (low E) to 5 (high E) in data, as on a chord box.

export const CHORDS = {
  // frets low E → high E; -1 = don't play, 0 = open.
  // fingers: 1 index, 2 middle, 3 ring, 4 little (0 = none). barre: index across strings.
  Em: { sym: "Em", name: "E minor", frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  Am: { sym: "Am", name: "A minor", frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  C: { sym: "C", name: "C major", frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  G: { sym: "G", name: "G major", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  D: { sym: "D", name: "D major", frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Dm: { sym: "Dm", name: "D minor", frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  F: { sym: "F", name: "F (small)", frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1], barre: { fret: 1, from: 4, to: 5 } },

  E5: { sym: "E5", name: "E5", frets: [0, 2, 2, -1, -1, -1], fingers: [0, 1, 2, 0, 0, 0] },
  A5: { sym: "A5", name: "A5", frets: [-1, 0, 2, 2, -1, -1], fingers: [0, 0, 1, 2, 0, 0] },
  D5: { sym: "D5", name: "D5", frets: [-1, -1, 0, 2, 3, -1], fingers: [0, 0, 0, 1, 3, 0] },
  G5: { sym: "G5", name: "G5", frets: [3, 5, 5, -1, -1, -1], fingers: [1, 3, 4, 0, 0, 0] },
  E5x7: { sym: "E5", name: "E5 (7th fret)", frets: [-1, 7, 9, 9, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },
  Ds5x6: { sym: "D♯5", name: "D♯5 (6th fret)", frets: [-1, 6, 8, 8, -1, -1], fingers: [0, 1, 3, 4, 0, 0] },

  Fbarre: { sym: "F", name: "F (full barre)", frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, from: 0, to: 5 } },
  Bm: { sym: "Bm", name: "B minor", frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 2, from: 1, to: 5 } },
  Gbarre: { sym: "G", name: "G (barre)", frets: [3, 5, 5, 4, 3, 3], fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 3, from: 0, to: 5 } },
  Ambarre: { sym: "Am", name: "A minor (barre)", frets: [5, 7, 7, 5, 5, 5], fingers: [1, 3, 4, 1, 1, 1], barre: { fret: 5, from: 0, to: 5 } },
  Cm: { sym: "Cm", name: "C minor", frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: { fret: 3, from: 1, to: 5 } },

  E7: { sym: "E7", name: "E7", frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  A7: { sym: "A7", name: "A7", frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  D7: { sym: "D7", name: "D7", frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  G7: { sym: "G7", name: "G7", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  Cmaj7: { sym: "Cmaj7", name: "C major 7", frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  Am7: { sym: "Am7", name: "A minor 7", frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  Dm7: { sym: "Dm7", name: "D minor 7", frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], barre: { fret: 1, from: 4, to: 5 } },
  Em7: { sym: "Em7", name: "E minor 7", frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  Fmaj7: { sym: "Fmaj7", name: "F major 7", frets: [-1, -1, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  Cmaj9: { sym: "Cmaj9", name: "C major 9", frets: [-1, 3, 2, 4, 3, 0], fingers: [0, 2, 1, 4, 3, 0] },
  Em9: { sym: "Em9", name: "E minor 9", frets: [0, 2, 0, 0, 0, 2], fingers: [0, 2, 0, 0, 0, 4] },

  // jazz shells: root, 7th and 3rd only; the other strings are muted
  Gmaj7sh: { sym: "Gmaj7", name: "Gmaj7 shell", frets: [3, -1, 4, 4, -1, -1], fingers: [2, 0, 3, 4, 0, 0] },
  G7sh: { sym: "G7", name: "G7 shell", frets: [3, -1, 3, 4, -1, -1], fingers: [2, 0, 3, 4, 0, 0] },
  Gm7sh: { sym: "Gm7", name: "Gm7 shell", frets: [3, -1, 3, 3, -1, -1], fingers: [2, 0, 3, 4, 0, 0] },
  Cmaj7sh: { sym: "Cmaj7", name: "Cmaj7 shell", frets: [-1, 3, -1, 4, 5, -1], fingers: [0, 2, 0, 3, 4, 0] },
  C7sh: { sym: "C7", name: "C7 shell", frets: [-1, 3, -1, 3, 5, -1], fingers: [0, 2, 0, 3, 4, 0] },
  Cm7sh: { sym: "Cm7", name: "Cm7 shell", frets: [-1, 3, -1, 3, 4, -1], fingers: [0, 2, 0, 3, 4, 0] },
  Dm7sh: { sym: "Dm7", name: "Dm7 shell", frets: [-1, 5, -1, 5, 6, -1], fingers: [0, 2, 0, 3, 4, 0] },
  D7sh: { sym: "D7", name: "D7 shell", frets: [-1, 5, -1, 5, 7, -1], fingers: [0, 2, 0, 3, 4, 0] },
  Am7sh: { sym: "Am7", name: "Am7 shell", frets: [5, -1, 5, 5, -1, -1], fingers: [2, 0, 3, 4, 0, 0] },
  Am7b5sh: { sym: "Am7♭5", name: "Am7♭5 shell", frets: [5, -1, 5, 5, -1, -1], fingers: [2, 0, 3, 4, 0, 0] },
  F7sh: { sym: "F7", name: "F7 shell", frets: [1, -1, 1, 2, -1, -1], fingers: [1, 0, 2, 3, 0, 0] },
  Bb7sh: { sym: "B♭7", name: "B♭7 shell", frets: [-1, 1, -1, 1, 3, -1], fingers: [0, 1, 0, 2, 4, 0] },
  Bbmaj7sh: { sym: "B♭maj7", name: "B♭maj7 shell", frets: [-1, 1, -1, 2, 3, -1], fingers: [0, 1, 0, 2, 3, 0] },
  Ebmaj7sh: { sym: "E♭maj7", name: "E♭maj7 shell", frets: [-1, 6, -1, 7, 8, -1], fingers: [0, 1, 0, 2, 3, 0] },
};

export const STAGES = [
  { id: "foundation", name: "Foundation", goal: "Open chords, steady strumming, clean changes" },
  { id: "rhythm", name: "Rhythm", goal: "Power chords, groove, barre chords" },
  { id: "lead", name: "Lead and ear", goal: "Pentatonic, bends, hearing intervals" },
  { id: "harmony", name: "Fretboard and harmony", goal: "Note names, 7th and 9th chords" },
  { id: "jazz", name: "Jazz", goal: "Shell voicings, ii–V–I, comping, a standard" },
];

// Shared strum patterns: 8 tokens = eighth notes, 16 = sixteenths.
const P = {
  quarters: "D - D - D - D -",
  eighths: "D U D U D U D U",
  chugs: "D D D D D D D D",
  folk: "D - D U - U D U",
  chuck: "D U X U D U X U",
  sync: "D - X U - U X U",
  sixteenths: "D U D U D U D U D U D U D U D U",
  charleston: "D - - D - - - -",
};

// A-minor pentatonic, first box at the 5th fret, low to high.
const PENT_A = [[0, 5], [0, 8], [1, 5], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [4, 5], [4, 8], [5, 5], [5, 8]];
// The same box at the 1st fret: F minor pentatonic.
const PENT_F = PENT_A.map(([s, f]) => [s, f - 4]);

const ladder = (extra) => ({ type: "ladder", step: 5, beatsPerBar: 4, ...extra });
const chordReps = (extra) => ({ type: "reps", check: "strings", streak: 5, rateLabel: "Did every string ring?", ...extra });

export const UNITS = [
  // ───────────── Foundation ─────────────
  {
    id: "u1", stage: "foundation", number: 1, title: "First chords",
    summary: "From picking up the guitar to looping a two-chord minor groove in time.",
    skills: [
      {
        id: "u1-setup", type: "reps", title: "Setup",
        how: [
          "Sit with the guitar's waist on your right leg, body upright.",
          "Thumb rests behind the neck, roughly behind your middle finger.",
          "Start timed tuning, then pluck one open string at a time. Turn its peg until the needle sits in the middle.",
          "Each string ticks off once it holds in tune. The clock starts at your first note.",
        ],
        gate: "All six strings in tune in under 2 minutes",
        check: "tuning", streak: 1, rateLabel: "Tuned in under 2 minutes?",
      },
      chordReps({
        id: "u1-em", title: "E minor", chord: "Em",
        how: [
          "Middle finger on the A string, 2nd fret. Ring finger on the D string, 2nd fret.",
          "Press just behind the fret wire, on your fingertips.",
          "Strum all six strings once, then check with the mic: pluck each string on its own while holding the shape.",
        ],
        gate: "All 6 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u1-am", title: "A minor", chord: "Am",
        how: [
          "Index on the B string, 1st fret. Middle on the D string, 2nd fret. Ring on the G string, 2nd fret.",
          "Skip the low E string. Strum from the A string down.",
          "Check with the mic: pluck each of the five strings on its own while holding the shape.",
        ],
        gate: "5 strings ring clean, 5 tries in a row",
      }),
      ladder({
        id: "u1-strum", title: "Steady down-strums", chord: "Em", pattern: P.quarters,
        how: [
          "Hold Em. Strum down with your thumb or the backs of your fingers, once per click.",
          "Play 8 bars without a gap, then rate the run.",
          "Clean steps the tempo up. Keep your strumming hand moving even if a chord buzzes.",
        ],
        gate: "8 bars with no gaps at 80 BPM", bars: 8, startBpm: 60, targetBpm: 80,
      }),
      {
        id: "u1-changes", type: "changes", title: "Em ↔ Am changes", pair: ["Em", "Am"],
        how: [
          "Switch between Em and Am for one minute, strumming once on each chord.",
          "Tap the screen for every clean change.",
          "Your middle and ring fingers keep the same shape. Move them across together.",
        ],
        gate: "30 clean changes in a minute", target: 30,
      },
      ladder({
        id: "u1-loop", title: "Anchor loop", progression: ["Em", "Em", "Am", "Am"], pattern: P.quarters,
        how: [
          "Em for 2 bars, Am for 2 bars, repeat for a full minute.",
          "Four down-strums per bar. Change on beat 1 without stopping.",
          "This is the Em → Am move inside E85, your Foundation goal song.",
        ],
        gate: "1 minute with no stops at 80 BPM", seconds: 60, startBpm: 60, targetBpm: 80,
      }),
    ],
  },
  {
    id: "u2", stage: "foundation", number: 2, title: "C, G and D",
    summary: "The three open chords behind thousands of songs, plus your first go with a pick.",
    skills: [
      chordReps({
        id: "u2-c", title: "C major", chord: "C",
        how: [
          "Ring finger on the A string, 3rd fret. Middle on the D string, 2nd fret. Index on the B string, 1st fret.",
          "Skip the low E string.",
          "Arch your fingers so the open G and high E strings can ring under them.",
        ],
        gate: "5 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u2-am-c", type: "changes", title: "Am ↔ C changes", pair: ["Am", "C"], target: 30,
        how: [
          "Am to C moves one finger: your ring finger jumps from the G string to the A string, 3rd fret.",
          "Index and middle stay exactly where they are.",
          "Tap for every clean change.",
        ],
        gate: "30 clean changes in a minute",
      },
      chordReps({
        id: "u2-g", title: "G major", chord: "G",
        how: [
          "Middle finger on the low E string, 3rd fret. Index on the A string, 2nd fret. Ring on the high E string, 3rd fret.",
          "All six strings ring. Keep the index tip upright so the D string isn't touched.",
        ],
        gate: "All 6 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u2-d", title: "D major", chord: "D",
        how: [
          "Index on the G string, 2nd fret. Ring on the B string, 3rd fret. Middle on the high E string, 2nd fret.",
          "Strum from the open D string down; skip the two low strings.",
        ],
        gate: "4 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u2-g-c", type: "changes", title: "G ↔ C changes", pair: ["G", "C"], target: 25,
        how: [
          "Lift all three fingers together and land them as one shape.",
          "Look at where the next chord's ring finger goes before you move.",
        ],
        gate: "25 clean changes in a minute",
      },
      {
        id: "u2-pick", type: "reps", title: "Pick grip", streak: 1, chord: "G",
        how: [
          "Hold the pick between the pad of your thumb and the side of your index finger, with just the tip showing.",
          "Grip firm enough not to drop it, loose enough that it can give a little on the strings.",
          "Strum G with the pick for a full minute. If it twists or slips, regrip and start the minute again.",
        ],
        gate: "1 minute of strumming without the pick slipping or turning",
        rateLabel: "A full minute with no slipping?",
      },
      ladder({
        id: "u2-loop", title: "Three-chord loop", progression: ["G", "G", "C", "C", "D", "D", "G", "G"], pattern: P.quarters,
        how: [
          "G, C and D for two bars each, then G again. Four down-strums per bar.",
          "Fingers or pick, your choice. Change on beat 1.",
          "If a change is late, keep strumming: a buzzy chord in time beats a clean one out of time.",
        ],
        gate: "16 bars with no stops at 80 BPM", bars: 16, startBpm: 60, targetBpm: 80,
      }),
    ],
  },
  {
    id: "u3", stage: "foundation", number: 3, title: "Down-ups and four chords",
    summary: "Eighth-note strumming, the pattern you'll use most, D minor, and the four chords under half of pop.",
    skills: [
      ladder({
        id: "u3-eighths", title: "Down-up strumming", chord: "Em", pattern: P.eighths,
        how: [
          "Down on each click, up halfway between. Count 1 & 2 & 3 & 4 &.",
          "Keep your hand swinging like a pendulum, even when it misses the strings.",
          "Down-strums hit the low strings more; up-strums catch the top three or four.",
        ],
        gate: "8 bars clean at 90 BPM", bars: 8, startBpm: 60, targetBpm: 90,
      }),
      ladder({
        id: "u3-pick-strum", title: "Down-ups with the pick", chord: "Em", pattern: P.eighths,
        how: [
          "Same down-up strum, now with the pick.",
          "Let the pick angle slightly so it glides over the strings instead of digging in.",
        ],
        gate: "8 bars clean at 70 BPM with the pick", bars: 8, startBpm: 55, targetBpm: 70,
      }),
      ladder({
        id: "u3-folk", title: "The everyday strum", chord: "G", pattern: P.folk,
        how: [
          "Strum on 1, 2, &, &, 4, &: down, down-up, up, down-up.",
          "On the gaps your hand keeps moving but misses the strings. That's what makes it swing.",
          "Say it out loud the first few times: 'down, down-up, up-down-up'.",
        ],
        gate: "8 bars clean at 85 BPM", bars: 8, startBpm: 60, targetBpm: 85,
      }),
      chordReps({
        id: "u3-dm", title: "D minor", chord: "Dm",
        how: [
          "Index on the high E string, 1st fret. Middle on the G string, 2nd fret. Ring on the B string, 3rd fret.",
          "Strum from the open D string down.",
        ],
        gate: "4 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u3-em-c", type: "changes", title: "Em ↔ C changes", pair: ["Em", "C"], target: 25,
        how: [
          "Your middle finger stays near the 2nd fret; it moves from the A string to the D string.",
          "Lead with that finger and let the others follow.",
        ],
        gate: "25 clean changes in a minute",
      },
      ladder({
        id: "u3-four", title: "Four-chord loop", progression: ["G", "D", "Em", "C"], pattern: P.folk,
        how: [
          "G, D, Em, C: one bar each, with the everyday strum.",
          "These four chords sit under hundreds of songs.",
          "If a change is late, drop the last up-strum of the bar to buy time.",
        ],
        gate: "16 bars with no stops at 85 BPM", bars: 16, startBpm: 60, targetBpm: 85,
      }),
    ],
  },
  {
    id: "u4", stage: "foundation", number: 4, title: "E85",
    summary: "A small F joins the set, and five chords add up to your Foundation goal song.",
    skills: [
      chordReps({
        id: "u4-f", title: "Small F", chord: "F",
        how: [
          "Lay your index flat across the B and high E strings at the 1st fret.",
          "Middle on the G string, 2nd fret. Ring on the D string, 3rd fret.",
          "Roll the index slightly onto its side: the bony edge presses harder than the soft pad.",
          "The full six-string F comes in the Rhythm stage.",
        ],
        gate: "4 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u4-c-f", type: "changes", title: "C ↔ F changes", pair: ["C", "F"], target: 25,
        how: [
          "From C, move your ring and middle fingers across one string each, then flatten your index over the top two strings.",
          "The shape keeps the same outline; it just shifts.",
        ],
        gate: "25 clean changes in a minute",
      },
      {
        id: "u4-dm-em", type: "changes", title: "Dm ↔ Em changes", pair: ["Dm", "Em"], target: 25,
        how: [
          "A full lift: all three fingers leave and two land.",
          "Look at Em's spot on the A and D strings before you move.",
        ],
        gate: "25 clean changes in a minute",
      },
      {
        id: "u4-g-f", type: "changes", title: "G ↔ F changes", pair: ["G", "F"], target: 25,
        how: ["Another full lift. Land the index barre first, then the other two."],
        gate: "25 clean changes in a minute",
      },
      ladder({
        id: "u4-alt-pick", title: "Alternate picking", pattern: P.eighths,
        how: [
          "Pick the open high E string: down on the click, up between.",
          "Small movements from the wrist; the pick barely leaves the string.",
          "Every note the same volume, down or up.",
        ],
        gate: "8 bars of even eighth notes at 80 BPM", bars: 8, startBpm: 60, targetBpm: 80,
      }),
      ladder({
        id: "u4-e85", title: "E85 progression", progression: ["Dm", "Em", "Am", "G", "F"], pattern: P.quarters,
        how: [
          "Fan charts write E85 as Dm, Em, Am, G, F with a capo on the 2nd fret. Check it against the record.",
          "One chord per bar here; listen to the track for exactly where each change lands.",
          "No capo yet? Play it as written: you'll be two frets below the record, which is fine for practice.",
        ],
        gate: "20 bars with no stops at 95 BPM", bars: 20, startBpm: 65, targetBpm: 95,
      }),
      {
        id: "u4-e85-play", type: "reps", title: "Play along: E85", streak: 1, progression: ["Dm", "Em", "Am", "G", "F"],
        how: [
          "Put E85 on. With a capo (even a makeshift one) on the 2nd fret, you'll be in the record's key.",
          "Find where Dm comes round and come in there. Strum along through the whole track.",
          "Miss a change? Keep strumming and catch the next one.",
        ],
        gate: "Play through the whole track without stopping",
        rateLabel: "Did you play through the whole track?",
      },
    ],
  },

  // ───────────── Rhythm ─────────────
  {
    id: "u5", stage: "rhythm", number: 5, title: "Power chords and Tore Up",
    summary: "Two-note chords with bite, the palm mute, and the Tore Up riff.",
    skills: [
      ladder({
        id: "u5-chugs", title: "Palm-muted chugs", chord: "E5", pattern: P.chugs,
        how: [
          "Rest the edge of your strumming hand on the strings right where they meet the bridge.",
          "Strum down on every eighth note, two per click. You want a tight 'chug', not a ring.",
          "Slide your hand toward the neck to mute more, back toward the bridge to mute less.",
          "The pick makes this much easier; try it here.",
        ],
        gate: "8 bars of even chugs at 110 BPM", bars: 8, startBpm: 70, targetBpm: 110,
      }),
      chordReps({
        id: "u5-g5", title: "Movable power chord", chord: "G5",
        how: [
          "Index on the low E string, 3rd fret. Ring and pinky on the A and D strings, 5th fret.",
          "Let your index lightly touch the higher strings to mute them.",
          "This shape works anywhere: the note under your index names the chord.",
        ],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      ladder({
        id: "u5-power-loop", title: "Power chord loop", progression: ["E5", "A5", "D5", "A5"], pattern: P.chugs,
        how: [
          "Open-string power chords: E5, A5, D5, A5, one bar each, palm muted.",
          "Each is just an open root with the 5th (and sometimes the octave) above it: no major or minor.",
        ],
        gate: "16 bars with no stops at 100 BPM", bars: 16, startBpm: 70, targetBpm: 100,
      }),
      ladder({
        id: "u5-crossing", title: "String crossing", pattern: P.eighths,
        how: [
          "Alternate pick between the open B and high E strings: down on B, up on E.",
          "Keep the down-up motion going as you cross; don't stop to aim.",
        ],
        gate: "8 bars clean at 70 BPM", bars: 8, startBpm: 55, targetBpm: 70,
      }),
      ladder({
        id: "u5-toreup", title: "Tore Up riff", progression: ["E5x7", "Ds5x6"], pattern: P.chugs,
        how: [
          "Power chord on the A string: E5 at the 7th fret, then the same shape one fret down for D♯5.",
          "Palm-muted chugs, alternating one bar each.",
          "Transcriptions of Tore Up disagree (some use drop D tuning). This follows the E to E♭ chart; check it against the record.",
        ],
        gate: "16 bars with no stops at 80 BPM", bars: 16, startBpm: 60, targetBpm: 80,
      }),
    ],
  },
  {
    id: "u6", stage: "rhythm", number: 6, title: "Groove",
    summary: "Chucks, syncopation and sixteenths: the laid-back, percussive strumming under hip-hop and R&B.",
    skills: [
      ladder({
        id: "u6-chuck", title: "The chuck", chord: "Am", pattern: P.chuck,
        how: [
          "On each X, slap the strings with the side of your strumming hand as it comes down, so they're muted.",
          "It sounds like a snare drum, so it lands on 2 and 4, like a snare.",
          "Ease the fretting hand off a little on the chuck if it rings.",
        ],
        gate: "8 bars clean at 90 BPM", bars: 8, startBpm: 60, targetBpm: 90,
      }),
      ladder({
        id: "u6-sixteenths", title: "Sixteenth notes", chord: "Em", pattern: P.sixteenths,
        how: [
          "Four strums per click: down, up, down, up. Count 1 e & a 2 e & a.",
          "Keep the strokes small and light; the speed comes from the wrist.",
        ],
        gate: "4 bars of even sixteenths at 70 BPM", bars: 4, startBpm: 50, targetBpm: 70,
      }),
      {
        id: "u6-am-f", type: "changes", title: "Am ↔ F changes", pair: ["Am", "F"], target: 30,
        how: [
          "Your index stays on the B string at the 1st fret and flattens to cover the high E too.",
          "Middle and ring swap jobs: ring goes to the D string, 3rd fret; middle to the G string, 2nd fret.",
        ],
        gate: "30 clean changes in a minute",
      },
      ladder({
        id: "u6-groove", title: "Syncopated groove", progression: ["Am", "F", "C", "G"], pattern: P.sync,
        how: [
          "Am, F, C, G: one bar each, with chucks on 2 and 4 and the off-beat up-strums.",
          "Lean back on it: the groove matters more than every string ringing.",
        ],
        gate: "16 bars with no stops at 85 BPM", bars: 16, startBpm: 60, targetBpm: 85,
      }),
      {
        id: "u6-beat", type: "reps", title: "Groove over a beat", streak: 1,
        how: [
          "Pick a track by A$AP Rocky, Tyler, the Creator or Don Toliver with a laid-back beat.",
          "Mute every string with your fretting hand and play the chuck groove as pure rhythm, in time with the drums.",
          "Lock your chucks to the snare.",
        ],
        gate: "Keep the groove through a whole track",
        rateLabel: "Did you keep the groove through the whole track?",
      },
    ],
  },
  {
    id: "u7", stage: "rhythm", number: 7, title: "Barre chords",
    summary: "The full F and B minor: the skill that unlocks the whole neck.",
    skills: [
      chordReps({
        id: "u7-f", title: "Full F", chord: "Fbarre",
        how: [
          "Lay your index across all six strings at the 1st fret, close to the fret wire.",
          "Middle on the G string, 2nd fret. Ring on the A string and pinky on the D string, both 3rd fret.",
          "Pull back gently with your arm instead of squeezing harder with your thumb.",
          "The mic shows which string is dead, usually the B or G under the crease of your index. Roll the index slightly to move the crease.",
        ],
        gate: "All 6 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u7-c-f", type: "changes", title: "C ↔ full F changes", pair: ["C", "Fbarre"], target: 20,
        how: ["Land the barre first, then the other three fingers as one shape."],
        gate: "20 clean changes in a minute",
      },
      chordReps({
        id: "u7-bm", title: "B minor", chord: "Bm",
        how: [
          "Index across the A to high E strings at the 2nd fret.",
          "Middle on the B string, 3rd fret. Ring on the D string and pinky on the G string, both 4th fret.",
          "Skip the low E string.",
        ],
        gate: "5 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u7-bm-g", type: "changes", title: "Bm ↔ G changes", pair: ["Bm", "G"], target: 20,
        how: ["A full lift from a barre to an open chord. Release the barre completely before you move."],
        gate: "20 clean changes in a minute",
      },
      ladder({
        id: "u7-loop", title: "Barre loop", progression: ["Em", "Bm", "C", "G"], pattern: P.folk,
        how: [
          "Em, Bm, C, G: one bar each, with the everyday strum.",
          "Bm is the only barre. Practise the change into it on its own if it's late.",
        ],
        gate: "16 bars with no stops at 85 BPM", bars: 16, startBpm: 60, targetBpm: 85,
      }),
    ],
  },
  {
    id: "u8", stage: "rhythm", number: 8, title: "Moving shapes",
    summary: "Two barre shapes that slide anywhere, giving you every major and minor chord.",
    skills: [
      chordReps({
        id: "u8-g", title: "E-shape major", chord: "Gbarre",
        how: [
          "Your full F shape, slid up two frets: the index barres the 3rd fret.",
          "The root is on the low E string: G at the 3rd fret, A at the 5th, C at the 8th.",
        ],
        gate: "All 6 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u8-am", title: "E-shape minor", chord: "Ambarre",
        how: [
          "Take the barre shape and lift your middle finger: that's minor.",
          "At the 5th fret this is A minor.",
        ],
        gate: "All 6 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u8-cm", title: "A-shape minor", chord: "Cm",
        how: [
          "Your B minor shape, slid up one fret: C minor at the 3rd fret.",
          "Here the root is on the A string.",
        ],
        gate: "5 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u8-shift", type: "changes", title: "Sliding the shape", pair: ["Gbarre", "Ambarre"], target: 20,
        how: [
          "G at the 3rd fret to A minor at the 5th: slide the whole hand up two frets and lift the middle finger on the way.",
          "Ease the pressure as you slide, then squeeze on arrival.",
        ],
        gate: "20 clean changes in a minute",
      },
      ladder({
        id: "u8-loop", title: "Barre-chord loop", progression: ["Ambarre", "Gbarre", "Fbarre", "Gbarre"], pattern: P.sync,
        how: [
          "A minor, G, F, G: the same shape sliding between the 5th, 3rd and 1st frets.",
          "Use the syncopated groove from Unit 6.",
        ],
        gate: "16 bars with no stops at 85 BPM", bars: 16, startBpm: 60, targetBpm: 85,
      }),
    ],
  },

  // ───────────── Lead and ear ─────────────
  {
    id: "u9", stage: "lead", number: 9, title: "Minor pentatonic",
    summary: "The five-note scale behind most guitar solos, in its first box.",
    skills: [
      {
        id: "u9-up", type: "reps", check: "notes", title: "The box, going up", notes: PENT_A, streak: 3,
        how: [
          "This is A minor pentatonic: A, C, D, E, G.",
          "Index plays the 5th-fret notes; ring or pinky plays the 7th and 8th.",
          "Play each note when it lights up. The mic follows you.",
        ],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
      {
        id: "u9-down", type: "reps", check: "notes", title: "The box, coming down", notes: [...PENT_A].reverse(), streak: 3,
        how: ["The same twelve notes, high to low."],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
      ladder({
        id: "u9-time", title: "The box in time", pattern: P.eighths,
        how: [
          "Up and down the box, two notes per click, alternate picking.",
          "Turn round at the top without a pause.",
        ],
        gate: "6 bars clean at 90 BPM", bars: 6, startBpm: 60, targetBpm: 90,
      }),
      {
        id: "u9-lick", type: "reps", check: "notes", title: "First lick", streak: 3,
        notes: [[4, 8], [4, 5], [3, 7], [3, 5], [2, 7], [3, 5], [2, 7]],
        how: [
          "Seven notes from the box, falling then rocking back.",
          "Play it slowly and evenly first. Speed comes later.",
        ],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
    ],
  },
  {
    id: "u10", stage: "lead", number: 10, title: "Bends, slides and legato",
    summary: "The moves that make single notes sing.",
    skills: [
      {
        id: "u10-hammer", type: "reps", check: "notes", title: "Hammer-on and pull-off", streak: 5,
        notes: [[3, 5], { s: 3, f: 7, legato: true, window: 1500 }, { s: 3, f: 5, legato: true, window: 1500 }],
        how: [
          "Pick the G string at the 5th fret with your index down.",
          "Without picking again, bring your ring finger down hard on the 7th fret: a hammer-on.",
          "Then flick the ring finger off downward so the 5th fret sounds: a pull-off.",
        ],
        gate: "5 clean hammer-on and pull-off pairs in a row",
        rateLabel: "Did all three notes sound?",
      },
      {
        id: "u10-slide", type: "reps", check: "notes", title: "Slide", streak: 5,
        notes: [[3, 5], { s: 3, f: 7, legato: true, window: 1500 }],
        how: [
          "Pick the G string at the 5th fret and slide the same finger up to the 7th without letting go.",
          "Keep the pressure on as you move, or the note dies.",
        ],
        gate: "5 clean slides in a row",
        rateLabel: "Did the 7th fret sound?",
      },
      {
        id: "u10-bend", type: "reps", check: "notes", title: "Whole-step bend", streak: 5,
        notes: [[3, 9], [3, 7], { s: 3, f: 7, sound: 9, legato: true, window: 2500, label: "bend up" }],
        how: [
          "Play the G string at the 9th fret: that's the note to aim for.",
          "Then pick the 7th fret and push the string up until it sounds the same as the 9th.",
          "Use your ring finger, with the middle and index behind it on the same string to help push.",
        ],
        gate: "5 in-tune bends in a row",
        rateLabel: "Did the bend reach the target note?",
      },
      {
        id: "u10-vibrato", type: "reps", title: "Vibrato", streak: 3,
        how: [
          "Hold the G string at the 7th fret and rock the pitch slightly up and back, steadily.",
          "Small, even and in time beats wide and wobbly.",
        ],
        gate: "3 even vibratos you're happy with",
        rateLabel: "Was it even?",
      },
      {
        id: "u10-lick", type: "reps", check: "notes", title: "Bluesy lick", streak: 3,
        notes: [[4, 8], [4, 5], [3, 7], { s: 3, f: 7, sound: 9, legato: true, window: 2500, label: "bend up" }, [3, 5], [2, 7]],
        how: [
          "Two notes on the B string, then a bend on the G string up to the B string's note, then down to finish.",
          "Let the bent note ring before moving on.",
        ],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
    ],
  },
  {
    id: "u11", stage: "lead", number: 11, title: "Ear training",
    summary: "Hearing what you play: major and minor, intervals, and picking out hooks.",
    skills: [
      {
        id: "u11-majmin", type: "ear", title: "Major or minor?", options: ["maj", "min"], streak: 10,
        how: [
          "Listen to the chord. Major sounds bright and settled; minor sounds darker.",
          "Play it as many times as you like before answering.",
        ],
        gate: "10 right in a row",
      },
      {
        id: "u11-fifth", type: "ear", title: "Fifth or octave?", options: ["P5", "P8"], streak: 8,
        how: [
          "Two notes, low then high.",
          "An octave sounds like the same note, higher. A fifth sounds open, like a power chord.",
        ],
        gate: "8 right in a row",
      },
      {
        id: "u11-intervals", type: "ear", title: "Four intervals", options: ["m3", "M3", "P4", "P5"], streak: 8,
        how: [
          "Minor 3rd: the start of a minor chord. Major 3rd: the start of a major one.",
          "4th: the opening of 'Here Comes the Bride'. 5th: a power chord, played one note at a time.",
          "Sing the two notes back before you answer.",
        ],
        gate: "8 right in a row",
      },
      {
        id: "u11-hook", type: "reps", title: "A hook by ear", streak: 1,
        how: [
          "Pick a vocal hook or synth line you love from Don Toliver, A$AP Rocky or Tyler, the Creator.",
          "Find it on one string first: start on any note and move up or down until it matches, one note at a time.",
          "Then move it into the pentatonic box if it fits.",
        ],
        gate: "Play a hook from memory",
        rateLabel: "Can you play it from memory?",
      },
    ],
  },

  // ───────────── Fretboard and harmony ─────────────
  {
    id: "u12", stage: "harmony", number: 12, title: "Notes on the neck",
    summary: "Know where every natural note sits on the two bass strings: the roots of every barre chord.",
    skills: [
      {
        id: "u12-e", type: "reps", check: "notes", title: "Low E string", streak: 3,
        notes: [[0, 0], [0, 1], [0, 3], [0, 5], [0, 7], [0, 8], [0, 10], [0, 12]],
        how: [
          "E, F, G, A, B, C, D, E: open string to the 12th fret.",
          "Only B to C and E to F are one fret apart; every other step is two.",
          "Say each name out loud as you play it.",
        ],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
      {
        id: "u12-a", type: "reps", check: "notes", title: "A string", streak: 3,
        notes: [[1, 0], [1, 2], [1, 3], [1, 5], [1, 7], [1, 8], [1, 10], [1, 12]],
        how: ["A, B, C, D, E, F, G, A. Same rule: B to C and E to F are one fret apart."],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
      {
        id: "u12-find", type: "reps", check: "notes", title: "Find the note", streak: 3, hideFrets: true,
        notes: [[0, 3], [1, 3], [0, 5], [1, 5], [0, 8], [1, 7], [0, 10], [1, 10]],
        how: [
          "Octave shows the note name and string, but not the fret. Find it.",
          "Count up from the nearest note you know: E and A are the open strings, and the 5th fret on the low E is A.",
        ],
        gate: "All eight found, 3 times in a row",
        rateLabel: "Found every note?",
      },
      {
        id: "u12-octaves", type: "reps", check: "notes", title: "Octave shapes", streak: 3,
        notes: [[0, 3], [2, 5], [0, 5], [2, 7], [1, 3], [3, 5], [1, 5], [3, 7]],
        how: [
          "The same note an octave up is two strings higher and two frets higher.",
          "Low E string 3rd fret (G) → D string 5th fret (G). Then the same from A and from the A string.",
        ],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
    ],
  },
  {
    id: "u13", stage: "harmony", number: 13, title: "Seventh chords",
    summary: "The four-note chords that jazz is built on, in open position first.",
    skills: [
      {
        id: "u13-e7-a7", type: "changes", title: "E7 ↔ A7 changes", pair: ["E7", "A7"], target: 30,
        how: [
          "E7 is E with the ring finger lifted. A7 is A with the middle of the three fingers lifted.",
          "Together they're the start of a blues.",
        ],
        gate: "30 clean changes in a minute",
      },
      chordReps({
        id: "u13-d7", title: "D7", chord: "D7",
        how: [
          "Index on the B string, 1st fret. Middle on the G string, 2nd fret. Ring on the high E string, 2nd fret.",
          "Strum from the open D string down.",
        ],
        gate: "4 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u13-cmaj7", title: "C major 7", chord: "Cmaj7",
        how: [
          "Your C chord with the index finger lifted, so the open B string rings.",
          "Major 7ths sound dreamy and unresolved.",
        ],
        gate: "5 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u13-am7", title: "A minor 7", chord: "Am7",
        how: ["Your A minor with the ring finger lifted, so the open G string rings."],
        gate: "5 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u13-ear", type: "ear", title: "Which 7th?", options: ["maj7", "dom7", "m7"], streak: 8,
        how: [
          "Major 7th: soft and dreamy. Dominant 7th: bluesy, wants to move. Minor 7th: dark and smooth.",
        ],
        gate: "8 right in a row",
      },
      ladder({
        id: "u13-251", title: "Your first ii–V–I", progression: ["Dm7", "G7", "Cmaj7", "Cmaj7"], pattern: P.quarters,
        how: [
          "Dm7, G7, Cmaj7: the ii–V–I in C, the most important progression in jazz.",
          "Open voicings for now; the jazz-sounding versions come in the Jazz stage.",
        ],
        gate: "16 bars with no stops at 90 BPM", bars: 16, startBpm: 60, targetBpm: 90,
      }),
    ],
  },
  {
    id: "u14", stage: "harmony", number: 14, title: "Soulful 7ths and 9ths",
    summary: "The lush chords on the soulful end of hip-hop and R&B.",
    skills: [
      chordReps({
        id: "u14-fmaj7", title: "F major 7", chord: "Fmaj7",
        how: ["Your small F with the index lifted off the high E string, so it rings open."],
        gate: "4 strings ring clean, 5 tries in a row",
      }),
      ladder({
        id: "u14-walk", title: "Neo-soul walk-down", progression: ["Fmaj7", "Em7", "Dm7", "Cmaj7"], pattern: P.sync,
        how: [
          "Fmaj7, Em7, Dm7, Cmaj7: a step down each bar.",
          "Syncopated groove with chucks on 2 and 4. Keep it light.",
        ],
        gate: "16 bars with no stops at 85 BPM", bars: 16, startBpm: 60, targetBpm: 85,
      }),
      chordReps({
        id: "u14-cmaj9", title: "C major 9", chord: "Cmaj9",
        how: [
          "Middle on the A string, 3rd fret. Index on the D string, 2nd fret.",
          "Pinky on the G string, 4th fret. Ring on the B string, 3rd fret. High E open.",
        ],
        gate: "5 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u14-em9", title: "E minor 9", chord: "Em9",
        how: ["Em7 with your little finger added on the high E string, 2nd fret."],
        gate: "All 6 strings ring clean, 5 tries in a row",
      }),
      ladder({
        id: "u14-lush", title: "Lush loop", progression: ["Cmaj9", "Cmaj9", "Em9", "Em9"], pattern: P.sixteenths,
        how: [
          "Two bars of each, light sixteenth-note strums.",
          "Let it breathe: try strumming only some of the sixteenths.",
        ],
        gate: "16 bars with no stops at 70 BPM", bars: 16, startBpm: 50, targetBpm: 70,
      }),
      {
        id: "u14-sample", type: "reps", title: "Find a loop by ear", streak: 1,
        how: [
          "Pick a track by Tyler, the Creator or Don Toliver built on a lush chord loop.",
          "Using your new 7ths and 9ths, find chords that fit, by ear.",
          "Start with the bass note, then try major 7, minor 7 and 9 shapes on it.",
        ],
        gate: "Find a loop that fits the track",
        rateLabel: "Found chords that fit?",
      },
    ],
  },

  // ───────────── Jazz ─────────────
  {
    id: "u15", stage: "jazz", number: 15, title: "Shell voicings",
    summary: "Root, 3rd and 7th: three-note chords that sound like jazz straight away.",
    skills: [
      chordReps({
        id: "u15-g7", title: "G7 shell", chord: "G7sh",
        how: [
          "Root on the low E string, 3rd fret. Then the D string 3rd fret (the 7th) and the G string 4th fret (the 3rd).",
          "Let the root finger lean on the A string to mute it; the fingertips mute the B and high E.",
          "Three notes is all a jazz guitarist needs behind a band.",
        ],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u15-g-family", type: "changes", title: "Gmaj7 ↔ G7", pair: ["Gmaj7sh", "G7sh"], target: 30,
        how: ["One finger moves: the 7th on the D string drops from the 4th fret to the 3rd."],
        gate: "30 clean changes in a minute",
      },
      chordReps({
        id: "u15-gm7", title: "Gm7 shell", chord: "Gm7sh",
        how: ["From G7, lower the 3rd on the G string by a fret. Now the 7th and 3rd sit side by side."],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u15-cmaj7", title: "Cmaj7 shell", chord: "Cmaj7sh",
        how: [
          "Root on the A string, 3rd fret. G string 4th fret (the 7th), B string 5th fret (the 3rd).",
          "Mute the low E with the tip of the root finger, and the D and high E with the others.",
        ],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      {
        id: "u15-c-family", type: "changes", title: "Cmaj7 ↔ C7", pair: ["Cmaj7sh", "C7sh"], target: 30,
        how: ["Same idea: the 7th on the G string drops one fret."],
        gate: "30 clean changes in a minute",
      },
      {
        id: "u15-c7-cm7", type: "changes", title: "C7 ↔ Cm7", pair: ["C7sh", "Cm7sh"], target: 30,
        how: ["Now the 3rd on the B string drops one fret: dominant becomes minor."],
        gate: "30 clean changes in a minute",
      },
    ],
  },
  {
    id: "u16", stage: "jazz", number: 16, title: "The ii–V–I",
    summary: "The progression at the heart of jazz, with shells, in two keys.",
    skills: [
      chordReps({
        id: "u16-dm7", title: "Dm7 shell", chord: "Dm7sh",
        how: ["Your Cm7 shell slid up two frets: root on the A string, 5th fret."],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      ladder({
        id: "u16-c", title: "ii–V–I in C", progression: ["Dm7sh", "G7sh", "Cmaj7sh", "Cmaj7sh"], pattern: P.quarters,
        how: [
          "Dm7 (A string, 5th fret) to G7 (low E, 3rd fret) to Cmaj7 (A string, 3rd fret).",
          "Notice how little the top two notes move. That smooth movement is the sound of jazz.",
        ],
        gate: "16 bars with no stops at 100 BPM", bars: 16, startBpm: 60, targetBpm: 100,
      }),
      chordReps({
        id: "u16-d7", title: "D7 shell", chord: "D7sh",
        how: ["Your C7 shell slid up two frets: root on the A string, 5th fret."],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      ladder({
        id: "u16-g", title: "ii–V–I in G", progression: ["Am7sh", "D7sh", "Gmaj7sh", "Gmaj7sh"], pattern: P.quarters,
        how: [
          "Am7 (low E, 5th fret) to D7 (A string, 5th fret) to Gmaj7 (low E, 3rd fret).",
          "Same shapes as in C, starting on the other string.",
        ],
        gate: "16 bars with no stops at 100 BPM", bars: 16, startBpm: 60, targetBpm: 100,
      }),
      ladder({
        id: "u16-both", title: "Both keys", pattern: P.quarters,
        progression: ["Dm7sh", "G7sh", "Cmaj7sh", "Cmaj7sh", "Am7sh", "D7sh", "Gmaj7sh", "Gmaj7sh"],
        how: ["The ii–V–I in C, then in G, back to back."],
        gate: "16 bars with no stops at 100 BPM", bars: 16, startBpm: 60, targetBpm: 100,
      }),
    ],
  },
  {
    id: "u17", stage: "jazz", number: 17, title: "Comping and the jazz blues",
    summary: "Swinging rhythm behind a 12-bar jazz blues in F, and soloing over it.",
    skills: [
      ladder({
        id: "u17-four", title: "Four to the bar", chord: "F7sh", pattern: P.quarters,
        how: [
          "Short, even down-strums on every beat, with a slight accent on 2 and 4.",
          "Release the fretting pressure right after each strum so the chord is short.",
          "This is how big-band guitarists kept time.",
        ],
        gate: "8 bars clean at 120 BPM", bars: 8, startBpm: 80, targetBpm: 120, step: 10,
      }),
      {
        id: "u17-f7-bb7", type: "changes", title: "F7 ↔ B♭7", pair: ["F7sh", "Bb7sh"], target: 30,
        how: ["F7 on the low E, 1st fret, to B♭7 on the A string, 1st fret: the I to IV of the blues."],
        gate: "30 clean changes in a minute",
      },
      ladder({
        id: "u17-charleston", title: "Charleston rhythm", chord: "Bb7sh", pattern: P.charleston,
        how: [
          "Two short hits per bar: on beat 1 and on the 'and' of 2.",
          "Rest for the rest of the bar. The space is what makes it swing.",
        ],
        gate: "8 bars clean at 110 BPM", bars: 8, startBpm: 70, targetBpm: 110, step: 10,
      }),
      ladder({
        id: "u17-blues", title: "Jazz blues in F", pattern: P.quarters,
        progression: ["F7sh", "Bb7sh", "F7sh", "F7sh", "Bb7sh", "Bb7sh", "F7sh", "D7sh", "Gm7sh", "C7sh", "F7sh", "C7sh"],
        how: [
          "Twelve bars, one chord each. Two times through per run.",
          "Bars 8 to 10 lead back home: D7 to Gm7 to C7, then F7.",
          "Comp four to the bar, or mix in the Charleston.",
        ],
        gate: "24 bars with no stops at 120 BPM", bars: 24, startBpm: 70, targetBpm: 120, step: 10,
      }),
      {
        id: "u17-f-box", type: "reps", check: "notes", title: "Same box, new key", notes: PENT_F, streak: 3,
        how: [
          "Your pentatonic box, slid down to the 1st fret: now it's F minor pentatonic.",
          "Over the F blues it gives the classic blues sound.",
        ],
        gate: "Every note right, 3 times in a row",
        rateLabel: "Every note right?",
      },
    ],
  },
  {
    id: "u18", stage: "jazz", number: 18, title: "Your first standard",
    summary: "Autumn Leaves: learn the changes with shells, comp them, then play the melody by ear.",
    skills: [
      chordReps({
        id: "u18-bbmaj7", title: "B♭maj7 shell", chord: "Bbmaj7sh",
        how: ["Your Cmaj7 shell slid down two frets: root on the A string, 1st fret."],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      chordReps({
        id: "u18-ebmaj7", title: "E♭maj7 shell", chord: "Ebmaj7sh",
        how: ["The same shape again, root on the A string, 6th fret."],
        gate: "3 strings ring clean, 5 tries in a row",
      }),
      ladder({
        id: "u18-changes", title: "The A section", pattern: P.quarters,
        progression: ["Cm7sh", "F7sh", "Bbmaj7sh", "Ebmaj7sh", "Am7b5sh", "D7sh", "Gm7sh", "Gm7sh"],
        how: [
          "Cm7, F7, B♭maj7, E♭maj7, Am7♭5, D7, Gm7: the first section of Autumn Leaves in G minor.",
          "A shell has no 5th, so Am7♭5 uses the same shape as Am7.",
          "Lead sheets often write Gm6 for the last chord; Gm7 is a fine stand-in. Check a lead sheet for the rest of the tune.",
        ],
        gate: "16 bars with no stops at 110 BPM", bars: 16, startBpm: 60, targetBpm: 110, step: 10,
      }),
      ladder({
        id: "u18-comp", title: "Comp the changes", pattern: P.charleston,
        progression: ["Cm7sh", "F7sh", "Bbmaj7sh", "Ebmaj7sh", "Am7b5sh", "D7sh", "Gm7sh", "Gm7sh"],
        how: [
          "The same changes, with the Charleston rhythm.",
          "Put a recording on and comp along quietly underneath it.",
        ],
        gate: "16 bars with no stops at 130 BPM", bars: 16, startBpm: 80, targetBpm: 130, step: 10,
      }),
      {
        id: "u18-head", type: "reps", title: "The melody by ear", streak: 1,
        how: [
          "Listen to a few versions of Autumn Leaves and pick one you like.",
          "Learn the melody one phrase at a time, by ear, starting on the B string.",
          "It moves mostly by step, so the pentatonic and note-name work will help you find it.",
        ],
        gate: "Play the A section melody from memory",
        rateLabel: "Can you play it from memory?",
      },
      {
        id: "u18-chord-melody", type: "reps", title: "Chord melody", streak: 1,
        how: [
          "Play the melody's first phrase on the B and high E strings, with a shell's root under each new chord.",
          "Melody on top, bass underneath: you're the whole band.",
        ],
        gate: "One phrase as chord melody",
        rateLabel: "Played the phrase with chords under it?",
      },
    ],
  },
];

// Chord ids a skill shows as diagrams, in order of first use.
export function skillChords(skill) {
  const ids = [skill.chord, ...(skill.pair || []), ...(skill.progression || [])].filter(Boolean);
  return ids.filter((c, i) => ids.indexOf(c) === i);
}

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

export function findUnit(id) {
  return UNITS.find((u) => u.id === id) || null;
}
