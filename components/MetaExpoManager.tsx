import React, { useMemo, useState } from 'react';
import { MetaBazaar, MetaExpoEvent, MetaShop } from '../types';
import { IconPlus, IconEdit, IconGlobe, IconCopy, IconTrash } from './Icons';
import { Language } from '../App';
import { MetaBazaarManager } from './MetaBazaarManager';
import {
  EXPO_STYLE_CATALOG,
  ExpoCatalogFilter,
  blankExpoForStyle,
  bazaarHasActiveExpo,
  expoStyleMeta,
  filterBazaarsByExpoStyle,
  resolveExpoStyle,
} from './metaverse/expoCatalog';
import { ExpoVisualStyle } from '../types';
import { fetchMetaExpoEvents } from '../services/firebaseService';

interface Props {
  bazaars: MetaBazaar[];
  shops: MetaShop[];
  lang: Language;
  shopBaseUrl: string;
  onSave: (b: MetaBazaar) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readonly?: boolean;
}

export const MetaExpoManager: React.FC<Props> = ({
  bazaars,
  shops,
  lang,
  shopBaseUrl,
  onSave,
  onDelete,
  readonly = false,
}) => {
  const T = lang === 'fa';
  const [category, setCategory] = useState<ExpoCatalogFilter>('all');
  const [draft, setDraft] = useState<MetaBazaar | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expoAnalyticsId, setExpoAnalyticsId] = useState<string | null>(null);
  const [expoAnalyticsEvents, setExpoAnalyticsEvents] = useState<MetaExpoEvent[]>([]);
  const [expoAnalyticsLoading, setExpoAnalyticsLoading] = useState(false);

  const t = {
    title: T ? 'نمایشگاه‌های متاورسی' : 'Metaverse exhibitions',
    subtitle: T ? 'مدیریت سالن‌های سه‌بعدی بر اساس نوع نمایشگاه' : 'Manage 3D halls by exhibition type',
    newExpo: T ? 'نمایشگاه جدید' : 'New exhibition',
    empty: T ? 'در این دسته نمایشگاه فعالی نیست.' : 'No active exhibitions in this category.',
    emptyHint: T ? 'از دکمه «نمایشگاه جدید» استفاده کنید یا در تب بازارچه‌ها برای یک بازارچه نمایشگاه را فعال کنید.' : 'Click “New exhibition” or enable an expo on a bazaar in the Bazaars tab.',
    open: T ? 'پیش‌نمایش ۳D' : '3D preview',
    copy: T ? 'کپی لینک' : 'Copy link',
    copied: T ? 'کپی شد ✓' : 'Copied ✓',
    edit: T ? 'مدیریت' : 'Manage',
    del: T ? 'حذف بازارچه' : 'Delete bazaar',
    deleteConfirm: T ? 'این بازارچه و نمایشگاهش حذف شود؟' : 'Delete this bazaar and its exhibition?',
    booths: T ? 'غرفه' : 'booths',
    bazaar: T ? 'بازارچه' : 'Bazaar',
    inactive: T ? 'غیرفعال' : 'Inactive',
    report: T ? 'گزارش' : 'Report',
    count: (n: number) => T ? `${n} مورد` : `${n} items`,
  };

  const expoUrl = (slug: string) => `${shopBaseUrl}?expo=${encodeURIComponent(slug)}`;
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';

  const filtered = useMemo(
    () => filterBazaarsByExpoStyle(bazaars, category, true),
    [bazaars, category],
  );

  const counts = useMemo(() => {
    const active = bazaars.filter(bazaarHasActiveExpo);
    const m = new Map<ExpoCatalogFilter, number>();
    m.set('all', active.length);
    for (const item of EXPO_STYLE_CATALOG) {
      if (item.id === 'all') continue;
      m.set(item.id, active.filter(b => resolveExpoStyle(b) === item.id).length);
    }
    return m;
  }, [bazaars]);

  const newExpoBazaar = (style: ExpoVisualStyle): MetaBazaar => {
    const meta = expoStyleMeta(style);
    const name = T ? `نمایشگاه ${meta.labelFa}` : `${meta.labelEn} Expo`;
    return {
      id: `bz-${Date.now()}`,
      slug: '',
      name,
      isActive: true,
      defaultLang: T ? 'fa' : 'en',
      title: { fa: name, en: `${meta.labelEn} Expo` },
      tree: [],
      levelLabels: [],
      theme: { primary: meta.accent, cover: '#1f2a18' },
      createdAt: new Date().toISOString(),
      expo: blankExpoForStyle(style) as MetaBazaar['expo'],
    };
  };

  const openExpoAnalytics = async (bazaar: MetaBazaar) => {
    setExpoAnalyticsId(bazaar.id);
    setExpoAnalyticsLoading(true);
    try {
      setExpoAnalyticsEvents(await fetchMetaExpoEvents(bazaar.id));
    } finally {
      setExpoAnalyticsLoading(false);
    }
  };

  if (draft) {
    return (
      <MetaBazaarManager
        bazaars={bazaars}
        shops={shops}
        lang={lang}
        shopBaseUrl={shopBaseUrl}
        onSave={onSave}
        onDelete={onDelete}
        readonly={readonly}
        embeddedDraft={draft}
        onEmbeddedClose={() => setDraft(null)}
      />
    );
  }

  if (expoAnalyticsId) {
    const bazaar = bazaars.find(b => b.id === expoAnalyticsId);
    const visits = expoAnalyticsEvents.filter(e => e.type === 'visit');
    return (
      <div className="space-y-4 animate-fade-in">
        <button type="button" onClick={() => setExpoAnalyticsId(null)} className="text-sm text-gray-500 hover:text-gray-800">
          ← {T ? 'بازگشت' : 'Back'}
        </button>
        <h3 className="text-lg font-bold text-gray-800">{t.report} — {bazaar?.name}</h3>
        {expoAnalyticsLoading ? (
          <div className={card + ' text-center py-12 text-gray-400 text-sm'}>{T ? 'در حال بارگذاری…' : 'Loading…'}</div>
        ) : (
          <div className={card}>
            <p className="text-2xl font-extrabold text-gray-900">{visits.length.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{T ? 'بازدید ثبت‌شده' : 'Recorded visits'}</p>
            <p className="text-xs text-gray-400 mt-3">{T ? 'برای گزارش کامل، از ویرایش بازارچه استفاده کنید.' : 'Open full report from bazaar editor for more detail.'}</p>
          </div>
        )}
      </div>
    );
  }

  const activeMeta = category === 'all' ? EXPO_STYLE_CATALOG[0] : expoStyleMeta(category);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{t.title}</h3>
          <p className="text-xs text-gray-400">{t.subtitle} · {t.count(filtered.length)}</p>
        </div>
        {!readonly && category !== 'all' && (
          <button
            type="button"
            onClick={() => setDraft(newExpoBazaar(category as ExpoVisualStyle))}
            className="px-3 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-1.5"
            style={{ backgroundColor: activeMeta.accent }}
          >
            <IconPlus className="w-4 h-4" />
            {t.newExpo}
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {EXPO_STYLE_CATALOG.map(item => {
          const active = category === item.id;
          const count = counts.get(item.id) ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.id)}
              className={`text-xs px-3 py-2 rounded-xl border-2 font-bold transition-all flex items-center gap-1.5 ${active ? 'shadow-md scale-[1.02]' : 'opacity-85 hover:opacity-100'}`}
              style={{
                borderColor: item.accent,
                background: active ? item.bg : '#fff',
                color: item.accent,
              }}
            >
              <span>{item.emoji}</span>
              <span>{T ? item.labelFa : item.labelEn}</span>
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-500 rounded-lg px-3 py-2" style={{ background: activeMeta.bg }}>
        {T ? activeMeta.descFa : activeMeta.descEn}
      </p>

      {filtered.length === 0 ? (
        <div className={card + ' text-center py-14 text-gray-400 text-sm'}>
          <p>{t.empty}</p>
          <p className="text-xs mt-2 text-gray-400">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(b => {
            const style = resolveExpoStyle(b);
            const meta = expoStyleMeta(style);
            const boothCount = (b.expo?.booths || []).length;
            return (
              <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div
                  className="h-16 flex items-center justify-between px-3 text-white font-bold relative"
                  style={{
                    background: meta.accent,
                    backgroundImage: b.coverImage ? `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.55)), url(${b.coverImage})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <span className="text-sm truncate">{meta.emoji} {(T ? b.expo?.title?.fa || b.title?.fa : b.expo?.title?.en || b.title?.en) || b.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/20 shrink-0">{T ? meta.labelFa : meta.labelEn}</span>
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <h4 className="font-bold text-gray-800 text-sm truncate">{b.name}</h4>
                  <div className="text-[11px] text-gray-400">
                    {boothCount} {t.booths} · {t.bazaar}: <span className="font-mono" dir="ltr">{b.slug}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] text-gray-500 truncate" dir="ltr">
                    <span className="truncate">?expo={b.slug}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {b.slug && (
                      <a href={expoUrl(b.slug)} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                        <IconGlobe className="w-3.5 h-3.5" />{t.open}
                      </a>
                    )}
                    {b.slug && (
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(expoUrl(b.slug)); setCopiedId(b.id); setTimeout(() => setCopiedId(null), 1800); }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
                      >
                        {copiedId === b.id ? t.copied : <><IconCopy className="w-3.5 h-3.5" />{t.copy}</>}
                      </button>
                    )}
                    <button type="button" onClick={() => openExpoAnalytics(b)} className="text-xs px-2.5 py-1.5 rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50">{t.report}</button>
                    {!readonly && (
                      <button type="button" onClick={() => setDraft(JSON.parse(JSON.stringify(b)))} className="text-xs px-2.5 py-1.5 rounded-lg text-indigo-600 border border-indigo-200 hover:bg-indigo-50 flex items-center gap-1">
                        <IconEdit className="w-3.5 h-3.5" />{t.edit}
                      </button>
                    )}
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => { if (confirm(t.deleteConfirm)) onDelete(b.id); }}
                        className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50"
                      >
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
