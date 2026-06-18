import React, { useEffect, useMemo, useState } from 'react';
import type { MetaBazaar, MetaExpoBoothReservation, MetaExpoEvent, MetaverseBooth } from '../../types';
import { Language } from '../../App';
import { ExpoFloorPlan } from '../ExpoFloorPlan';
import { BoothReservationModal } from './BoothReservationModal';
import { bi, hallDims, resolveExpoLanguages, isRtlExpoLang } from './expoUtils';
import { logMetaExpoEvent, subscribeMetaExpoBoothReservations } from '../../services/firebaseService';

interface Props {
  bazaar: MetaBazaar;
  lang: Language;
  shopBaseUrl: string;
  onExit?: () => void;
}

const visitorColors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];
const liveVisitor = (bazaarId: string) => {
  const key = `_meta_expo_visitor_${bazaarId}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as { id: string; name: string; color: string };
  } catch {}
  const n = Math.floor(100 + Math.random() * 900);
  const visitor = { id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: `Guest ${n}`, color: visitorColors[n % visitorColors.length] };
  try { localStorage.setItem(key, JSON.stringify(visitor)); } catch {}
  return visitor;
};

export const ExpoReserveMapView: React.FC<Props> = ({ bazaar, lang: initialLang, shopBaseUrl, onExit }) => {
  const expo = bazaar.expo!;
  const { width, depth } = hallDims(expo);
  const expoLangs = useMemo(() => resolveExpoLanguages(expo), [expo.languages]);
  const defaultLang = expo.defaultLang && expoLangs.some(l => l.code === expo.defaultLang)
    ? expo.defaultLang
    : (expoLangs[0]?.code || 'en');
  const [uiLang, setUiLang] = useState<string>(defaultLang);
  const T = isRtlExpoLang(uiLang, expoLangs);
  const visitor = useMemo(() => liveVisitor(bazaar.id), [bazaar.id]);
  const [boothReservations, setBoothReservations] = useState<Record<string, MetaExpoBoothReservation>>({});
  const [reserveBooth, setReserveBooth] = useState<MetaverseBooth | null>(null);

  useEffect(() => {
    return subscribeMetaExpoBoothReservations(bazaar.id, (list) => {
      const map: Record<string, MetaExpoBoothReservation> = {};
      list.forEach(r => {
        if (r.status === 'pending' || r.status === 'confirmed') map[r.boothId] = r;
      });
      setBoothReservations(map);
    });
  }, [bazaar.id]);

  const track = (type: MetaExpoEvent['type'], opts: Partial<MetaExpoEvent> = {}) => {
    logMetaExpoEvent(type, { id: bazaar.id, slug: bazaar.slug, name: bazaar.name }, { ...opts, language: uiLang });
  };

  const t = {
    title: T ? 'نقشه رزرو غرفه‌ها' : 'Booth reservation map',
    subtitle: T ? 'روی غرفه آزاد کلیک کنید و فرم رزرو را تکمیل کنید.' : 'Click an available booth and complete the reservation form.',
    enter3d: T ? 'ورود به نمایشگاه ۳D' : 'Enter 3D exhibition',
    back: T ? 'بازگشت' : 'Back',
    available: T ? 'آزاد' : 'Available',
    pending: T ? 'رزرو موقت' : 'Held',
    confirmed: T ? 'رزرو قطعی' : 'Booked',
    hint: T ? 'رزرو از این نقشه همانند رزرو داخل نمایشگاه است و در نمایشگاه متاورسی نمایش داده می‌شود.' : 'Reservations from this map use the same system as in the 3D hall.',
  };

  const expo3dUrl = `${shopBaseUrl}?expo=${encodeURIComponent(bazaar.slug)}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" dir={T ? 'rtl' : 'ltr'}>
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{bi(expo.title, uiLang, bazaar.name)}</h1>
            <p className="text-xs text-gray-500">{t.title} · {t.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={uiLang}
              onChange={e => setUiLang(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              {expoLangs.map(l => <option key={l.code} value={l.code}>{l.name || l.code}</option>)}
            </select>
            <a href={expo3dUrl} className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold whitespace-nowrap">
              {t.enter3d}
            </a>
            {onExit && (
              <button type="button" onClick={onExit} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                {t.back}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#2d4a1a] border border-white shadow-sm" />{t.available}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-600 border border-white shadow-sm" />{t.pending}</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-700 border border-white shadow-sm" />{t.confirmed}</span>
        </div>
        <p className="text-[11px] text-gray-400">{t.hint}</p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <ExpoFloorPlan
            width={width}
            depth={depth}
            visualStyle={expo.visualStyle}
            boothLayout={expo.boothLayout}
            booths={expo.booths || []}
            decorations={[]}
            readonly
            reserveMap
            langFa={T}
            layoutHint=""
            boothReservations={boothReservations}
            boothLabel={(b, i) => {
              const name = bi(b.name, uiLang, String(i + 1));
              return name.length > 9 ? `${name.slice(0, 8)}…` : name;
            }}
            onBoothClick={(b) => {
              track('booth_reserve_click', { boothId: b.id, boothName: bi(b.name, uiLang), targetType: 'booth_reserve', side: 'map_reserve' });
              setReserveBooth(b);
            }}
            onBoothMove={() => {}}
            onDecorationMove={() => {}}
            onSpawnMove={() => {}}
            onSelectBooth={() => {}}
            onSelectDecoration={() => {}}
          />
        </div>
      </main>

      <BoothReservationModal
        open={!!reserveBooth}
        bazaar={bazaar}
        booth={reserveBooth}
        visitorId={visitor.id}
        lang={uiLang}
        onClose={() => setReserveBooth(null)}
        onReserved={() => setReserveBooth(null)}
        onTrack={track}
      />
    </div>
  );
};
