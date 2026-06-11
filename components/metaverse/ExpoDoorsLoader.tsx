import React from 'react';
import { Language } from '../../App';

interface Props {
  lang: Language;
  title?: string;
  subtitle?: string;
  open?: boolean;       // when true, the two doors slide apart to reveal the hall
  progress?: number;    // 0..100 (optional)
  primary?: string;     // accent color (matches the bazaar theme)
}

// Lightweight, image-free "grand mall doors opening" loader. Pure CSS — no assets to download,
// so it never slows the load down. The two ornate panels slide apart when `open` becomes true.
export const ExpoDoorsLoader: React.FC<Props> = ({ lang, title, subtitle, open = false, progress, primary = '#2d4a1a' }) => {
  const T = lang === 'fa';
  const gold = '#d4af37';
  // Wood-grain paneling via layered gradients (cheap, no textures).
  const panel = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute', top: 0, bottom: 0, width: '50.5%',
    [side === 'l' ? 'left' : 'right']: 0,
    background: `
      repeating-linear-gradient(90deg, rgba(0,0,0,.16) 0 2px, transparent 2px 26px),
      linear-gradient(180deg, ${primary} 0%, #1c3010 60%, #14240b 100%)`,
    boxShadow: side === 'l' ? 'inset -18px 0 36px rgba(0,0,0,.5)' : 'inset 18px 0 36px rgba(0,0,0,.5)',
    transform: open ? `translateX(${side === 'l' ? '-102%' : '102%'})` : 'translateX(0)',
    transition: 'transform 1.15s cubic-bezier(.62,.01,.2,1)',
    zIndex: 2,
  });
  // Inner gold edge near the seam.
  const edge = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute', top: '6%', bottom: '6%', width: 6,
    [side === 'l' ? 'right' : 'left']: 0,
    background: `linear-gradient(180deg, ${gold}, #8a6d1f)`,
    boxShadow: `0 0 14px ${gold}88`,
  });
  // Decorative inset frame on each door.
  const frame: React.CSSProperties = {
    position: 'absolute', inset: '10% 14%', border: `2px solid ${gold}55`, borderRadius: 6,
    boxShadow: `inset 0 0 0 8px rgba(0,0,0,.12)`,
  };
  const handle = (side: 'l' | 'r'): React.CSSProperties => ({
    position: 'absolute', top: '50%', [side === 'l' ? 'right' : 'left']: 14, width: 10, height: 54,
    transform: 'translateY(-50%)', borderRadius: 99, background: `linear-gradient(180deg, ${gold}, #9c7a22)`,
    boxShadow: `0 0 10px ${gold}66`,
  });

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 300, overflow: 'hidden', background: '#0a0f08', fontFamily: 'Vazirmatn, sans-serif' }} dir={T ? 'rtl' : 'ltr'}>
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
        <div style={{ fontSize: 56, animation: 'expoFloat 3s ease-in-out infinite', filter: `drop-shadow(0 4px 18px ${gold}66)` }}>🏛️</div>
        <h2 style={{ margin: '14px 0 4px', fontSize: 24, fontWeight: 900, color: gold, textShadow: '0 2px 10px rgba(0,0,0,.6)', maxWidth: '90vw' }}>{title || (T ? 'نمایشگاه مجازی' : 'Virtual Exhibition')}</h2>
        {subtitle && <p style={{ margin: 0, fontSize: 14, color: '#e8e3cf', opacity: .85, maxWidth: '90vw' }}>{subtitle}</p>}
        <p style={{ marginTop: 18, fontSize: 13, color: '#cdd3c2', animation: 'expoGlow 1.6s ease-in-out infinite' }}>
          {T ? 'در حال باز شدن درهای پاساژ…' : 'Opening the gallery doors…'}
        </p>

        {/* Slim progress / shimmer bar */}
        <div style={{ marginTop: 14, width: 220, maxWidth: '70vw', height: 4, borderRadius: 99, background: 'rgba(255,255,255,.15)', overflow: 'hidden', position: 'relative' }}>
          {typeof progress === 'number'
            ? <div style={{ height: '100%', width: `${Math.max(6, Math.min(100, progress))}%`, background: `linear-gradient(90deg, ${gold}, #fff6cf)`, transition: 'width .3s ease' }} />
            : <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, animation: 'expoSweep 1.3s ease-in-out infinite' }} />}
        </div>
      </div>
    </div>
  );
};
