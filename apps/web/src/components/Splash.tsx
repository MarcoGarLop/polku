import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { LOGO, LogoGradient } from './Logo';

const TOTAL_MS = 3600;

/**
 * Intro: the "P" of Polku is drawn, its stem becomes the trachea and its bowl becomes a lung, the other lung
 * draws in, they breathe once, the name appears, and everything fades into the map.
 * Click or press any key to skip. Skipped entirely with reduced motion or in ?video mode.
 */
export function Splash() {
  const done = useStore((s) => s.introDone);
  const mapReady = useStore((s) => s.mapReady);
  const set = useStore((s) => s.set);
  const [leaving, setLeaving] = useState(false);
  // The app blocks the main thread for a moment while it builds the map. Starting the animation before that
  // would freeze it half-way, so it waits for the map (or 5 s at most) and then plays smoothly.
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
          <g className="breathe" fill="none" stroke="url(#splash-g)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
            <path className="sp-stem" d={LOGO.pStem} pathLength={1} />
            <path className="sp-bowl" d={LOGO.pBowl} pathLength={1} />
            <path className="sp-lobeL" d={LOGO.lobeL} pathLength={1} />
            <path className="sp-bronchus" d={LOGO.bronchusR} pathLength={1} />
            <path className="sp-bronchus" d={LOGO.bronchusL} pathLength={1} />
          </g>
        </svg>
        <div className="splash-name">Polku</div>
        <div className="splash-tag">Equal lung cancer care across Finland</div>
      </div>
      <div className="splash-skip">click to skip</div>
    </div>
  );
}
