# Demo video pipeline

Reproducible 2-minute demo: the app records itself, synced to the voiceover.

1. `script.mjs` — scenes, voiceover text, on-screen call-outs (edit here).
2. `node --env-file=../../.env tts.mjs` — ElevenLabs voice per scene with character timestamps (skips scenes already in `voice/`; delete a clip to re-take it).
3. `node music.mjs 125` — synthesised ambient pad (royalty-free).
4. `node record.mjs` — drives `http://localhost:5173/?video` in headless Edge (GPU) and captures frames via the DevTools screencast. Needs `npm run dev:web` and `npm run dev:server`.
5. `node build.mjs` — 30 fps video, voice on the timeline, music ducked under the voice, word-synced subtitles and call-outs (ASS), fades → `polku-demo.mp4`.

Run steps 2–5 from a working folder with `npm i ffmpeg-static playwright-core`. Voice: ElevenLabs (free plan, attribution required).
