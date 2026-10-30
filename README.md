# Octave

A daily guitar practice path, from first chords to jazz, with hip-hop songs along the way. Built for one player, on a phone.

## What's in this version

**The whole path: 18 units, 97 skills, in five stages.** Units open in order; finish every gate in one to open the next.

| Stage | Units |
| --- | --- |
| Foundation | 1 First chords · 2 C, G and D · 3 Down-ups and four chords · 4 E85 |
| Rhythm | 5 Power chords and Tore Up · 6 Groove · 7 Barre chords · 8 Moving shapes |
| Lead and ear | 9 Minor pentatonic · 10 Bends, slides and legato · 11 Ear training |
| Fretboard and harmony | 12 Notes on the neck · 13 Seventh chords · 14 Soulful 7ths and 9ths |
| Jazz | 15 Shell voicings · 16 The ii–V–I · 17 Comping and the jazz blues · 18 Your first standard |

Drill types:

- *Chord check (mic):* hold the shape, pluck each string; Octave names any string that's dead or wrong.
- *Note check (mic):* scales, licks, fretboard drills, hammer-ons, pull-offs, slides and bends, checked note by note.
- *Tempo ladder:* a metronome run with a 1-bar count-in. Progressions show the chord to play now and next; strum patterns light up beat by beat. Clean moves up, Sloppy repeats, Couldn't moves down.
- *One-minute changes:* tap for every clean change between two chords.
- *Ear training:* intervals, major or minor, and which kind of 7th, played by Octave.
- *Self-rated:* the few things a phone can't judge (vibrato, playing along with a record, learning a hook by ear).

Also: tuner, free metronome, minutes practised today and a day streak. Installable to the iPhone home screen.

Progress is saved on the phone for now. Cloud storage (Octave's own, behind a passcode) arrives with build step 3.

## How it's built

| Part | Where |
| --- | --- |
| Phone app (HTML, CSS, JS, no build step) | `public/` |
| The learning path as data: stages, units, skills, chord shapes | `public/lib/path.js` |
| Progress rules: gates, tempo ladder, streaks, minutes | `public/lib/progress.js` |
| Saving progress | `public/lib/store.js` |
| Metronome and audio | `public/lib/metronome.js` |
| Chord diagrams | `public/lib/chord.js` |
| Pitch detection (YIN) and note helpers | `public/lib/pitch.js` |
| Tuning, chord-check and note-check rules | `public/lib/tunecheck.js` |
| Mic input | `public/lib/listen.js` |
| Tuner, chord-check and note-check screens | `public/micui.js` |
| Ear-training questions and sounds | `public/lib/ear.js` |
| Worker entry (serves the app) | `src/worker.js` |
| Cloudflare config | `wrangler.jsonc` |
| Tests | `test/` (run `npm test`); mic logic is tested on simulated plucked strings |

To add a unit, add it to `UNITS` in `public/lib/path.js`. Any new chord goes in `CHORDS` in the same file.

## Deploying

Same setup as Tenner: connect the `octave` Worker in Cloudflare to this repo, and every push to `main` deploys with `npx wrangler deploy`.

## Putting it on your iPhone

Open the site in Safari, tap **Share**, then **Add to Home Screen**.

## Build order

1. ~~Project skeleton and Unit 1~~
2. ~~Metronome with tempo ladder and one-minute changes timer~~
3. Daily session generator, self-rating and review boxes, cloud storage
4. ~~Tuner (mic step 1)~~ and ~~string-by-string chord check (mic step 2)~~
5. Practice log, streak and Life Dashboard sync
6. Recorder and song play-along
7. Strummed-chord detection test (mic step 3)
8. ~~Units 2 onward~~ (all 18 written)
