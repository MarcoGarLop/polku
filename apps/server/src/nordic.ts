import { Type } from '@google/genai';
import { type AiEstimate } from '@polku/sim';
import { loadCorpus } from './context';
import { ESTIMATION_RULES, estimateSchema, evidenceDigest, geminiJson, sanitize } from './estimate';

/** Nordic practices a Finnish county can learn from. */
export const PRACTICES = [
  { id: 'dk_cpp', country: 'Denmark', name: 'Cancer patient pathways', what: "Denmark's cancer patient pathways (2008–2009): standard criteria for GPs to refer suspected cancer, pre-booked diagnostic slots and maximum times for each step." },
  { id: 'no_pakkeforlop', country: 'Norway', name: 'Cancer patient pathways (pakkeforløp)', what: "Norway's cancer patient pathways (pakkeforløp, 2015): standard maximum times from referral to treatment (lung cancer: 42 days for surgery or radiotherapy), a 70% target and named coordinators." },
  { id: 'se_svf', country: 'Sweden', name: 'Standardised care pathways (SVF)', what: "Sweden's standardised care pathways (SVF, 2015): a pathway starts at 'well-founded suspicion' of cancer with lead-time targets (lung cancer: 40 days for drug treatment, 44 for surgery or radiotherapy) and an 80% target." },
  { id: 'dk_direct_ct', country: 'Denmark', name: 'Direct CT access for GPs', what: "Denmark's direct access for GPs to low-dose CT scans for suspected lung cancer, without a specialist referral (tested in a cluster-randomised trial in Aarhus)." },
] as const;

export interface NordicResult {
  practiceId: string;
  country: string;
  name: string;
  whatTheyDid: string;
  resultsThere: string[];
  whyDifferent: string;
  estimate: AiEstimate;
  /** Numbers in "resultsThere" that could not be found in the evidence notes or documents. */
  unverified: string[];
  model: string;
  ms: number;
}

const schema = {
  type: Type.OBJECT,
  properties: {
    whatTheyDid: { type: Type.STRING, description: 'Plain English, max 35 words' },
    resultsThere: { type: Type.ARRAY, items: { type: Type.STRING }, description: '2–3 short bullets: what it achieved in that country. Only numbers that appear in the evidence notes. If no measured result exists, say so.' },
    whyDifferent: { type: Type.STRING, description: 'Max 55 words: why the effect in Finland would be larger or smaller, given where Finland loses its days' },
    estimate: estimateSchema,
  },
  required: ['whatTheyDid', 'resultsThere', 'whyDifferent', 'estimate'],
};

/** Every number quoted about the other country must exist in the evidence notes or the strategy/roadmap text. */
function checkNumbers(lines: string[]): string[] {
  const haystack = evidenceDigest() + '\n' + loadCorpus().full;
  const nums = lines.join(' ').match(/\d+(?:[.,]\d+)?/g) ?? [];
  return Array.from(new Set(nums.filter((n) => Number(n.replace(',', '.')) > 10 && !new RegExp(`(^|[^\\d])${n.replace('.', '[.,]')}([^\\d]|$)`).test(haystack))));
}

export async function compareNordic(practiceId: string): Promise<NordicResult> {
  const p = PRACTICES.find((x) => x.id === practiceId);
  if (!p) throw new Error('unknown practice');
  const id = `nordic_${p.id}`;
  const prompt = `A Finnish wellbeing services county wants to learn from another Nordic country:
${p.what}

1. In whatTheyDid, describe the practice in plain words.
2. In resultsThere, say what THIS practice achieved in ${p.country} (not other practices or other countries), using only numbers from the evidence notes (studies S06, S07, S14, S17, S24…). If the evidence shows weak or no effect, say so.
3. In whyDifferent, explain why the effect in Finland's lung cancer pathway would differ, given that most Finnish delay happens before referral (patient and primary care), distances are long, and the public route is slower than occupational care.
4. In estimate, give the effect if Finland adopted it (phases, for whom, pessimistic/best/optimistic, confidence), with the closest Finnish roadmap action and page. Use id "${id}" and label "${p.country}: ${p.name}".
${ESTIMATION_RULES}`;
  const { data, model, ms } = await geminiJson<{ whatTheyDid: string; resultsThere: string[]; whyDifferent: string; estimate: AiEstimate }>(prompt, schema);
  const estimate = sanitize({ ...data.estimate, id, label: `${p.country}: ${p.name}` });
  return {
    practiceId: p.id,
    country: p.country,
    name: p.name,
    whatTheyDid: data.whatTheyDid,
    resultsThere: data.resultsThere ?? [],
    whyDifferent: data.whyDifferent,
    estimate,
    unverified: checkNumbers(data.resultsThere ?? []),
    model,
    ms,
  };
}
