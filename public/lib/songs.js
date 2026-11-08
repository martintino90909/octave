// The songbook: acoustic songs to play along with, outside the path.
// Chords are ids in CHORDS (path.js); each section is played one chord per bar.
// Tempos are approximate: nudge them to the record. Charts follow common
// guitar arrangements, so check them against the record by ear.
//
// Fields:
//   capo     — fret the capo goes on (shapes are named as you finger them).
//   tuning   — semitone offsets from standard, low E to high E, plus a name.
//   after    — the path unit that teaches what the song needs.
//   bpm      — the record's tempo (roughly); the play-along ladders up to it.
//   pattern  — strum or picking tokens (see TOKEN_RE in demo.js).

const STD = null;

export const SONGS = [
  {
    id: "yellow", title: "Yellow", artist: "Coldplay", capo: 4, after: "u3",
    bpm: 87, beatsPerBar: 4, pattern: "D D D D D D D D",
    how: [
      "Capo on the 4th fret. Steady down-strums, letting the chords ring.",
      "Keep your ring and little fingers planted on the B and high E strings at the 3rd fret through G, D and Cadd9 if you can: it's the song's shimmer.",
    ],
    sections: [
      { id: "verse", name: "Verse", progression: ["G", "D", "Cadd9", "G"] },
      { id: "chorus", name: "Chorus", progression: ["Cadd9", "Em", "D"] },
    ],
  },
  {
    id: "wonderwall", title: "Wonderwall", artist: "Oasis", capo: 2, after: "u3",
    bpm: 87, beatsPerBar: 4, pattern: "D - D U - U D U D - D U - U D U",
    how: [
      "Capo on the 2nd fret. Ring and little fingers stay on the 3rd fret of the B and high E strings for every chord.",
      "Only the first two fingers move, so the changes are tiny.",
    ],
    sections: [
      { id: "verse", name: "Verse", progression: ["Em7ww", "Gww", "Dsus4", "A7sus4"] },
      { id: "pre", name: "Pre-chorus", progression: ["Cadd9", "Dsus4", "Em7ww", "Em7ww"] },
      { id: "chorus", name: "Chorus", progression: ["Cadd9", "Em7ww", "Gww", "Em7ww"] },
    ],
  },
  {
    id: "knockin", title: "Knockin' on Heaven's Door", artist: "Bob Dylan", after: "u2",
    bpm: 69, beatsPerBar: 4, pattern: "D - D U - U D U",
    how: ["Two four-bar phrases that only differ in the last chord: Am the first time, C the second."],
    sections: [{ id: "main", name: "Verse and chorus", progression: ["G", "D", "Am", "Am", "G", "D", "C", "C"] }],
  },
  {
    id: "standbyme", title: "Stand By Me", artist: "Ben E. King", capo: 2, after: "u2",
    bpm: 118, beatsPerBar: 4, pattern: "D - D U - U D U",
    how: ["Capo 2 puts you in the record's key. The same four-chord loop runs through the whole song."],
    sections: [{ id: "main", name: "The loop", progression: ["G", "G", "Em", "Em", "C", "D", "G", "G"] }],
  },
  {
    id: "horse", title: "A Horse with No Name", artist: "America", after: "u2",
    bpm: 122, beatsPerBar: 4, pattern: "D - D U - U D U",
    how: [
      "Two shapes for the whole song. For the second one, your index finger moves from the A string to the low E string, 2nd fret.",
      "Let the open strings ring and keep the strum light and driving.",
    ],
    sections: [{ id: "main", name: "The two-chord loop", progression: ["Em", "D69", "Em", "D69"] }],
  },
  {
    id: "wywh", title: "Wish You Were Here", artist: "Pink Floyd", after: "u4",
    bpm: 61, beatsPerBar: 4, pattern: "D - D U - U D U",
    how: [
      "D/F♯: thumb or index on the low E string at the 2nd fret, under a normal D shape.",
      "The intro riff is picked over Em7 and G; start with the verse chords.",
    ],
    sections: [{ id: "verse", name: "Verse", progression: ["C", "DF2", "Am", "Gww", "DF2", "C", "Am", "Gww"] }],
  },
  {
    id: "hallelujah", title: "Hallelujah", artist: "Leonard Cohen", after: "u4",
    bpm: 56, beatsPerBar: 2, pattern: "D - D U D U",
    how: [
      "It's in 6/8: count six quick beats per bar, with the click on 1 and 4.",
      "Plenty of versions use a capo (Jeff Buckley's is higher); this is Leonard Cohen's key, no capo.",
    ],
    sections: [
      { id: "verse", name: "Verse", progression: ["C", "Am", "C", "Am", "F", "G", "C", "G"] },
      { id: "chorus", name: "Chorus", progression: ["F", "Am", "F", "C", "G", "C", "G", "C"] },
    ],
  },
  {
    id: "exitmusic", title: "Exit Music (For a Film)", artist: "Radiohead", capo: 2, after: "u4",
    bpm: 64, beatsPerBar: 4, pattern: "T 3 2 1 T 3 2 3",
    how: [
      "Capo on the 2nd fret. The shapes are named as you finger them; the record sounds a whole step higher (B minor).",
      "Fingerpick: thumb on the bass note, then G, B and high E strings with your fingers.",
      "The verse ends on Asus4 to A: just lift and drop your little finger on the B string.",
    ],
    sections: [
      { id: "intro", name: "Intro", progression: ["Am", "Asus2", "Asus4", "Am"] },
      { id: "verse", name: "Verse", progression: ["Am", "E", "CG", "DF", "Am", "E", "Asus4", "A"] },
    ],
  },
  {
    id: "iris", title: "Iris", artist: "Goo Goo Dolls", after: "u7",
    bpm: 78, beatsPerBar: 3, pattern: "D - D U D U",
    how: [
      "The record is in an unusual open tuning; this is the standard-tuning version most people play.",
      "Bm7 is a barre at the 2nd fret from the A string down. Asus4 to G is the change to drill.",
    ],
    sections: [
      { id: "verse", name: "Verse", progression: ["D", "Em7", "G", "Bm7", "Asus4", "G"] },
      { id: "chorus", name: "Chorus", progression: ["Bm7", "Asus4", "G"] },
    ],
  },
  {
    id: "need2", title: "Need 2", artist: "Pinegrove", after: "u8",
    tuning: { offsets: [0, 0, 0, 0, 0, -1], name: "High E down a half step (D♯)" },
    bpm: 130, beatsPerBar: 4, pattern: "D U D U D U D U",
    how: [
      "Tune your high E string down a half step to D♯ (use the tuner: aim for D♯4).",
      "Four bars of E, four of A. The A is played at the 5th fret with the top two strings open; the retuned string makes it shimmer.",
    ],
    sections: [{ id: "main", name: "Verse loop", progression: ["E", "E", "E", "E", "A5fr", "A5fr", "A5fr", "A5fr"] }],
  },
  {
    id: "sparks", title: "Sparks", artist: "Coldplay", capo: 6, after: "u13",
    tuning: { offsets: [0, 0, 0, 0, 0, -2], name: "High E down a whole step (D)" },
    bpm: 52, beatsPerBar: 4, pattern: "T 3 2 1 T 3 2 1",
    how: [
      "Tune your high E string down to D, then capo on the 6th fret.",
      "Most shapes only use the A and D strings, with the top three strings left open. Fingerpick softly.",
      "The bridge walks a single note down the A string under open strings.",
    ],
    sections: [
      { id: "verse", name: "Verse", progression: ["spGmaj7", "spEm7", "spGmaj7", "spEm7", "spAm", "spGmaj7", "spG", "spGmaj7"] },
      { id: "bridge", name: "Bridge", progression: ["spEm7o", "spEmM9", "spEm7", "spG9", "spDbdim", "spCmaj9"] },
    ],
  },
];

export const findSong = (id) => SONGS.find((s) => s.id === id) || null;

export function songChords(song) {
  const ids = song.sections.flatMap((s) => s.progression);
  return ids.filter((c, i) => ids.indexOf(c) === i);
}

// A song section as a tempo-ladder drill, so it reuses the ladder screen and
// progress rules. One run plays the section until at least 8 bars have passed.
export function sectionSkill(song, section) {
  const target = Math.round(song.bpm);
  const start = Math.max(40, Math.floor((target * 0.65) / 5) * 5);
  const n = section.progression.length;
  return {
    id: `song-${song.id}-${section.id}`,
    type: "ladder",
    title: `${song.title}: ${section.name}`,
    progression: section.progression,
    pattern: section.pattern || song.pattern,
    beatsPerBar: song.beatsPerBar,
    bars: Math.ceil(8 / n) * n,
    startBpm: Math.min(start, target),
    targetBpm: target,
    step: 5,
    capo: song.capo || 0,
    tuning: song.tuning?.offsets || STD,
  };
}

export const listenUrl = (song) => `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`;
