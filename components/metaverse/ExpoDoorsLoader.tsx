import React from 'react';
import { Language } from '../../App';

interface Props {
  lang: Language;
  title?: string;
  subtitle?: string;
  open?: boolean;       // when true, the two container doors swing open to reveal what's behind
  progress?: number;    // 0..100 (optional)
  primary?: string;     // container body color
  accent?: string;      // trim / title color (gold for the expo, silver for the bazaar)
  bg?: string;          // backdrop behind the doors
  emblem?: string;      // center glyph
  openingText?: string; // override the "opening…" line
}

// Lightweight, image-free "export shipping container doors opening" loader. Pure CSS — no assets
// to download, so it never slows the load down. The body color is derived from `primary`, so it
// works for any theme. The two corrugated steel doors swing open on their hinges when `open`.
export const ExpoDoorsLoader: React.FC<Props> = ({ lang, title, subtitle, open = false, progress, primary = '#2d4a1a', accent = '#d4af37', bg = '#0a0f08', emblem = '🚢', openingText }) => {
  const T = lang === 'fa';

  // Corrugated steel ribs (vertical) — alternating highlight/shadow bands give the pressed-metal look.
  const ribs = `repeating-linear-gradient(90deg,
    rgba(255,255,255,.13) 0 3px,
    rgba(255,255,255,.03) 3px 13px,
    rgba(0,0,0,.20) 13px 24px,
    rgba(0,0,0,.34) 24px 29px,
    rgba(0,0,0,.20) 29px 40px,
    rgba(255,255,255,.03) 40px 50px,
    rgba(255,255,255,.13) 50px 53px)`;

  // One door panel, hinged on its OUTER edge; swings outward toward the viewer when `open`.
  const door = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute', top: 0, bottom: 0, width: '50%',
    [side === 'l' ? 'left' : 'right']: 0,
    backgroundColor: primary,
    backgroundImage: `${ribs}, linear-gradient(180deg, rgba(255,255,255,.14) 0%, rgba(0,0,0,.26) 55%, rgba(0,0,0,.5) 100%)`,
    transformOrigin: side === 'l' ? 'left center' : 'right center',
    transform: open ? `rotateY(${side === 'l' ? '-' : ''}112deg)` : 'rotateY(0deg)',
    transition: 'transform 1.35s cubic-bezier(.66,.02,.22,1)',
    boxShadow: side === 'l' ? 'inset -14px 0 30px rgba(0,0,0,.45)' : 'inset 14px 0 30px rgba(0,0,0,.45)',
    overflow: 'hidden',
  });

  // Top & bottom horizontal rails of the door (the welded frame edges).
  const rail = (edge: 'top' | 'bottom'): React.CSSProperties => ({
    position: 'absolute', left: 0, right: 0, [edge]: 0, height: '7%',
    background: `linear-gradient(180deg, rgba(255,255,255,.16), rgba(0,0,0,.45))`,
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.35)',
  });

  // A vertical cargo locking rod with top/bottom keepers and a cam-lever handle in the middle.
  const Rod: React.FC<{ at: string }> = ({ at }) => (
    <div style={{ position: 'absolute', top: '8%', bottom: '8%', left: at, width: 9, transform: 'translateX(-50%)', zIndex: 4 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'linear-gradient(90deg, #4b5563, #e5e7eb 38%, #9ca3af 58%, #374151)', boxShadow: '0 0 7px rgba(0,0,0,.55)' }} />
      {/* keeper brackets */}
      {['6%', '92%'].map((t, i) => (
        <div key={i} style={{ position: 'absolute', top: t, left: -4, width: 17, height: 16, borderRadius: 3, background: 'linear-gradient(180deg,#5b6068,#2b2e33)', boxShadow: '0 1px 3px rgba(0,0,0,.5)' }} />
      ))}
      {/* cam-lever handle near the middle */}
      <div style={{ position: 'absolute', top: '46%', left: -2, width: 30, height: 12, borderRadius: 4, background: 'linear-gradient(180deg,#9aa0a8,#3a3e44)', boxShadow: '0 2px 5px rgba(0,0,0,.55)' }} />
    </div>
  );

  // Outer-edge hinges (three steel knuckles per door).
  const Hinge: React.FC<{ side: 'l' | 'r' }> = ({ side }) => (
    <>
      {['14%', '49%', '84%'].map((t, i) => (
        <div key={i} style={{
          position: 'absolute', top: t, [side === 'l' ? 'left' : 'right']: -3, width: 18, height: '9%',
          borderRadius: 3, background: 'linear-gradient(90deg,#2c2f35,#71757c 50%,#2c2f35)',
          boxShadow: '0 1px 4px rgba(0,0,0,.5)', zIndex: 5,
        }} />
      ))}
    </>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, overflow: 'hidden', background: bg, fontFamily: 'Vazirmatn, sans-serif' }} dir={T ? 'rtl' : 'ltr'}>
      <style>{`
        @keyframes expoSweep { 0%{transform:translateX(-120%)} 100%{transform:translateX(120%)} }
        @keyframes expoGlow { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes expoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* Container rear steel frame (corner posts + rails) behind the doors */}
      <div style={{ position: 'absolute', inset: '2% 3.5%', borderRadius: 8, background: 'linear-gradient(180deg,#3b4047,#202327)', boxShadow: '0 24px 70px rgba(0,0,0,.6), inset 0 0 0 3px rgba(0,0,0,.45)' }} />

      {/* The two corrugated doors (in a perspective stage so they swing in 3D) */}
      <div style={{ position: 'absolute', inset: '4.5% 6%', perspective: 1700, perspectiveOrigin: '50% 50%', zIndex: 2 }}>
        <div style={door('l')}>
          <div style={rail('top')} /><div style={rail('bottom')} />
          <Hinge side="l" />
          <Rod at="62%" /><Rod at="86%" />
          {/* stencilled owner / type code */}
          <div style={{ position: 'absolute', top: '12%', left: '8%', color: 'rgba(255,255,255,.82)', fontWeight: 800, letterSpacing: 2, fontSize: 'clamp(10px,2.2vw,18px)', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>TDP&nbsp;U</div>
          <div style={{ position: 'absolute', bottom: '13%', left: '8%', color: 'rgba(255,255,255,.55)', fontWeight: 700, letterSpacing: 1, fontSize: 'clamp(8px,1.6vw,13px)' }}>22G1 · MAX 30480 KG</div>
        </div>
        <div style={door('r')}>
          <div style={rail('top')} /><div style={rail('bottom')} />
          <Hinge side="r" />
          <Rod at="14%" /><Rod at="38%" />
          <div style={{ position: 'absolute', top: '12%', right: '8%', color: 'rgba(255,255,255,.82)', fontWeight: 800, letterSpacing: 2, fontSize: 'clamp(10px,2.2vw,18px)', textShadow: '0 1px 2px rgba(0,0,0,.6)' }}>740913&nbsp;6</div>
          <div style={{ position: 'absolute', bottom: '13%', right: '8%', color: 'rgba(255,255,255,.55)', fontWeight: 700, letterSpacing: 1, fontSize: 'clamp(8px,1.6vw,13px)' }}>EXPORT · {T ? 'صادرات' : 'CARGO'}</div>
        </div>
      </div>

      {/* Center emblem + title + progress — fades out as the doors swing open */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#fff',
        opacity: open ? 0 : 1, transition: 'opacity .5s ease', pointerEvents: 'none', padding: 20,
      }}>
        <div style={{ fontSize: 56, animation: 'expoFloat 3s ease-in-out infinite', filter: `drop-shadow(0 4px 18px ${accent}66)` }}>{emblem}</div>
        <h2 style={{ margin: '14px 0 4px', fontSize: 24, fontWeight: 900, color: accent, textShadow: '0 2px 10px rgba(0,0,0,.6)', maxWidth: '90vw' }}>{title || (T ? 'بازارچه' : 'Bazaar')}</h2>
        {subtitle && <p style={{ margin: 0, fontSize: 14, color: '#eef0f3', opacity: .85, maxWidth: '90vw' }}>{subtitle}</p>}
        <p style={{ marginTop: 18, fontSize: 13, color: '#dfe3ea', animation: 'expoGlow 1.6s ease-in-out infinite' }}>
          {openingText || (T ? 'در حال باز شدن درب کانتینر…' : 'Opening the container…')}
        </p>

        {/* Slim progress / shimmer bar */}
        <div style={{ marginTop: 14, width: 220, maxWidth: '70vw', height: 4, borderRadius: 99, background: 'rgba(255,255,255,.15)', overflow: 'hidden', position: 'relative' }}>
          {typeof progress === 'number'
            ? <div style={{ height: '100%', width: `${Math.max(6, Math.min(100, progress))}%`, background: `linear-gradient(90deg, ${accent}, #ffffff)`, transition: 'width .3s ease' }} />
            : <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, animation: 'expoSweep 1.3s ease-in-out infinite' }} />}
        </div>
      </div>
    </div>
  );
};
