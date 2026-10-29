// Draws a chord box as an SVG string: strings run top to bottom, low E on the left.

const W = 132;
const H = 172;
const LEFT = 22;
const GAP = 17.6; // between strings
const NUT = 34;
const FRET = 28; // between frets
const FRETS = 4;
const NAMES = ["E", "A", "D", "G", "B", "E"];

export function chordSvg(chord, label = "") {
  const x = (i) => LEFT + i * GAP;
  const parts = [];
  parts.push(`<rect x="${x(0)}" y="${NUT - 3}" width="${x(5) - x(0)}" height="5" rx="1" class="nut"/>`);
  for (let f = 1; f <= FRETS; f++) {
    const y = NUT + f * FRET;
    parts.push(`<line x1="${x(0)}" x2="${x(5)}" y1="${y}" y2="${y}" class="fret"/>`);
  }
  for (let i = 0; i < 6; i++) {
    parts.push(`<line x1="${x(i)}" x2="${x(i)}" y1="${NUT}" y2="${NUT + FRETS * FRET}" class="string"/>`);
    parts.push(`<text x="${x(i)}" y="${NUT + FRETS * FRET + 20}" class="sname">${NAMES[i]}</text>`);
    const fret = chord.frets[i];
    if (fret < 0) {
      parts.push(`<text x="${x(i)}" y="${NUT - 11}" class="mute">×</text>`);
    } else if (fret === 0) {
      parts.push(`<circle cx="${x(i)}" cy="${NUT - 15}" r="4.6" class="open"/>`);
    } else {
      const cy = NUT + (fret - 0.5) * FRET;
      parts.push(`<circle cx="${x(i)}" cy="${cy}" r="8" class="dot"/>`);
      const finger = chord.fingers?.[i];
      if (finger) parts.push(`<text x="${x(i)}" y="${cy + 4.2}" class="finger">${finger}</text>`);
    }
  }
  const title = label || chord.name;
  return `<svg class="chord" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} chord shape">${parts.join("")}</svg>`;
}
