# Octave

A daily guitar practice path, from first chords to jazz, with hip-hop songs along the way. Built for one player, on a phone.

## What's in this version (build steps 1–2)

- **Unit 1, First chords:** six skills, each with instructions, chord diagrams and a gate to pass. Skills unlock in order.
- **Three kinds of drill:**
  - *Reps* (Setup, E minor, A minor): rate each try; pass after a run of clean tries in a row.
  - *Tempo ladder* (Steady down-strums, Anchor loop): a metronome run with a 1-bar count-in. Clean moves up 5 BPM, Sloppy repeats, Couldn't moves down 5. Clean at the target tempo passes.
  - *One-minute changes* (Em ↔ Am): 3-2-1 lead-in, 60 seconds, tap for each clean change. Last and best are kept.
- **Free metronome:** 40–200 BPM, 2, 3 or 4 beats per bar, accented beat 1.
- Minutes practised today and a day streak on the home screen.
- Keeps the screen awake during drills, and plays through the iPhone silent switch where Safari allows it.
- Installable to the iPhone home screen.

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
| Worker entry (serves the app) | `src/worker.js` |
| Cloudflare config | `wrangler.jsonc` |
| Tests | `test/` (run `npm test`) |

To add a unit, add it to `UNITS` in `public/lib/path.js`. Any new chord goes in `CHORDS` in the same file.

## Deploying

Same setup as Tenner: connect the `octave` Worker in Cloudflare to this repo, and every push to `main` deploys with `npx wrangler deploy`.

## Putting it on your iPhone

Open the site in Safari, tap **Share**, then **Add to Home Screen**.

## Build order

1. ~~Project skeleton and Unit 1~~
2. ~~Metronome with tempo ladder and one-minute changes timer~~
3. Daily session generator, self-rating and review boxes, cloud storage
4. Tuner (mic step 1)
5. Practice log, streak and Life Dashboard sync
6. Recorder and song play-along
7. Single-note and chord detection tests (mic steps 2–3)
8. Units 2 onward
