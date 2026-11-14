// Generates a soft ambient pad (royalty-free, synthesised) with ffmpeg.
// Two overlapping voices swell in and out on a slow Am – F – C – G progression, low-passed with a long reverb.
// Run: node music.mjs <seconds>
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const DUR = Number(process.argv[2] ?? 120);
const hz = (midi) => +(440 * 2 ** ((midi - 69) / 12)).toFixed(3);
// A2 E3 A3 C4 E4 · F2 C3 F3 A3 C4 · C3 G3 C4 E4 G4 · G2 D3 G3 B3 D4
const CHORDS = [
  [45, 52, 57, 60, 64],
  [41, 48, 53, 57, 60],
  [48, 55, 60, 64, 67],
  [43, 50, 55, 59, 62],
].map((c) => c.map(hz));
const LEN = 8; // seconds per chord

// note i of the chord active at time (t + off)
const note = (i, off) => {
  const k = `mod(floor((t+${off})/${LEN}),4)`;
  return `if(eq(${k},0),${CHORDS[0][i]},if(eq(${k},1),${CHORDS[1][i]},if(eq(${k},2),${CHORDS[2][i]},${CHORDS[3][i]})))`;
};
const voice = (off) => {
  const env = `pow(sin(PI*mod(t+${off},${LEN})/${LEN}),1.6)`; // swell in and out within each chord
  const tones = [0, 1, 2, 3, 4]
    .map((i) => {
      const f = note(i, off);
      const amp = [0.34, 0.22, 0.2, 0.15, 0.1][i];
      return `${amp}*(sin(2*PI*(${f})*t)+0.5*sin(2*PI*(${f})*1.004*t))`;
    })
    .join('+');
  return `(${env})*(${tones})`;
};
const expr = `0.18*(${voice(0)}+${voice(LEN / 2)})`;

execFileSync(
  ffmpeg,
  [
    '-y',
    '-f', 'lavfi',
    '-i', `aevalsrc=exprs='${expr}|${expr}':s=44100:d=${DUR}`,
    '-af',
    [
      'lowpass=f=1400',
      'highpass=f=60',
      'aecho=0.8:0.88:80|160|320|640:0.32|0.24|0.16|0.1',
      'stereotools=mlev=1:slev=1.3',
      `afade=t=in:st=0:d=4`,
      `afade=t=out:st=${DUR - 6}:d=6`,
      'loudnorm=I=-24:TP=-3',
    ].join(','),
    '-ar', '44100',
    'music.wav',
  ],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);
console.log(`✓ music.wav (${DUR} s)`);
