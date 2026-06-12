import React from 'react';
import { Language } from '../App';

// Minimal "export passage" (پاساژ صادراتی) loading animation for the public bazaar page.
// Same spirit as the Meta Shop's ShopShutterLoader — small, pure-CSS, no timers — but shaped
// like an arcade gateway: a glass-roofed passage with a light sweeping through it (goods
// flowing out / export) and a small storefront row. It renders only while the bazaar is being
// resolved, so the moment the data is ready the real directory replaces it — no artificial delay.
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

      <div className="bpl-arcade">
        {/* Banner / awning along the top of the passage */}
        <div className="bpl-banner" />

        {/* Arched gateway */}
        <div className="bpl-arch">
          {/* receding light beam — goods flowing through / export */}
          <span className="bpl-beam" />

          {/* small storefront row inside the passage */}
          <div className="bpl-shops">
            <span className="bpl-shop" />
            <span className="bpl-shop" />
            <span className="bpl-shop" />
          </div>

          {/* export emblem */}
          <div className="bpl-emblem">🧳</div>
        </div>
      </div>

      <p className="bpl-text">
        {title || (T ? 'پاساژ صادراتی' : 'Export Passage')}
        <span className="bpl-sub">{T ? 'در حال آماده‌سازی' : 'Getting ready'}</span>
        <span className="bpl-dots" />
      </p>
    </div>
  );
};

const CSS = `
.bpl-wrap { --bpl-primary:#5b6472; --bpl-accent:#cbd5e1; position:fixed; inset:0; z-index:300; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; background:radial-gradient(120% 90% at 50% 0%, #fbfcfd 0%, #eef0f3 70%, #e6e9ee 100%); font-family:Vazirmatn,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }

.bpl-arcade { width:min(260px,70vw); }

.bpl-banner { height:18px; border-radius:7px 7px 2px 2px; background:repeating-linear-gradient(90deg, var(--bpl-primary) 0 22px, #fdfdfe 22px 44px); box-shadow:0 5px 12px rgba(0,0,0,.1); transform-origin:top center; animation:bpl-drop .5s cubic-bezier(.34,1.56,.64,1) both; position:relative; z-index:2; }

.bpl-arch { position:relative; height:150px; margin:12px 6px 0; border:5px solid var(--bpl-primary); border-bottom:0; border-radius:90px 90px 10px 10px; background:linear-gradient(180deg,#20242d 0%, #2b3038 60%, #353b45 100%); overflow:hidden; box-shadow:0 16px 34px rgba(0,0,0,.16), inset 0 2px 14px rgba(0,0,0,.4); }

/* sweeping light beam = flow of goods through the passage */
.bpl-beam { position:absolute; top:0; bottom:0; width:55%; left:-55%; background:linear-gradient(90deg, transparent, rgba(255,255,255,.16) 45%, var(--bpl-accent) 50%, rgba(255,255,255,.16) 55%, transparent); filter:blur(1px); animation:bpl-sweep 1.7s cubic-bezier(.5,0,.5,1) infinite; }

/* storefront row deep inside the passage */
.bpl-shops { position:absolute; left:14%; right:14%; bottom:14px; display:flex; gap:7px; justify-content:center; opacity:0; animation:bpl-fade .5s ease .45s both; }
.bpl-shop { flex:1; height:34px; border-radius:5px 5px 0 0; background:linear-gradient(180deg, var(--bpl-accent), rgba(203,213,225,.35)); box-shadow:0 0 10px rgba(203,213,225,.35); }
.bpl-shop:nth-child(2) { height:42px; }

/* export emblem (luggage / shipped goods) */
.bpl-emblem { position:absolute; top:30px; left:0; right:0; text-align:center; font-size:30px; filter:drop-shadow(0 3px 8px rgba(0,0,0,.4)); animation:bpl-float 2.6s ease-in-out infinite; }

.bpl-text { display:flex; flex-direction:column; align-items:center; gap:3px; font-weight:800; color:var(--bpl-primary); }
.bpl-text { font-size:16px; }
.bpl-sub { font-size:12px; font-weight:600; color:#8a909a; }
.bpl-dots::after { content:''; display:inline-block; min-width:1.1em; text-align:start; color:#8a909a; animation:bpl-dots 1.3s steps(4,end) infinite; }

@keyframes bpl-sweep { 0%{left:-55%} 60%,100%{left:100%} }
@keyframes bpl-drop { from{ transform:scaleY(0); } to{ transform:scaleY(1); } }
@keyframes bpl-fade { from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
@keyframes bpl-float { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-5px); } }
@keyframes bpl-dots { 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%,100%{content:'...'} }

@media (prefers-reduced-motion: reduce) {
  .bpl-beam, .bpl-emblem, .bpl-banner, .bpl-shops { animation:none; opacity:1; transform:none; }
}
`;
