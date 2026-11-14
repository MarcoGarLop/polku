import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { LOGO, LogoGradient } from './Logo';

const TOTAL_MS = 4700;

/* Right lung interior: bronchial tree growing from the trachea, alveoli at the tips (viewBox units). */
const TREE = [
  'M50 40 C 55 45, 61 47, 67 49', // main bronchus
  'M67 49 C 70 42, 74 36, 78 31',
  'M67 49 C 75 49, 82 50, 88 52',
  'M67 49 C 73 57, 80 64, 86 70',
  'M67 49 C 69 62, 72 75, 76 86',
  'M74 37 C 78 39, 82 41, 86 41',
  'M80 63 C 84 62, 88 61, 91 60',
  'M72 72 C 76 78, 80 82, 84 84',
];
const ALVEOLI: [number, number][] = [
  [78, 31], [86, 41], [88, 52], [91, 60], [86, 70], [84, 84], [76, 86], [82, 28], [92, 46], [80, 92],
];

/** Main bronchus first, then the branches one after another (same delay for the "appear" and "draw" animations). */
const treeDelay = (i: number) => {
  const d = 1.75 + (i === 0 ? 0 : 0.2 + i * 0.07);
  return `${d}s, ${d}s`;
};

/** The finished right lung (used as the static half that unfolds into the mirrored left lung). */
function RightHalf() {
  return (
    <>
      <path d={LOGO.lobeR} className="lung-fill" />
      <path d={LOGO.lobeR} />
      {TREE.map((d, i) => (
        <path key={i} d={d} className="tree" />
      ))}
      {ALVEOLI.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} className="alv-dot" />
      ))}
    </>
  );
}

/**
 * Intro: the "P" of Polku is drawn, then opens into a lung: its stem becomes the trachea, its bowl swells into the
 * right lung, bronchi grow inside and alveoli bloom at their tips. The lung is then cloned in a mirror to form
 * the left one, they breathe once, the name appears, and everything fades into the map.
 * Waits for the first map render so the main thread is free (see mapReady). Click or any key skips.
 */
export function Splash() {
  const done = useStore((s) => s.introDone);
  const mapReady = useStore((s) => s.mapReady);
  const set = useStore((s) => s.set);
  const [leaving, setLeaving] = useState(false);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (mapReady) setPlay(true);
    const t = setTimeout(() => setPlay(true), 5000);
    return () => clearTimeout(t);
  }, [mapReady]);

  useEffect(() => {
    if (done || !play) return;
    const finish = () => {
      setLeaving(true);
      setTimeout(() => set({ introDone: true }), 450);
    };
    const t = setTimeout(finish, TOTAL_MS);
    const skip = () => {
      clearTimeout(t);
      finish();
    };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [done, set, play]);

  if (done) return null;
  return (
    <div className={`splash ${play ? 'play' : ''} ${leaving ? 'leaving' : ''}`} role="img" aria-label="Polku">
      <div className="splash-inner">
        <svg className="splash-logo" viewBox={LOGO.viewBox} aria-hidden>
          <LogoGradient id="splash-g" />
          <g className="breathe" fill="none" stroke="url(#splash-g)" strokeLinecap="round" strokeLinejoin="round">
            {/* the mirrored clone: appears once the right lung is complete and unfolds to the left */}
            <g className="mirror" strokeWidth={4}>
              <RightHalf />
            </g>
            {/* the P that opens into the right lung */}
            <path className="sp-stem" d={LOGO.pStem} pathLength={1} strokeWidth={4.5} />
            <path className="sp-fill lung-fill" d={LOGO.lobeR} />
            <path className="sp-bowl" d={LOGO.pBowl} pathLength={1} strokeWidth={4} />
            {TREE.map((d, i) => (
              <path key={i} className="sp-tree tree" d={d} pathLength={1} style={{ animationDelay: treeDelay(i) }} />
            ))}
            {ALVEOLI.map(([x, y], i) => (
              <circle key={i} className="sp-alv alv-dot" cx={x} cy={y} r={2.5} style={{ animationDelay: `${2.25 + i * 0.06}s` }} />
            ))}
          </g>
        </svg>
        <div className="splash-name">Polku</div>
        <div className="splash-tag">Equal lung cancer care across Finland</div>
      </div>
      <div className="splash-skip">click to skip</div>
    </div>
  );
}
