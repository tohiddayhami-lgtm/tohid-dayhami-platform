import React from 'react';
import { Language } from '../App';

// Minimal "container ship" (کشتی کانتینربر) loading animation for the public export bazaar.
// Same spirit as the Meta Shop's ShopShutterLoader — small, pure-CSS, no timers — themed for
// exports: a cargo ship loaded with stacked containers gently bobbing on the sea, with a funnel
// puffing smoke and a moving waterline. It renders only while the bazaar is being resolved, so
// the moment the data is ready the real directory replaces it — no artificial delay.
export const BazaarPassageLoader: React.FC<{ lang?: Language; title?: string; primary?: string; accent?: string }> = ({
  lang = 'fa',
  title,
  primary = '#5b6472',
  accent = '#cbd5e1',
}) => {
  const T = lang === 'fa';
  return (
    <div
      className="bpl-wrap"
      dir={T ? 'rtl' : 'ltr'}
      style={{ ['--bpl-primary' as any]: primary, ['--bpl-accent' as any]: accent }}
    >
      <style>{CSS}</style>

      <div className="bpl-scene">
        <div className="bpl-ship">
          {/* funnel + smoke */}
          <div className="bpl-funnel">
            <span className="bpl-smoke" />
            <span className="bpl-smoke" />
            <span className="bpl-smoke" />
          </div>

          {/* stacked cargo containers */}
          <div className="bpl-cargo">
            <div className="bpl-row">
              <span className="bpl-box c1" /><span className="bpl-box c2" /><span className="bpl-box c3" /><span className="bpl-box c4" />
            </div>
            <div className="bpl-row">
              <span className="bpl-box c2" /><span className="bpl-box c4" /><span className="bpl-box c1" />
            </div>
          </div>

          {/* hull */}
          <div className="bpl-hull"><span className="bpl-stripe" /></div>
        </div>

        {/* sea */}
        <div className="bpl-sea"><span className="bpl-wave" /><span className="bpl-wave w2" /></div>
      </div>

      <p className="bpl-text">
        {title || (T ? 'پاساژ صادراتی' : 'Export Passage')}
        <span className="bpl-sub">{T ? 'در حال بارگیری' : 'Loading cargo'}<span className="bpl-dots" /></span>
      </p>
    </div>
  );
};

const CSS = `
.bpl-wrap { --bpl-primary:#5b6472; --bpl-accent:#cbd5e1; position:fixed; inset:0; z-index:300; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; background:radial-gradient(125% 100% at 50% 0%, #f4f9fc 0%, #e6eef4 60%, #dbe6ee 100%); font-family:Vazirmatn,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }

.bpl-scene { position:relative; width:min(260px,72vw); height:140px; }

/* ── ship ── */
.bpl-ship { position:absolute; left:50%; bottom:34px; width:160px; transform:translateX(-50%); transform-origin:50% 100%; animation:bpl-bob 3.4s ease-in-out infinite; z-index:2; }

.bpl-funnel { position:absolute; top:-22px; right:24px; width:16px; height:24px; border-radius:3px 3px 0 0; background:linear-gradient(180deg,#c0392b,#7e2419); box-shadow:inset 0 -3px 4px rgba(0,0,0,.3); }
.bpl-smoke { position:absolute; left:3px; top:-6px; width:9px; height:9px; border-radius:50%; background:rgba(120,130,140,.45); opacity:0; animation:bpl-smoke 2.6s ease-in infinite; }
.bpl-smoke:nth-child(2){ animation-delay:.85s; }
.bpl-smoke:nth-child(3){ animation-delay:1.7s; }

.bpl-cargo { display:flex; flex-direction:column-reverse; align-items:center; gap:2px; padding:0 12px; }
.bpl-row { display:flex; gap:2px; }
.bpl-box { width:24px; height:15px; border-radius:2px; box-shadow:inset 0 0 0 1px rgba(0,0,0,.18), inset 0 -3px 4px rgba(0,0,0,.18); }
.bpl-box.c1{ background:#e08a2b; } .bpl-box.c2{ background:#2e7d8c; } .bpl-box.c3{ background:#b5483f; } .bpl-box.c4{ background:#5b8a3a; }

.bpl-hull { position:relative; height:30px; margin-top:2px; background:linear-gradient(180deg, var(--bpl-primary), #2b313b); clip-path:polygon(2% 0, 98% 0, 86% 100%, 14% 100%); box-shadow:0 8px 16px rgba(0,0,0,.18); }
.bpl-stripe { position:absolute; left:0; right:0; top:7px; height:4px; background:var(--bpl-accent); opacity:.85; }

/* ── sea ── */
.bpl-sea { position:absolute; left:-12%; right:-12%; bottom:0; height:46px; overflow:hidden; border-radius:0 0 14px 14px; }
.bpl-wave { position:absolute; left:0; bottom:0; width:200%; height:46px; background:repeating-linear-gradient(90deg, rgba(91,138,170,.55) 0 14px, rgba(133,176,201,.55) 14px 28px); -webkit-mask:radial-gradient(10px at 7px 0, transparent 96%, #000) repeat-x; mask:radial-gradient(10px at 7px 0, transparent 96%, #000) repeat-x; -webkit-mask-size:28px 12px; mask-size:28px 12px; animation:bpl-flow 2.6s linear infinite; }
.bpl-wave.w2 { bottom:-7px; opacity:.55; animation-duration:3.6s; animation-direction:reverse; }

.bpl-text { display:flex; flex-direction:column; align-items:center; gap:3px; font-size:16px; font-weight:800; color:var(--bpl-primary); }
.bpl-sub { font-size:12px; font-weight:600; color:#7e8794; }
.bpl-dots::after { content:''; display:inline-block; min-width:1.1em; text-align:start; animation:bpl-dots 1.3s steps(4,end) infinite; }

@keyframes bpl-bob { 0%,100%{ transform:translateX(-50%) translateY(0) rotate(-1.6deg); } 50%{ transform:translateX(-50%) translateY(-4px) rotate(1.6deg); } }
@keyframes bpl-flow { from{ transform:translateX(0); } to{ transform:translateX(-28px); } }
@keyframes bpl-smoke { 0%{ opacity:0; transform:translateY(0) scale(.6); } 30%{ opacity:.5; } 100%{ opacity:0; transform:translateY(-22px) scale(1.4); } }
@keyframes bpl-dots { 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%,100%{content:'...'} }

@media (prefers-reduced-motion: reduce) {
  .bpl-ship, .bpl-wave, .bpl-smoke { animation:none; }
}
`;
