import React from 'react';
import { Language } from '../App';

// Lightweight "raising the shop shutter" loading animation for the Meta Shop public page.
// Pure CSS, no timers — it only renders while the shop is actually being resolved, so it
// never adds artificial delay: the instant the shop is ready, the real page replaces it.
export const ShopShutterLoader: React.FC<{ lang?: Language; primary?: string }> = ({ lang = 'fa', primary }) => {
  const T = lang === 'fa';
  return (
    <div className="ssl-wrap" dir={T ? 'rtl' : 'ltr'} style={primary ? ({ ['--ssl-accent' as any]: primary }) : undefined}>
      <style>{CSS}</style>
      <div className="ssl-shop">
        <div className="ssl-awning" />
        <div className="ssl-frame">
          <div className="ssl-inside">
            <div className="ssl-bag">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <span className="ssl-open">OPEN</span>
          </div>
          <div className="ssl-shutter"><span className="ssl-handle" /></div>
        </div>
      </div>
      <p className="ssl-text">{T ? 'در حال باز کردن فروشگاه' : 'Opening the shop'}<span className="ssl-dots" /></p>
    </div>
  );
};

const CSS = `
.ssl-wrap { --ssl-accent:#c0392b; position:fixed; inset:0; z-index:300; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px; background:radial-gradient(120% 90% at 50% 0%, #fefdfb 0%, #f1efe9 70%, #e9e7e0 100%); font-family:'Vazirmatn',Tahoma,'Segoe UI',system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
.ssl-shop { width:min(300px,76vw); }
.ssl-awning { height:30px; border-radius:9px 9px 3px 3px; background:repeating-linear-gradient(90deg, var(--ssl-accent) 0 26px, #fdfbf6 26px 52px); box-shadow:0 7px 16px rgba(0,0,0,.13); transform-origin:top center; animation:ssl-awning .55s cubic-bezier(.34,1.56,.64,1) both; position:relative; z-index:2; }
.ssl-awning::after { content:''; position:absolute; left:0; right:0; bottom:-9px; height:11px; background:repeating-linear-gradient(90deg, var(--ssl-accent) 0 26px, #fdfbf6 26px 52px); -webkit-mask:radial-gradient(11px at 13px 0, transparent 98%, #000) repeat-x; mask:radial-gradient(11px at 13px 0, transparent 98%, #000) repeat-x; -webkit-mask-size:26px 11px; mask-size:26px 11px; }
.ssl-frame { position:relative; height:190px; margin:14px 8px 0; border:6px solid #2c2924; border-top:0; border-radius:0 0 13px 13px; background:linear-gradient(180deg,#1a1813,#100e0b); overflow:hidden; box-shadow:0 18px 40px rgba(0,0,0,.18); }
.ssl-inside { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#fdfbf6; }
.ssl-bag { color:var(--ssl-accent); filter:drop-shadow(0 2px 6px rgba(0,0,0,.4)); animation:ssl-pop .5s ease .55s both; }
.ssl-open { font-size:12px; font-weight:900; letter-spacing:.4em; color:#fdfbf6; border:2px solid rgba(253,251,246,.55); border-radius:6px; padding:3px 10px 3px 14px; opacity:0; animation:ssl-pop .5s ease .7s both; }
.ssl-shutter { position:absolute; inset:0; background:repeating-linear-gradient(180deg,#aeb4ba 0 5px,#d4d9de 5px 8px,#9ba1a7 8px 11px); box-shadow:inset 0 -4px 10px rgba(0,0,0,.28), inset 0 4px 6px rgba(255,255,255,.25); border-radius:0 0 8px 8px; transform-origin:top; animation:ssl-up 1.5s cubic-bezier(.62,.03,.26,1) .3s forwards; }
.ssl-handle { position:absolute; left:16%; right:16%; bottom:9px; height:9px; border-radius:5px; background:linear-gradient(180deg,#7c8186,#5b6066); box-shadow:0 2px 4px rgba(0,0,0,.35); }
.ssl-text { font-size:13px; font-weight:700; color:#7a756c; letter-spacing:.01em; }
.ssl-dots::after { content:''; display:inline-block; width:1.2em; text-align:start; animation:ssl-dots 1.3s steps(4,end) infinite; }
@keyframes ssl-up { to { transform:translateY(-103%); } }
@keyframes ssl-awning { from { transform:scaleY(0); } to { transform:scaleY(1); } }
@keyframes ssl-pop { from { opacity:0; transform:scale(.7); } to { opacity:1; transform:scale(1); } }
@keyframes ssl-dots { 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%,100%{content:'...'} }
@media (prefers-reduced-motion: reduce) {
  .ssl-shutter { animation:none; transform:translateY(-103%); }
  .ssl-awning, .ssl-bag, .ssl-open { animation:none; opacity:1; transform:none; }
}
`;
