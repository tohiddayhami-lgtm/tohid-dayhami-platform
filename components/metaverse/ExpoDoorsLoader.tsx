import React from 'react';
import { Language } from '../../App';

interface Props {
  lang: Language;
  title?: string;
  subtitle?: string;
  open?: boolean;       // when true, the two doors slide apart to reveal what's behind
  progress?: number;    // 0..100 (optional)
  primary?: string;     // door hue
  accent?: string;      // trim / handle / title color (gold for the expo, silver for the bazaar)
  bg?: string;          // backdrop behind the doors
  emblem?: string;      // center glyph
  openingText?: string; // override the "opening…" line
}

// Lightweight, image-free "grand doors opening" loader. Pure CSS — no assets to download,
// so it never slows the load down. Door shades are derived from `primary` by darkening it,
// so it works for any color (emerald expo, neutral bazaar, …). Doors slide apart when `open`.
export const ExpoDoorsLoader: React.FC<Props> = ({ lang, title, subtitle, open = false, progress, primary = '#2d4a1a', accent = '#d4af37', bg = '#0a0f08', emblem = '🏛️', openingText }) => {
  const T = lang === 'fa';
  // Wood/metal paneling: vertical grooves + a top-to-bottom darkening of the chosen hue (hue-agnostic).
  const panel = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute', top: 0, bottom: 0, width: '50.5%',
    [side === 'l' ? 'left' : 'right']: 0,
    background: `
      repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 2px, transparent 2px 26px),
      linear-gradient(180deg, ${primary} 0%, rgba(0,0,0,.35) 55%, rgba(0,0,0,.62) 100%)`,
    boxShadow: side === 'l' ? 'inset -18px 0 36px rgba(0,0,0,.5)' : 'inset 18px 0 36px rgba(0,0,0,.5)',
    transform: open ? `translateX(${side === 'l' ? '-102%' : '102%'})` : 'translateX(0)',
    transition: 'transform 1.15s cubic-bezier(.62,.01,.2,1)',
    zIndex: 2,
  });
  const edge = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute', top: '6%', bottom: '6%', width: 6,
    [side === 'l' ? 'right' : 'left']: 0,
    background: `linear-gradient(180deg, ${accent}, rgba(0,0,0,.4))`,
    boxShadow: `0 0 14px ${accent}88`,
  });
  const frame: React.CSSProperties = {
    position: 'absolute', inset: '10% 14%', border: `2px solid ${accent}55`, borderRadius: 6,
    boxShadow: `inset 0 0 0 8px rgba(0,0,0,.12)`,
  };
  const handle = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute', top: '50%', [side === 'l' ? 'right' : 'left']: 14, width: 10, height: 54,
    transform: 'translateY(-50%)', borderRadius: 99, background: `linear-gradient(180deg, ${accent}, rgba(0,0,0,.35))`,
    boxShadow: `0 0 10px ${accent}66`,
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, overflow: 'hidden', background: bg, fontFamily: 'Vazirmatn, sans-serif' }} dir={T ? 'rtl' : 'ltr'}>
      <style>{`
        @keyframes expoSweep { 0%{transform:translateX(-120%)} 100%{transform:translateX(120%)} }
        @keyframes expoGlow { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes expoFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* Left & right doors */}
      <div style={panel('l')}><div style={frame} /><div style={edge('l')} /><div style={handle('l')} /></div>
      <div style={panel('r')}><div style={frame} /><div style={edge('r')} /><div style={handle('r')} /></div>

      {/* Center emblem + title + progress — fades out as the doors open */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#fff',
        opacity: open ? 0 : 1, transition: 'opacity .5s ease', pointerEvents: 'none', padding: 20,
      }}>
        <div style={{ fontSize: 56, animation: 'expoFloat 3s ease-in-out infinite', filter: `drop-shadow(0 4px 18px ${accent}66)` }}>{emblem}</div>
        <h2 style={{ margin: '14px 0 4px', fontSize: 24, fontWeight: 900, color: accent, textShadow: '0 2px 10px rgba(0,0,0,.6)', maxWidth: '90vw' }}>{title || (T ? 'بازارچه' : 'Bazaar')}</h2>
        {subtitle && <p style={{ margin: 0, fontSize: 14, color: '#eef0f3', opacity: .85, maxWidth: '90vw' }}>{subtitle}</p>}
        <p style={{ marginTop: 18, fontSize: 13, color: '#dfe3ea', animation: 'expoGlow 1.6s ease-in-out infinite' }}>
          {openingText || (T ? 'در حال باز شدن درها…' : 'Opening the doors…')}
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
