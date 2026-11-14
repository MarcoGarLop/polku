/** Deterministic PRNG (mulberry32). Never use Math.random in the engine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const normalCache = new Map<string, Float64Array>();

/**
 * n × cols standard normal draws, cached per (n, cols, seed).
 * Reusing the same draws for baseline and scenario (common random numbers)
 * makes "days saved" stable and noise-free.
 */
export function standardNormals(n: number, cols: number, seed: number): Float64Array {
  const key = `${n}:${cols}:${seed}`;
  const hit = normalCache.get(key);
  if (hit) return hit;
  const rand = mulberry32(seed);
  const out = new Float64Array(n * cols);
  for (let i = 0; i < out.length; i += 2) {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    out[i] = r * Math.cos(2 * Math.PI * u2);
    if (i + 1 < out.length) out[i + 1] = r * Math.sin(2 * Math.PI * u2);
  }
  normalCache.set(key, out);
  return out;
}

const uniformCache = new Map<string, Float64Array>();

export function uniforms(n: number, cols: number, seed: number): Float64Array {
  const key = `${n}:${cols}:${seed}`;
  const hit = uniformCache.get(key);
  if (hit) return hit;
  const rand = mulberry32(seed);
  const out = new Float64Array(n * cols);
  for (let i = 0; i < out.length; i++) out[i] = rand();
  uniformCache.set(key, out);
  return out;
}

export function percentile(sorted: Float64Array, q: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx];
}
