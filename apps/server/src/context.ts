import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SOURCE = join(ROOT, 'docs', 'fuentes', 'estrategia_y_hoja_de_ruta_texto_completo.md');

export interface Corpus {
  /** Full text with [STRATEGY p.N] / [ROADMAP p.N] page markers (sections 3.1 + 3.2 only). */
  full: string;
  pages: { doc: 'STRATEGY' | 'ROADMAP'; page: number; text: string }[];
}

let cached: Corpus | null = null;

/**
 * Loads the National Cancer Strategy 2026–2035 and its Implementation Roadmap 2026–2031 (Finnish full text).
 * Sections 1 and 4 of the source file are unrelated (written by another tool) and are deliberately excluded.
 */
export function loadCorpus(): Corpus {
  if (cached) return cached;
  const lines = readFileSync(SOURCE, 'utf8').split(/\r?\n/);
  const start = (prefix: string) => lines.findIndex((l) => l.startsWith(prefix));
  const s31 = start('## 3.1');
  const s32 = start('## 3.2');
  const s33 = start('## 3.3');
  const pages: Corpus['pages'] = [];
  const collect = (from: number, to: number, doc: 'STRATEGY' | 'ROADMAP') => {
    let current: { doc: typeof doc; page: number; text: string } | null = null;
    for (const line of lines.slice(from + 1, to)) {
      const m = line.match(/^### Página (\d+)/);
      if (m) {
        current = { doc, page: +m[1], text: '' };
        pages.push(current);
      } else if (current && !line.startsWith('> Extracción')) {
        current.text += line + '\n';
      }
    }
  };
  collect(s31, s32, 'STRATEGY');
  collect(s32, s33, 'ROADMAP');
  const render = (doc: string) =>
    pages
      .filter((p) => p.doc === doc)
      .map((p) => `[${p.doc} p.${p.page}]\n${p.text.replace(/\n{3,}/g, '\n\n').trim()}`)
      .join('\n\n');
  const full = [
    '=== DOCUMENT A: National Cancer Strategy 2026–2035 (Finland, Ministry of Social Affairs and Health). Finnish. Cite as [STRATEGY p.N]. ===',
    render('STRATEGY'),
    '=== DOCUMENT B: Implementation Roadmap 2026–2031 of the National Cancer Strategy (FICAN/STM). Finnish. Cite as [ROADMAP p.N]. ===',
    render('ROADMAP'),
  ].join('\n\n');
  cached = { full, pages };
  return cached;
}

/** Pages most relevant to lung-cancer pathways and the actions Polku models (used when context caching is unavailable). */
const KEY_PAGES: Record<'STRATEGY' | 'ROADMAP', number[]> = {
  STRATEGY: [5, 6, 29, 30, 31],
  ROADMAP: [12, 13, 23, 30, 33, 51, 52, 53, 54, 55, 56, 57, 58, 59, 63, 73, 74],
};

export function corpusExcerpt(): string {
  const { pages } = loadCorpus();
  const pick = pages.filter((p) => KEY_PAGES[p.doc].includes(p.page));
  return [
    'EXCERPT of the National Cancer Strategy 2026–2035 [STRATEGY] and its Implementation Roadmap 2026–2031 [ROADMAP] (Finnish). Only key pages are included.',
    ...pick.map((p) => `[${p.doc} p.${p.page}]\n${p.text.trim()}`),
  ].join('\n\n');
}
