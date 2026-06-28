import React from 'react';
import { Language } from '../App';

/** Export-consultation booking loader — globe + calendar slots, shown while public sessions hydrate. */
export const ConsultationBookingLoader: React.FC<{ lang?: Language }> = ({ lang = 'fa' }) => {
  const T = lang === 'fa';
  return (
    <div className="cbl-wrap" dir={T ? 'rtl' : 'ltr'}>
      <style>{CSS}</style>

      <div className="cbl-scene">
        <div className="cbl-globe-wrap">
          <div className="cbl-globe">
            <span className="cbl-ring r1" />
            <span className="cbl-ring r2" />
            <span className="cbl-lat" />
            <span className="cbl-pin" />
          </div>
          <span className="cbl-orbit-dot d1" />
          <span className="cbl-orbit-dot d2" />
        </div>

        <svg className="cbl-bridge" viewBox="0 0 120 40" aria-hidden>
          <path className="cbl-bridge-path" d="M4 32 Q60 4 116 32" fill="none" strokeWidth="2" strokeDasharray="5 4" />
          <circle className="cbl-bridge-plane" cx="4" cy="32" r="4" />
        </svg>

        <div className="cbl-calendar">
          <div className="cbl-cal-top">
            <span className="cbl-cal-icon">📅</span>
            <span className="cbl-cal-title">{T ? 'مشاوره صادرات' : 'Export advice'}</span>
          </div>
          <div className="cbl-cal-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={`cbl-slot s${i}`} />
            ))}
          </div>
        </div>
      </div>

      <p className="cbl-text">
        {T ? 'در حال بارگذاری جلسات مشاوره صادراتی' : 'Loading export consultation sessions'}
        <span className="cbl-dots" />
      </p>
    </div>
  );
};

