import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { LOGO, LogoGradient } from './Logo';

/** The animation itself; afterwards the final frame holds while the map is built behind it. */
const ANIM_MS = 2700;

const TREE = [
  'M50 40 C 55 45, 61 47, 67 49',
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
const treeDelay = (i: number) => {
  const d = 0.85 + (i === 0 ? 0 : 0.12 + i * 0.04);
  return `${d}s, ${d}s`;
};

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

const NAME = 'Polku'.split('');

/**
 * Intro (~2.7 s): the P is drawn and opens into a lung (bronchi grow, alveoli bloom), the lung mirrors into a pair,
 * and the name flows in letter by letter with a light sweep. Then the final frame holds while the map is built
 * (that build blocks the main thread for ~2 s, invisible on a still frame), and everything fades into the map.
 * Click or any key skips. Hidden with reduced motion and in ?video mode.
 */
export function Splash() {
  const done = useStore((s) => s.introDone);
  const mapReady = useStore((s) => s.mapReady);
  const set = useStore((s) => s.set);
  const [animEnded, setAnimEnded] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // 1) play the animation, then allow the map to be built
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      setAnimEnded(true);
      set({ buildMap: true });
    }, ANIM_MS);
    const skip = () => {
      clearTimeout(t);
      setAnimEnded(true);
      set({ buildMap: true });
    };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [done, set]);

  // 2) once the map is ready (or after 6 s at most), fade out
  useEffect(() => {
    if (done || !animEnded) return;
    const finish = () => {
      setLeaving(true);
      setTimeout(() => set({ introDone: true }), 450);
    };
    if (mapReady) {
      const t = setTimeout(finish, 150);
      return () => clearTimeout(t);
    }
    const t = setTimeout(finish, 6000);
    return () => clearTimeout(t);
  }, [done, animEnded, mapReady, set]);

  if (done) return null;
  return (
    <div className={`splash ${leaving ? 'leaving' : ''}`} role="img" aria-label="Polku: same cancer, same chance">
      <div className="splash-inner">
        <svg className="splash-logo" viewBox={LOGO.viewBox} aria-hidden>
          <LogoGradient id="splash-g" />
          <g className="breathe" fill="none" stroke="url(#splash-g)" strokeLinecap="round" strokeLinejoin="round">
            <g className="mirror" strokeWidth={4}>
              <RightHalf />
            </g>
            <path className="sp-stem" d={LOGO.pStem} pathLength={1} strokeWidth={4.5} />
            <path className="sp-fill lung-fill" d={LOGO.lobeR} />
            <path className="sp-bowl" d={LOGO.pBowl} pathLength={1} strokeWidth={4} />
            {TREE.map((d, i) => (
              <path key={i} className="sp-tree tree" d={d} pathLength={1} style={{ animationDelay: treeDelay(i) }} />
            ))}
            {ALVEOLI.map(([x, y], i) => (
              <circle key={i} className="sp-alv alv-dot" cx={x} cy={y} r={2.5} style={{ animationDelay: `${1.15 + i * 0.035}s` }} />
            ))}
          </g>
        </svg>
        <div className="splash-name" aria-hidden>
          {NAME.map((ch, i) => (
            <span key={i} style={{ animationDelay: `${1.55 + i * 0.07}s, ${1.8 + i * 0.07}s` }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="splash-tag">Same cancer. Same chance.</div>
      </div>
    </div>
  );
}
