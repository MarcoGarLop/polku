/**
 * Polku's mark: a minimal pair of lungs. The trachea is the stem of a "P" and the right lobe is its bowl,
 * which is exactly how the intro animation builds it (see Splash.tsx).
 */
export const LOGO = {
  viewBox: '-6 0 112 108',
  trachea: 'M50 44 C 50 30, 50 18, 50 6',
  bronchusR: 'M50 38 C 52 44, 58 46, 64 44',
  bronchusL: 'M50 38 C 48 44, 42 46, 36 44',
  lobeR: 'M64 40 C 64 28, 72 18, 80 22 C 94 30, 100 70, 96 92 C 92 102, 72 102, 66 92 C 62 84, 64 60, 64 40 Z',
  lobeL: 'M36 40 C 36 28, 28 18, 20 22 C 6 30, 0 70, 4 92 C 8 102, 28 102, 34 92 C 38 84, 36 60, 36 40 Z',
  // the "P" the animation starts from — same path structure as trachea / right lobe so it can morph
  pStem: 'M38 98 C 38 70, 38 40, 38 10',
  pBowl: 'M38 10 C 62 10, 82 18, 82 34 C 82 50, 62 58, 38 58 C 38 50, 38 42, 38 34 C 38 26, 38 18, 38 10 Z',
};

export function LogoGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#22d3ee" />
        <stop offset="1" stopColor="#fb7185" />
      </linearGradient>
    </defs>
  );
}

/** Static mark for the header. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={LOGO.viewBox} aria-hidden className="logo-mark">
      <LogoGradient id="logo-g" />
      <g fill="none" stroke="url(#logo-g)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round">
        <path d={LOGO.trachea} />
        <path d={LOGO.bronchusR} />
        <path d={LOGO.bronchusL} />
        <path d={LOGO.lobeR} />
        <path d={LOGO.lobeL} />
      </g>
    </svg>
  );
}
