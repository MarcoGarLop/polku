// Assembles the final video: frames → 30 fps, voice clips placed on the timeline, music ducked under the voice,
// word-synced subtitles, big call-out numbers and the opening title (ASS), fade out. Output: polku-demo.mp4
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import { SCENES } from './script.mjs';

const { T0, end, frames } = JSON.parse(readFileSync('frames.json', 'utf8'));
const timeline = JSON.parse(readFileSync('timeline.json', 'utf8'));
const END = end;
const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

/* ---------- 1. frames → concat list with real timestamps ---------- */
let list = 'ffconcat version 1.0\n';
for (let i = 0; i < frames.length; i++) {
  const t = frames[i].t - T0;
  const tn = i + 1 < frames.length ? frames[i + 1].t - T0 : END;
  list += `file '${frames[i].file}'\nduration ${Math.max(0.001, tn - t).toFixed(4)}\n`;
}
list += `file '${frames.at(-1).file}'\n`;
writeFileSync('frames.txt', list);

/* ---------- 2. audio: voices on the timeline + ducked music ---------- */
const voiced = timeline.filter((s) => existsSync(`voice/${s.id}.mp3`));
const inputs = ['-i', 'music.wav', ...voiced.flatMap((s) => ['-i', `voice/${s.id}.mp3`])];
const delays = voiced.map((s, i) => `[${i + 1}:a]adelay=${Math.round(s.voiceAt * 1000)}|${Math.round(s.voiceAt * 1000)},volume=1.0[v${i}]`).join(';');
const mixVoices = `${voiced.map((_, i) => `[v${i}]`).join('')}amix=inputs=${voiced.length}:normalize=0,apad[vox]`;
const filter = [
  delays,
  mixVoices,
  // normalise the VOICE only (normalising the whole mix pumped the music up whenever nobody spoke)
  `[vox]loudnorm=I=-16:TP=-2:LRA=9,asplit=2[vox1][vox2]`,
  // music sits ~12 dB under the voice and ducks a further ~8 dB while she speaks
  `[0:a]atrim=0:${END.toFixed(2)},volume=0.42[mus]`,
  `[mus][vox1]sidechaincompress=threshold=0.015:ratio=8:attack=60:release=700:makeup=1[duck]`,
  `[duck][vox2]amix=inputs=2:normalize=0,atrim=0:${END.toFixed(2)},afade=t=out:st=${(END - 2).toFixed(2)}:d=2,alimiter=limit=0.89[out]`,
].join(';');
run([...inputs, '-filter_complex', filter, '-map', '[out]', '-ar', '48000', 'audio.wav']);
console.log('✓ audio.wav');

/* ---------- 3. subtitles (word-synced) + call-outs + title, as ASS ---------- */
const ts = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${sec}`;
};
const esc = (t) => t.replace(/\{/g, '(').replace(/\}/g, ')');

function chunks(id) {
  const a = JSON.parse(readFileSync(`voice/${id}.json`, 'utf8'));
  const chars = a.characters;
  // words with timings
  const words = [];
  let cur = null;
  chars.forEach((c, i) => {
    if (c === ' ') {
      if (cur) words.push(cur);
      cur = null;
      return;
    }
    if (!cur) cur = { w: '', s: a.character_start_times_seconds[i], e: 0 };
    cur.w += c;
    cur.e = a.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  // group into readable lines: break after punctuation, max ~52 characters
  const out = [];
  let line = [];
  const len = (ws) => ws.map((x) => x.w).join(' ').length;
  for (const w of words) {
    if (line.length && len([...line, w]) > 52) {
      out.push(line);
      line = [];
    }
    line.push(w);
    if (/[.,:;!?]$/.test(w.w) && len(line) > 22) {
      out.push(line);
      line = [];
    }
  }
  if (line.length) out.push(line);
  return out.map((ws) => ({ text: ws.map((x) => x.w).join(' '), s: ws[0].s, e: ws.at(-1).e }));
}

const C = { white: '&H00F7EDE6', teal: '&H00D4EA5E', rose: '&H008571FB', amber: '&H000B9EF5', violet: '&H00FDB5C4' };
const CALLOUT_COLOR = { s2: C.white, s3: C.rose, s4: C.amber, s6: C.violet, s8: C.rose };
let ev = '';
// opening title
ev += `Dialogue: 2,${ts(0.35)},${ts(4.0)},Title,,0,0,0,,{\\fad(600,450)}Do two patients with the same cancer\\Nhave an equal chance?\n`;
ev += `Dialogue: 2,${ts(0.9)},${ts(4.0)},TitleSub,,0,0,0,,{\\fad(500,450)}The question AstraZeneca asked`;
ev += '\n';
for (const s of timeline) {
  const scene = SCENES.find((x) => x.id === s.id);
  if (!scene?.say) continue;
  const lines = chunks(s.id);
  const centred = s.id === 's1' || s.id === 's9'; // no card on the left in these shots
  lines.forEach((l, i) => {
    const start = s.voiceAt + l.s;
    const stop = i + 1 < lines.length ? s.voiceAt + lines[i + 1].s - 0.02 : s.voiceAt + l.e + 0.35;
    ev += `Dialogue: 1,${ts(start)},${ts(stop)},Sub,,${centred ? 30 : 470},30,0,,${esc(l.text)}\n`;
  });
  if (scene.callout) {
    const at = s.voiceAt + scene.callout.at * s.voice;
    ev += `Dialogue: 3,${ts(at)},${ts(at + 3.4)},Callout,,0,0,0,,{\\fad(250,450)\\c${CALLOUT_COLOR[s.id] ?? C.white}}${esc(scene.callout.text)}{\\fs34\\c${C.white}}\\N${esc(scene.callout.sub)}\n`;
  }
}

const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI Semibold,44,&H00FFFFFF,&H00FFFFFF,&H40140B05,&H40140B05,0,0,0,0,100,100,0,0,3,14,0,2,470,30,138,1
Style: Callout,Segoe UI Black,96,&H00FFFFFF,&H00FFFFFF,&H30140B05,&H30140B05,0,0,0,0,100,100,0,0,3,22,0,9,0,64,118,1
Style: Title,Segoe UI Black,74,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,6,5,0,0,40,1
Style: TitleSub,Segoe UI Semibold,34,&H00D4EA5E,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,4,2,0,0,330,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev}`;
writeFileSync('subs.ass', ass);
console.log('✓ subs.ass');

/* ---------- 4. fonts (local copy so the filter path has no drive letter) ---------- */
mkdirSync('fonts', { recursive: true });
for (const f of ['seguisb.ttf', 'seguibl.ttf', 'segoeui.ttf']) {
  const src = `C:/Windows/Fonts/${f}`;
  if (existsSync(src)) copyFileSync(src, `fonts/${f}`);
}

/* ---------- 5. final encode ---------- */
run([
  '-f', 'concat', '-safe', '0', '-i', 'frames.txt',
  '-i', 'audio.wav',
  '-vf', `fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,subtitles=subs.ass:fontsdir=fonts,fade=t=in:st=0:d=0.6,fade=t=out:st=${(END - 1.6).toFixed(2)}:d=1.6`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k',
  '-t', END.toFixed(2),
  '-movflags', '+faststart',
  'polku-demo.mp4',
]);
console.log(`✓ polku-demo.mp4 (${END.toFixed(1)} s)`);