const CSS = `
.cbl-wrap { position:fixed; inset:0; z-index:300; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; background:radial-gradient(120% 100% at 50% 0%, #f5f3ff 0%, #ede9fe 45%, #e0e7ff 100%); font-family:Vazirmatn,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; -webkit-font-smoothing:antialiased; }

.cbl-scene { position:relative; width:min(320px,84vw); height:168px; display:flex; align-items:center; justify-content:center; }

.cbl-globe-wrap { position:relative; width:96px; height:96px; flex-shrink:0; z-index:2; }
.cbl-globe { position:absolute; inset:10px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #8b5cf6 0%, #6d28d9 55%, #4c1d95 100%); box-shadow:inset -8px -10px 18px rgba(0,0,0,.28), inset 4px 4px 12px rgba(255,255,255,.18), 0 12px 28px rgba(109,40,217,.28); animation:cbl-spin 8s linear infinite; overflow:hidden; }
.cbl-ring { position:absolute; inset:8%; border:2px solid rgba(255,255,255,.35); border-radius:50%; transform:rotate(20deg); }
.cbl-ring.r2 { inset:22% 4%; transform:rotate(-35deg); border-color:rgba(255,255,255,.22); }
.cbl-lat { position:absolute; left:0; right:0; top:50%; height:2px; margin-top:-1px; background:rgba(255,255,255,.28); }
.cbl-pin { position:absolute; width:8px; height:8px; border-radius:50%; background:#34d399; box-shadow:0 0 0 3px rgba(52,211,153,.35); top:28%; right:22%; animation:cbl-pulse 1.8s ease-in-out infinite; }

.cbl-orbit-dot { position:absolute; width:7px; height:7px; border-radius:50%; background:#fbbf24; box-shadow:0 0 8px rgba(251,191,36,.6); animation:cbl-orbit 2.4s ease-in-out infinite; }
.cbl-orbit-dot.d1 { top:4px; left:50%; margin-left:-3px; }
.cbl-orbit-dot.d2 { bottom:6px; right:8px; animation-delay:.9s; background:#38bdf8; box-shadow:0 0 8px rgba(56,189,248,.55); }

.cbl-bridge { position:absolute; width:120px; height:40px; top:50%; left:50%; transform:translate(-50%,-58%); z-index:1; overflow:visible; }
.cbl-bridge-path { stroke:#7c3aed; opacity:.45; animation:cbl-dash 1.6s linear infinite; }
.cbl-bridge-plane { fill:#10b981; animation:cbl-fly 2.2s ease-in-out infinite; }

.cbl-calendar { position:relative; width:130px; padding:10px 11px 12px; border-radius:14px; background:#fff; border:2px solid #ddd6fe; box-shadow:0 14px 32px rgba(109,40,217,.14); z-index:2; margin-inline-start:18px; animation:cbl-float 3s ease-in-out infinite; }
.cbl-cal-top { display:flex; align-items:center; gap:6px; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #ede9fe; }
.cbl-cal-icon { font-size:14px; line-height:1; }
.cbl-cal-title { font-size:10px; font-weight:800; color:#5b21b6; letter-spacing:.01em; }
.cbl-cal-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
.cbl-slot { height:14px; border-radius:5px; background:#f3f4f6; border:1px solid #e5e7eb; opacity:.55; transform:scale(.92); }
.cbl-slot.s0,.cbl-slot.s2,.cbl-slot.s4,.cbl-slot.s6,.cbl-slot.s8 { animation:cbl-slot 2.4s ease-in-out infinite; background:linear-gradient(135deg,#d1fae5,#a7f3d0); border-color:#6ee7b7; }
.cbl-slot.s1 { animation:cbl-slot 2.4s ease-in-out .35s infinite; background:linear-gradient(135deg,#ddd6fe,#c4b5fd); border-color:#a78bfa; }
.cbl-slot.s3 { animation:cbl-slot 2.4s ease-in-out .7s infinite; background:linear-gradient(135deg,#fef3c7,#fde68a); border-color:#fcd34d; }
.cbl-slot.s5 { animation:cbl-slot 2.4s ease-in-out 1.05s infinite; background:linear-gradient(135deg,#dbeafe,#bfdbfe); border-color:#93c5fd; }
.cbl-slot.s7 { animation:cbl-slot 2.4s ease-in-out 1.4s infinite; background:linear-gradient(135deg,#fce7f3,#fbcfe8); border-color:#f9a8d4; }

.cbl-text { font-size:14px; font-weight:800; color:#5b21b6; letter-spacing:.01em; text-align:center; padding:0 16px; }
.cbl-dots::after { content:''; display:inline-block; min-width:1.1em; text-align:start; animation:cbl-dots 1.3s steps(4,end) infinite; }

@keyframes cbl-spin { to { transform:rotate(360deg); } }
@keyframes cbl-pulse { 0%,100%{ transform:scale(1); opacity:1; } 50%{ transform:scale(1.25); opacity:.75; } }
@keyframes cbl-orbit { 0%,100%{ transform:translateY(0); opacity:.85; } 50%{ transform:translateY(-5px); opacity:1; } }
@keyframes cbl-dash { to { stroke-dashoffset:-18; } }
@keyframes cbl-fly { 0%{ transform:translate(0,0); opacity:0; } 15%{ opacity:1; } 85%{ opacity:1; } 100%{ transform:translate(108px,-26px); opacity:0; } }
@keyframes cbl-float { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-4px); } }
@keyframes cbl-slot { 0%,100%{ opacity:.45; transform:scale(.9); } 40%,60%{ opacity:1; transform:scale(1); box-shadow:0 2px 8px rgba(16,185,129,.22); } }
@keyframes cbl-dots { 0%{content:''} 25%{content:'.'} 50%{content:'..'} 75%,100%{content:'...'} }

@media (prefers-reduced-motion: reduce) {
  .cbl-globe, .cbl-bridge-path, .cbl-bridge-plane, .cbl-orbit-dot, .cbl-calendar, .cbl-slot, .cbl-pin { animation:none; }
  .cbl-slot { opacity:1; transform:none; }
}
`;
