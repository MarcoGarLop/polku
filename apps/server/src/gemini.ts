import { GoogleGenAI, type Content, type GenerateContentConfig, type GenerateContentResponse } from '@google/genai';
import { loadCorpus } from './context';
import { declarations } from './tools';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-4-argon';
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.8-flash';

export const SYSTEM = `You are Polku, an AI analyst that helps Finnish wellbeing services county planners and FICAN make lung cancer care faster and more equal.
Your audience is a non-technical county director with two minutes.

You have:
1. The full Finnish text of the National Cancer Strategy 2026–2035 and its Implementation Roadmap 2026–2031, with page markers [STRATEGY p.N] and [ROADMAP p.N].
2. Tools that run Polku's lung cancer pathway simulator on public aggregated data (THL Sotkanet, Statistics Finland, published studies).

Rules (non-negotiable):
- Never state a number unless it came from a tool result in this conversation or appears verbatim in the documents. Do not do your own arithmetic beyond rounding: never add, subtract or combine figures (e.g. do not sum two factors into one number); quote each figure exactly as a tool returned it.
- For any quantitative question, call tools first (usually 2–4 calls).
- Ground every recommendation in a concrete roadmap or strategy action and cite the page as [ROADMAP p.N] or [STRATEGY p.N]. Read the Finnish text to find the right page. If you cannot find one, say so.
- Be honest about confidence: county and patient-profile results are estimates; Finnish national pathway times are preliminary; the entry-route effect comes from Finnish lymphoma data and is applied to lung cancer as an assumption.
- Talk about days and % of patients treated within target. Never promise survival gains.
- Answer in the user's language (default English). Max 130 words. Short paragraphs or 2–4 bullets. Bold the single most important number.
- When it helps, call ui_command so the on-screen map shows the county you are discussing.
- The UI shows two fictional patients with the same lung cancer, Matti A and Matti B; their current profiles are given in the UI context.
- This is decision support for planners, not a medical device.`;

let ai: GoogleGenAI | null = null;
export function client(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing in .env');
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

/**
 * The whole strategy + roadmap (~150k tokens) goes into the system instruction of every call.
 * Gemini's implicit prefix caching then serves ~98% of it from cache (measured: 26 s cold → ~7 s warm).
 * The prefix (system instruction + tools) must stay byte-identical between calls for the cache to hit.
 */
let fullSystem: string | null = null;
const systemWithCorpus = () => (fullSystem ??= `${SYSTEM}\n\n${loadCorpus().full}`);
const TOOLS = [{ functionDeclarations: declarations }];

export const cacheState: { status: 'cold' | 'warming' | 'warm' | 'failed'; tokens: number | null; cachedTokens: number | null; error?: string } = {
  status: 'cold',
  tokens: null,
  cachedTokens: null,
};

/** Prime the implicit cache at startup so the first question in the demo is already fast. */
export async function warmUp(): Promise<void> {
  cacheState.status = 'warming';
  const t0 = Date.now();
  try {
    for (const model of [MODEL, FALLBACK_MODEL]) {
      const res = await client().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'Reply with: ready' }] }],
        config: { systemInstruction: systemWithCorpus(), tools: TOOLS, temperature: 0.2 },
      });
      if (model === MODEL) {
        cacheState.tokens = res.usageMetadata?.promptTokenCount ?? null;
        cacheState.cachedTokens = res.usageMetadata?.cachedContentTokenCount ?? null;
      }
    }
    cacheState.status = 'warm';
    console.log(`✓ Gemini warm: ${cacheState.tokens ?? '?'} prompt tokens (strategy + roadmap) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e: any) {
    cacheState.status = 'failed';
    cacheState.error = String(e?.message).slice(0, 300);
    console.warn(`! warm-up failed: ${cacheState.error}`);
  }
}

/** One model turn with the full corpus. Falls back to the faster model if the main one fails. */
export async function generate(
  contents: Content[],
  opts: { useFallback?: boolean; extra?: GenerateContentConfig } = {},
): Promise<{ res: GenerateContentResponse; model: string; mode: 'full-context' }> {
  const models = opts.useFallback ? [FALLBACK_MODEL] : [MODEL, FALLBACK_MODEL];
  let lastErr: unknown;
  for (const model of models) {
    try {
      const res = await client().models.generateContent({
        model,
        contents,
        config: { systemInstruction: systemWithCorpus(), tools: TOOLS, temperature: 0.2, ...opts.extra },
      });
      return { res, model, mode: 'full-context' };
    } catch (e: any) {
      lastErr = e;
      console.warn(`! ${model} failed: ${String(e?.message).slice(0, 200)}`);
    }
  }
  throw lastErr;
}
