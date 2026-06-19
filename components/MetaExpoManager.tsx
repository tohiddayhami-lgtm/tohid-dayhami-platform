import React, { useMemo, useState } from 'react';
import { MetaBazaar, MetaExpoBoothReservation, MetaExpoEvent, MetaExpoRegistration, MetaShop } from '../types';
import { IconPlus, IconEdit, IconGlobe, IconCopy, IconTrash, IconLayout } from './Icons';
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
import { fetchMetaExpoEvents, fetchMetaExpoBoothReservations, fetchMetaExpoRegistrations, updateMetaExpoBoothReservation, confirmBoothReservation } from '../services/firebaseService';
import { exportExpoRegistrationsCSV } from './metaverse/EntranceRegistrationModal';
import { exportBoothReservationsCSV } from './metaverse/BoothReservationModal';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `expo-${Date.now().toString(36)}`;
const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

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
  const [copiedMapId, setCopiedMapId] = useState<string | null>(null);
  const [expoAnalyticsId, setExpoAnalyticsId] = useState<string | null>(null);
  const [expoAnalyticsEvents, setExpoAnalyticsEvents] = useState<MetaExpoEvent[]>([]);
  const [expoAnalyticsLoading, setExpoAnalyticsLoading] = useState(false);
  const [expoRegistrationsId, setExpoRegistrationsId] = useState<string | null>(null);
  const [expoRegistrations, setExpoRegistrations] = useState<MetaExpoRegistration[]>([]);
  const [expoRegistrationsLoading, setExpoRegistrationsLoading] = useState(false);
  const [boothReservationsId, setBoothReservationsId] = useState<string | null>(null);
  const [boothReservations, setBoothReservations] = useState<MetaExpoBoothReservation[]>([]);
  const [boothReservationsLoading, setBoothReservationsLoading] = useState(false);
  const [reservationBusy, setReservationBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const t = {
    title: T ? 'نمایشگاه‌های متاورسی' : 'Metaverse exhibitions',
    subtitle: T ? 'مدیریت سالن‌های سه‌بعدی بر اساس نوع نمایشگاه' : 'Manage 3D halls by exhibition type',
    newExpo: T ? 'نمایشگاه جدید' : 'New exhibition',
    empty: T ? 'در این دسته نمایشگاه فعالی نیست.' : 'No active exhibitions in this category.',
    emptyHint: T ? 'از دکمه «نمایشگاه جدید» استفاده کنید یا در تب بازارچه‌ها برای یک بازارچه نمایشگاه را فعال کنید.' : 'Click “New exhibition” or enable an expo on a bazaar in the Bazaars tab.',
    open: T ? 'پیش‌نمایش ۳D' : '3D preview',
    openMap: T ? 'نقشه رزرو' : 'Reserve map',
    copy: T ? 'کپی لینک' : 'Copy link',
    copyMap: T ? 'کپی لینک نقشه' : 'Copy map link',
    mapLink: T ? 'لینک نقشه رزرو' : 'Reservation map link',
    copied: T ? 'کپی شد ✓' : 'Copied ✓',
    edit: T ? 'مدیریت' : 'Manage',
    duplicate: T ? 'کپی نمایشگاه' : 'Duplicate',
    del: T ? 'حذف بازارچه' : 'Delete bazaar',
    deleteConfirm: T ? 'این بازارچه و نمایشگاهش حذف شود؟' : 'Delete this bazaar and its exhibition?',
    booths: T ? 'غرفه' : 'booths',
    bazaar: T ? 'بازارچه' : 'Bazaar',
    inactive: T ? 'غیرفعال' : 'Inactive',
    report: T ? 'گزارش' : 'Report',
    regReport: T ? 'ثبت‌نام‌های ورودی' : 'Entrance registrations',
    regLoading: T ? 'در حال بارگذاری…' : 'Loading…',
    regEmpty: T ? 'هنوز ثبت‌نامی از گیت ورودی ثبت نشده.' : 'No entrance registrations yet.',
    regExport: T ? 'خروجی اکسل' : 'Export Excel',
    regDate: T ? 'تاریخ' : 'Date',
    regName: T ? 'نام' : 'Name',
    regCompany: T ? 'شرکت' : 'Company',
    regJobTitle: T ? 'سمت' : 'Job title',
    regProduct: T ? 'محصول/خدمت' : 'Product/service',
    regWhatsapp: T ? 'واتساپ' : 'WhatsApp',
    regCity: T ? 'شهر' : 'City',
    regCountry: T ? 'کشور' : 'Country',
    regCount: T ? 'ثبت' : 'entries',
    boothResReport: T ? 'رزرو غرفه‌ها' : 'Booth reservations',
    boothResEmpty: T ? 'هنوز رزرو غرفه‌ای ثبت نشده.' : 'No booth reservations yet.',
    boothResExport: T ? 'خروجی اکسل' : 'Export Excel',
    boothResBooth: T ? 'غرفه' : 'Booth',
    boothResStatus: T ? 'وضعیت' : 'Status',
    boothResPending: T ? 'موقت' : 'Pending',
    boothResConfirmed: T ? 'قطعی' : 'Confirmed',
    boothResCancelled: T ? 'لغو شده' : 'Cancelled',
    boothResConfirm: T ? 'رزرو قطعی' : 'Confirm',
    boothResConfirmHint: T ? 'با قطعی کردن، این شرکت برنده می‌شود و بقیه درخواست‌های موقت همان غرفه لغو می‌شوند.' : 'Confirming picks this company; other pending holds on the same booth are cancelled.',
    boothResCancel: T ? 'لغو رزرو' : 'Cancel',
    boothResAction: T ? 'عملیات' : 'Actions',
    refresh: T ? 'به‌روزرسانی' : 'Refresh',
    back: T ? 'بازگشت' : 'Back',
    count: (n: number) => T ? `${n} مورد` : `${n} items`,
  };

  const expoUrl = (slug: string) => `${shopBaseUrl}?expo=${encodeURIComponent(slug)}`;
  const expoMapUrl = (slug: string) => `${shopBaseUrl}?page=expo-map&bazaar=${encodeURIComponent(slug)}`;
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';

  const uniqueSlug = (base: string, excludeId?: string) => {
    const root = slugify(base);
    let candidate = root;
    let i = 2;
    while (bazaars.some(b => b.id !== excludeId && b.slug === candidate)) {
      candidate = `${root}-${i++}`;
    }
    return candidate;
  };

  const duplicateExpo = async (source: MetaBazaar) => {
    const suffix = T ? 'کپی' : 'Copy';
    const baseName = source.name || (T ? 'نمایشگاه' : 'Exhibition');
    const copyName = `${baseName} ${suffix}`;
    const copy: MetaBazaar = {
      ...cloneJson(source),
      id: `bz-${Date.now()}`,
      name: copyName,
      slug: uniqueSlug(`${source.slug || source.name}-copy`),
      isActive: source.isActive !== false,
      createdAt: new Date().toISOString(),
    };
    if (copy.title) {
      copy.title = {
        fa: copy.title.fa ? `${copy.title.fa} ${suffix}` : undefined,
        en: copy.title.en ? `${copy.title.en} ${suffix}` : undefined,
      };
    }
    if (copy.expo?.title) {
      copy.expo = {
        ...copy.expo,
        title: {
          fa: copy.expo.title.fa ? `${copy.expo.title.fa} ${suffix}` : undefined,
          en: copy.expo.title.en ? `${copy.expo.title.en} ${suffix}` : undefined,
        },
      };
    }
    setSaving(true);
    try {
      await onSave(copy);
      setDraft(copy);
    } catch {
      alert(T ? 'خطا در ساخت کپی نمایشگاه' : 'Failed to duplicate exhibition');
    } finally {
      setSaving(false);
    }
  };

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
    setExpoRegistrationsId(null);
    setBoothReservationsId(null);
    setExpoAnalyticsLoading(true);
    try {
      setExpoAnalyticsEvents(await fetchMetaExpoEvents(bazaar.id));
    } finally {
      setExpoAnalyticsLoading(false);
    }
  };

  const openExpoRegistrations = async (bazaar: MetaBazaar) => {
    setExpoRegistrationsId(bazaar.id);
    setExpoAnalyticsId(null);
    setBoothReservationsId(null);
    setExpoRegistrationsLoading(true);
    try {
      setExpoRegistrations(await fetchMetaExpoRegistrations(bazaar.id));
    } finally {
      setExpoRegistrationsLoading(false);
    }
  };

  const openBoothReservations = async (bazaar: MetaBazaar) => {
    setBoothReservationsId(bazaar.id);
    setExpoAnalyticsId(null);
    setExpoRegistrationsId(null);
    setBoothReservationsLoading(true);
    try {
      setBoothReservations(await fetchMetaExpoBoothReservations(bazaar.id));
    } finally {
      setBoothReservationsLoading(false);
    }
  };

  const setReservationStatus = async (id: string, status: MetaExpoBoothReservation['status']) => {
    setReservationBusy(id);
    try {
      if (status === 'confirmed') {
        await confirmBoothReservation(id);
        const bazaar = bazaars.find(b => b.id === boothReservationsId);
        if (bazaar) await openBoothReservations(bazaar);
        return;
      }
      await updateMetaExpoBoothReservation(id, { status });
      setBoothReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } finally {
      setReservationBusy(null);
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

  if (boothReservationsId) {
    const bazaar = bazaars.find(b => b.id === boothReservationsId);
    const active = boothReservations.filter(r => r.status === 'pending' || r.status === 'confirmed');
    const statusBadge = (s: MetaExpoBoothReservation['status']) => {
      if (s === 'confirmed') return 'bg-emerald-100 text-emerald-800';
      if (s === 'cancelled') return 'bg-gray-100 text-gray-500';
      return 'bg-amber-100 text-amber-800';
    };
    const statusText = (s: MetaExpoBoothReservation['status']) =>
      s === 'confirmed' ? t.boothResConfirmed : s === 'cancelled' ? t.boothResCancelled : t.boothResPending;
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button type="button" onClick={() => setBoothReservationsId(null)} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
          <button type="button" onClick={() => bazaar && openBoothReservations(bazaar)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">↻ {t.refresh}</button>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-bold text-gray-800">{t.boothResReport} — {(T ? bazaar?.expo?.title?.fa || bazaar?.title?.fa : bazaar?.expo?.title?.en || bazaar?.title?.en) || bazaar?.name}</h3>
          <button
            type="button"
            onClick={() => exportBoothReservationsCSV(boothReservations, lang, `booth-reservations-${bazaar?.slug || 'expo'}-${Date.now()}.csv`)}
            disabled={boothReservations.length === 0}
            className="text-xs px-4 py-2 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-40"
          >
            ⬇ {t.boothResExport}
          </button>
        </div>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{t.boothResConfirmHint}</p>
        {boothReservationsLoading ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.regLoading}</div>
        ) : boothReservations.length === 0 ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.boothResEmpty}</div>
        ) : (
          <div className={card + ' overflow-x-auto'}>
            <p className="text-xs text-gray-500 mb-3">
              {active.filter(r => r.status === 'pending').length.toLocaleString()} {T ? 'درخواست موقت' : 'pending'} · {active.filter(r => r.status === 'confirmed').length.toLocaleString()} {T ? 'قطعی' : 'confirmed'} · {boothReservations.length.toLocaleString()} {t.regCount}
            </p>
            <table className="w-full text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="p-2 text-start border-b">{t.regDate}</th>
                  <th className="p-2 text-start border-b">{t.boothResBooth}</th>
                  <th className="p-2 text-start border-b">{t.regName}</th>
                  <th className="p-2 text-start border-b">{t.regCompany}</th>
                  <th className="p-2 text-start border-b">{t.regJobTitle}</th>
                  <th className="p-2 text-start border-b">{t.regProduct}</th>
                  <th className="p-2 text-start border-b">{t.regWhatsapp}</th>
                  <th className="p-2 text-start border-b">{t.boothResStatus}</th>
                  {!readonly && <th className="p-2 text-start border-b">{t.boothResAction}</th>}
                </tr>
              </thead>
              <tbody>
                {boothReservations.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="p-2 whitespace-nowrap" dir="ltr">{new Date(r.timestamp).toLocaleString(T ? 'fa-IR' : 'en-US')}</td>
                    <td className="p-2">{r.boothName || r.boothId}</td>
                    <td className="p-2">{r.firstName} {r.lastName}</td>
                    <td className="p-2">{r.company}</td>
                    <td className="p-2">{r.jobTitle || '—'}</td>
                    <td className="p-2">{r.productService}</td>
                    <td className="p-2 dir-ltr">{r.whatsapp}</td>
                    <td className="p-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge(r.status)}`}>{statusText(r.status)}</span></td>
                    {!readonly && (
                      <td className="p-2 whitespace-nowrap">
                        {r.status === 'pending' && (
                          <div className="flex items-center gap-1.5">
                            <button type="button" disabled={reservationBusy === r.id} onClick={() => setReservationStatus(r.id, 'confirmed')} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">{t.boothResConfirm}</button>
                            <button type="button" disabled={reservationBusy === r.id} onClick={() => setReservationStatus(r.id, 'cancelled')} className="text-[10px] px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">{t.boothResCancel}</button>
                          </div>
                        )}
                        {r.status === 'confirmed' && (
                          <button type="button" disabled={reservationBusy === r.id} onClick={() => setReservationStatus(r.id, 'cancelled')} className="text-[10px] px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">{t.boothResCancel}</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (expoRegistrationsId) {
    const bazaar = bazaars.find(b => b.id === expoRegistrationsId);
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button type="button" onClick={() => setExpoRegistrationsId(null)} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
          <button type="button" onClick={() => bazaar && openExpoRegistrations(bazaar)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">↻ {t.refresh}</button>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-bold text-gray-800">{t.regReport} — {(T ? bazaar?.expo?.title?.fa || bazaar?.title?.fa : bazaar?.expo?.title?.en || bazaar?.title?.en) || bazaar?.name}</h3>
          <button
            type="button"
            onClick={() => exportExpoRegistrationsCSV(expoRegistrations, lang, `expo-registrations-${bazaar?.slug || 'expo'}-${Date.now()}.csv`)}
            disabled={expoRegistrations.length === 0}
            className="text-xs px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40"
          >
            ⬇ {t.regExport}
          </button>
        </div>
        {expoRegistrationsLoading ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.regLoading}</div>
        ) : expoRegistrations.length === 0 ? (
          <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.regEmpty}</div>
        ) : (
          <div className={card + ' overflow-x-auto'}>
            <p className="text-xs text-gray-500 mb-3">{expoRegistrations.length.toLocaleString()} {t.regCount}</p>
            <table className="w-full text-xs border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="p-2 text-start border-b">{t.regDate}</th>
                  <th className="p-2 text-start border-b">{t.regName}</th>
                  <th className="p-2 text-start border-b">{t.regCompany}</th>
                  <th className="p-2 text-start border-b">{t.regJobTitle}</th>
                  <th className="p-2 text-start border-b">{t.regProduct}</th>
                  <th className="p-2 text-start border-b">{t.regWhatsapp}</th>
                  <th className="p-2 text-start border-b">{t.regCity}</th>
                  <th className="p-2 text-start border-b">{t.regCountry}</th>
                </tr>
              </thead>
              <tbody>
                {expoRegistrations.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="p-2 whitespace-nowrap" dir="ltr">{new Date(r.timestamp).toLocaleString(T ? 'fa-IR' : 'en-US')}</td>
                    <td className="p-2">{r.firstName} {r.lastName}</td>
                    <td className="p-2">{r.company}</td>
                    <td className="p-2">{r.jobTitle || '—'}</td>
                    <td className="p-2">{r.productService}</td>
                    <td className="p-2 dir-ltr">{r.whatsapp}</td>
                    <td className="p-2">{r.city}</td>
                    <td className="p-2">{r.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (expoAnalyticsId) {
    const bazaar = bazaars.find(b => b.id === expoAnalyticsId);
    const visits = expoAnalyticsEvents.filter(e => e.type === 'visit');
    return (
      <div className="space-y-4 animate-fade-in">
        <button type="button" onClick={() => setExpoAnalyticsId(null)} className="text-sm text-gray-500 hover:text-gray-800">
          ← {t.back}
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
                  <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-100 rounded-lg px-2 py-1.5 text-[11px] text-amber-800 truncate" dir="ltr">
                    <span className="truncate">?page=expo-map&bazaar={b.slug}</span>
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
                    {b.slug && (
                      <a href={expoMapUrl(b.slug)} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50 flex items-center gap-1" title={t.mapLink}>
                        <IconLayout className="w-3.5 h-3.5" />{t.openMap}
                      </a>
                    )}
                    {b.slug && (
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(expoMapUrl(b.slug)); setCopiedMapId(b.id); setTimeout(() => setCopiedMapId(null), 1800); }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50 flex items-center gap-1"
                        title={t.copyMap}
                      >
                        {copiedMapId === b.id ? t.copied : <><IconCopy className="w-3.5 h-3.5" />{t.copyMap}</>}
                      </button>
                    )}
                    <button type="button" onClick={() => openExpoAnalytics(b)} className="text-xs px-2.5 py-1.5 rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50">{t.report}</button>
                    <button type="button" onClick={() => openExpoRegistrations(b)} className="text-xs px-2.5 py-1.5 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50">{t.regReport}</button>
                    <button type="button" onClick={() => openBoothReservations(b)} className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50">{t.boothResReport}</button>
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => duplicateExpo(b)}
                        disabled={saving}
                        className="text-xs px-2 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-50 flex items-center gap-1"
                        title={t.duplicate}
                      >
                        <IconCopy className="w-3.5 h-3.5" />{t.duplicate}
                      </button>
                    )}
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
