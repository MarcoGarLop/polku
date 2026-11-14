// Checks that GEMINI_API_KEY in .env works and lists the Gemini models this account can use.
// Run: npm run check:gemini   (loads .env via `node --env-file`). Never prints the key itself.
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL;
const API = 'https://generativelanguage.googleapis.com/v1beta';

if (!KEY) {
  console.error('✗ GEMINI_API_KEY is empty. Paste your key into .env (never into the code or chat).');
  process.exit(1);
}
console.log(`Key loaded (…${KEY.slice(-4)}).`);

const headers = { 'x-goog-api-key': KEY, 'content-type': 'application/json' };

const list = await fetch(`${API}/models?pageSize=200`, { headers });
if (!list.ok) {
  console.error(`✗ Listing models failed: HTTP ${list.status} — ${(await list.text()).slice(0, 300)}`);
  process.exit(1);
}
const { models = [] } = await list.json();
const usable = models
  .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'))
  .map((m) => `${m.name.replace('models/', '')}  (input ${m.inputTokenLimit ?? '?'} tokens)`);
console.log(`✓ Key works. ${usable.length} Gemini models with generateContent:`);
for (const line of usable) console.log('  - ' + line);

if (!MODEL) {
  console.log('\nSet GEMINI_MODEL in .env to one of the models above, then run this again to test it.');
  process.exit(0);
}

const res = await fetch(`${API}/models/${MODEL}:generateContent`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly: Polku ready' }] }] }),
});
if (!res.ok) {
  console.error(`✗ ${MODEL} failed: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
  console.error('  429 = spend cap reached (aistudio.google.com/spend) · 503 = model overloaded (retry or use another model).');
  process.exit(1);
}
const data = await res.json();
console.log(`✓ ${MODEL} answered: ${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}`);
