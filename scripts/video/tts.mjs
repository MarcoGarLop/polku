// Generates one voice clip per scene with ElevenLabs (with per-character timestamps for subtitles).
// Skips scenes already generated, so retakes only spend quota on the scene you delete.
// Run: node --env-file=<repo>/.env tts.mjs
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { SCENES, VOICE_ID } from './script.mjs';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('ELEVENLABS_API_KEY missing');
mkdirSync('voice', { recursive: true });

const total = SCENES.reduce((s, x) => s + x.say.length, 0);
console.log(`script: ${total} characters`);

for (const s of SCENES) {
  if (!s.say) continue;
  if (existsSync(`voice/${s.id}.mp3`)) {
    console.log(`= ${s.id} (cached)`);
    continue;
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: s.say,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 1.0 },
    }),
  });
  if (!res.ok) throw new Error(`${s.id}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  writeFileSync(`voice/${s.id}.mp3`, Buffer.from(j.audio_base64, 'base64'));
  writeFileSync(`voice/${s.id}.json`, JSON.stringify(j.alignment));
  const end = j.alignment.character_end_times_seconds.at(-1);
  console.log(`✓ ${s.id} ${end.toFixed(2)} s`);
}
const sub = await (await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } })).json();
console.log(`quota used ${sub.character_count}/${sub.character_limit}`);
