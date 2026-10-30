// Draws a chord box as an SVG string: strings run top to bottom, low E on the left.
// Shapes higher up the neck are drawn from their lowest fret, with the fret
// number beside the first row; a barre is drawn as one bar across its strings.

const LEFT = 30;
const GAP = 17.6; // between strings
const W = LEFT + 5 * GAP + 22;
const NUT = 34;
const FRET = 28; // between frets
const FRETS = 4;
const H = NUT + FRETS * FRET + 26;
const NAMES = ["E", "A", "D", "G", "B", "E"];

// The first fret the box shows: 1 when the shape fits next to the nut.
export function baseFret(chord) {
  const fretted = chord.frets.filter((f) => f > 0);
  if (!fretted.length || Math.max(...fretted) <= FRETS) return 1;
  return Math.min(...fretted);
}

export function chordSvg(chord, label = "") {
  const x = (i) => LEFT + i * GAP;
  const base = baseFret(chord);
  const row = (fret) => NUT + (fret - base + 0.5) * FRET;
  const parts = [];
  if (base === 1) {
    parts.push(`<rect x="${x(0)}" y="${NUT - 3}" width="${x(5) - x(0)}" height="5" rx="1" class="nut"/>`);
  } else {
    parts.push(`<line x1="${x(0)}" x2="${x(5)}" y1="${NUT}" y2="${NUT}" class="fret"/>`);
    parts.push(`<text x="${x(0) - 13}" y="${row(base) + 4}" class="basefret">${base}fr</text>`);
  }
  for (let f = 1; f <= FRETS; f++) {
    const y = NUT + f * FRET;
    parts.push(`<line x1="${x(0)}" x2="${x(5)}" y1="${y}" y2="${y}" class="fret"/>`);
  }
  const barre = chord.barre;
  if (barre) {
    const cy = row(barre.fret);
    parts.push(`<rect x="${x(barre.from) - 8}" y="${cy - 8}" width="${x(barre.to) - x(barre.from) + 16}" height="16" rx="8" class="dot"/>`);
    parts.push(`<text x="${(x(barre.from) + x(barre.to)) / 2}" y="${cy + 4.2}" class="finger">1</text>`);
  }
  for (let i = 0; i < 6; i++) {
    parts.push(`<line x1="${x(i)}" x2="${x(i)}" y1="${NUT}" y2="${NUT + FRETS * FRET}" class="string"/>`);
    parts.push(`<text x="${x(i)}" y="${NUT + FRETS * FRET + 20}" class="sname">${NAMES[i]}</text>`);
    const fret = chord.frets[i];
    const underBarre = barre && fret === barre.fret && i >= barre.from && i <= barre.to;
    if (fret < 0) {
      parts.push(`<text x="${x(i)}" y="${NUT - 11}" class="mute">×</text>`);
    } else if (fret === 0) {
      parts.push(`<circle cx="${x(i)}" cy="${NUT - 15}" r="4.6" class="open"/>`);
    } else if (!underBarre) {
      const cy = row(fret);
      parts.push(`<circle cx="${x(i)}" cy="${cy}" r="8" class="dot"/>`);
      const finger = chord.fingers?.[i];
      if (finger) parts.push(`<text x="${x(i)}" y="${cy + 4.2}" class="finger">${finger}</text>`);
    }
  }
  const title = label || chord.name;
  return `<svg class="chord" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} chord shape">${parts.join("")}</svg>`;
}
