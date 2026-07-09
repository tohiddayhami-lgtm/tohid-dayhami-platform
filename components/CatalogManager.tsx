import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CatalogArea,
  CatalogService,
  CatalogStatus,
  CompanyCatalog,
  Personnel,
} from '../types';
import { Language } from '../App';
import {
  subscribeToCatalogs,
  saveCatalogToCloud,
  deleteCatalogFromCloud,
  uploadFileWithProgress,
} from '../services/firebaseService';
import {
  emptyCatalog,
  exportCatalogEnvelope,
  parseCatalogJson,
  catalogDisplayName,
  genCatalogRefNo,
  buildCatalogSampleEnvelope,
  downloadCatalogJson,
} from '../utils/catalogFormat';
import { exportPdfFromPreviewElement } from '../utils/exportCatalogPdf';
import { BILINGUAL_DOC_CSS } from '../utils/bilingualDocCss';
import { IconPlus, IconTrash, IconEdit, IconPrinter, IconUpload, IconSearch, IconCheck } from './Icons';

interface Props {
  currentUser: Personnel;
  lang: Language;
  readonly?: boolean;
}

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const logoH = (size?: string) => (size === 'lg' ? 56 : size === 'sm' ? 36 : 46);
const linesToArr = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
const arrToLines = (a: string[]) => a.join('\n');

export const CatalogManager: React.FC<Props> = ({ currentUser, lang, readonly }) => {
  const T = lang === 'fa';
  const [list, setList] = useState<CompanyCatalog[]>([]);
  const [mode, setMode] = useState<'list' | 'editor' | 'preview'>('list');
  const [draft, setDraft] = useState<CompanyCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState<1 | 2 | null>(null);
  const [importErr, setImportErr] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logo1Ref = useRef<HTMLInputElement>(null);
  const logo2Ref = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToCatalogs(setList);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      c.refNo.toLowerCase().includes(q)
      || c.titleEn.toLowerCase().includes(q)
      || c.titleRtl.includes(q)
      || catalogDisplayName(c).toLowerCase().includes(q),
    );
  }, [list, search]);

  const startNew = () => { setDraft(emptyCatalog(currentUser)); setMode('editor'); setImportErr(''); };
  const startEdit = (c: CompanyCatalog) => { setDraft(JSON.parse(JSON.stringify(c))); setMode('editor'); setImportErr(''); };

  const save = async () => {
    if (!draft || readonly) return;
    setSaving(true);
    try {
      const payload: CompanyCatalog = {
        ...draft,
        updatedAt: new Date().toISOString(),
        createdBy: draft.createdBy || currentUser.fullName,
        createdByPersonnelId: draft.createdByPersonnelId || currentUser.id,
      };
      await saveCatalogToCloud(payload, currentUser);
      setDraft(payload);
      setMode('list');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (readonly) return;
    if (!confirm(T ? 'این کاتالوگ حذف شود؟' : 'Delete this catalog?')) return;
    await deleteCatalogFromCloud(id, currentUser);
  };

  const importJson = (file: File) => {
    setImportErr('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const catalog = parseCatalogJson(parsed, currentUser);
        catalog.id = `cat-${Date.now()}`;
        catalog.createdAt = new Date().toISOString();
        catalog.updatedAt = catalog.createdAt;
        setDraft(catalog);
        setMode('editor');
      } catch {
        setImportErr(T ? 'فایل JSON نامعتبر است. فرمت سمپل کاتالوگ را رعایت کنید.' : 'Invalid JSON. Use the sample catalog format.');
      }
    };
    reader.readAsText(file);
  };

  const downloadSample = () => downloadCatalogJson(buildCatalogSampleEnvelope(), 'services_catalog.json');
  const exportCurrent = () => {
    if (!draft) return;
    downloadCatalogJson(exportCatalogEnvelope(draft), `catalog_${draft.refNo}.json`);
  };

  const uploadLogo = (slot: 1 | 2, file: File) => {
    if (!draft) return;
    setLogoBusy(slot);
    uploadFileWithProgress(file, () => {}, url => {
      setDraft(d => d ? { ...d, [slot === 1 ? 'logoUrl' : 'logo2Url']: url } : d);
      setLogoBusy(null);
    }, err => { alert(err.message); setLogoBusy(null); }, 'images');
  };

  const upd = (patch: Partial<CompanyCatalog>) => setDraft(d => d ? { ...d, ...patch } : d);

  const updArea = (idx: number, patch: Partial<CatalogArea>) => {
    setDraft(d => {
      if (!d) return d;
      const areas = [...d.areas];
      areas[idx] = { ...areas[idx], ...patch };
      return { ...d, areas };
    });
  };

  const updService = (areaIdx: number, svcIdx: number, patch: Partial<CatalogService>) => {
    setDraft(d => {
      if (!d) return d;
      const areas = [...d.areas];
      const services = [...areas[areaIdx].services];
      services[svcIdx] = { ...services[svcIdx], ...patch };
      areas[areaIdx] = { ...areas[areaIdx], services };
      return { ...d, areas };
    });
  };

  const statusLabel = (s: CatalogStatus) =>
    ({ draft: T ? 'پیش‌نویس' : 'Draft', published: T ? 'منتشر شده' : 'Published' })[s];
  const statusCls = (s: CatalogStatus) =>
    ({ draft: 'bg-gray-100 text-gray-600', published: 'bg-emerald-100 text-emerald-700' })[s];

  const downloadPdf = async () => {
    if (!draft || pdfBusy) return;
    if (!printRef.current) {
      alert(T ? 'ابتدا پیش‌نمایش را باز کنید.' : 'Open preview first.');
      return;
    }
    setPdfBusy(true);
    try {
      await exportPdfFromPreviewElement(printRef.current, `catalog_${draft.refNo || 'draft'}.pdf`);
    } catch (e) {
      console.error(e);
      alert(T ? 'ساخت PDF ناموفق بود. دوباره تلاش کنید.' : 'PDF export failed. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-800/20';
  const label = 'block text-xs font-bold text-gray-500 mb-1';
  const ta = `${field} min-h-[80px] resize-y`;

  const fmtDateLong = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  };

  const PreviewDoc = ({ c }: { c: CompanyCatalog }) => {
    const h = logoH(c.contractLogoSize);
    const langLabel = c.languages.join(' / ').toUpperCase();
    const contactLine = [c.contact.email, c.contact.phone, c.contact.website, c.contact.location].filter(Boolean).join(' · ');

    return (
      <div className="pp-root" ref={printRef} dir="ltr" lang="en">
        <style>{BILINGUAL_DOC_CSS}</style>
        {(c.logoUrl || c.logo2Url) && (
          <div className={`pp-logos ${c.contractLogoAlign === 'center' ? 'center' : ''}`}>
            {c.logoUrl ? <img src={c.logoUrl} alt="" style={{ height: h }} /> : <span />}
            {c.logo2Url ? <img src={c.logo2Url} alt="" style={{ height: h }} /> : <span />}
          </div>
        )}
        <div className="pp-title-block">
          <h1 className="en-title" dir="ltr">{c.titleEn}</h1>
          {c.titleRtl && <h2 className="rtl-title" dir="rtl">{c.titleRtl}</h2>}
          {c.subtitleEn && <div className="en-sub" dir="ltr">{c.subtitleEn}</div>}
          {c.subtitleRtl && <div className="rtl-sub" dir="rtl">{c.subtitleRtl}</div>}
        </div>
        <div className="pp-meta-bar">
          <span>Ref. {c.refNo}</span><span>|</span>
          <span>Date: {fmtDateLong(c.catalogDate)}</span><span>|</span>
          <span>Languages: {langLabel}</span>
        </div>
        <div className="pp-meta-sub">Catalog date: {c.catalogDate} &nbsp;|&nbsp; Ref: {c.refNo} &nbsp;|&nbsp; Status: {c.status}</div>

        <div className="pp-band"><div className="l" dir="ltr">{c.company.labelEn}</div><div className="r" dir="rtl">{c.company.labelRtl}</div></div>
        <div className="pp-company-block">
          <div className="co" dir="ltr">{c.company.companyEn}</div>
          {c.company.regNo && <div className="row">{c.company.regNo}</div>}
          {c.company.country && <div className="row">{c.company.country}</div>}
          {(c.company.repNameEn || c.company.repTitleEn) && (
            <div className="row">{c.company.repNameEn}{c.company.repTitleEn ? ` — ${c.company.repTitleEn}` : ''}</div>
          )}
          {[c.company.contactEmail, c.company.contactPhone, c.company.website].filter(Boolean).length > 0 && (
            <div className="row">{[c.company.contactEmail, c.company.contactPhone, c.company.website].filter(Boolean).join(' · ')}</div>
          )}
          {c.company.companyRtl && <div className="co-rtl" dir="rtl">{c.company.companyRtl}</div>}
          {c.company.repNameRtl && <div className="row-rtl" dir="rtl">{c.company.repNameRtl}{c.company.repTitleRtl ? ` — ${c.company.repTitleRtl}` : ''}</div>}
        </div>

        <div className="pp-section">
          <div className="pp-band"><div className="l" dir="ltr">{c.intro.titleEn || c.intro.sectionNum}</div><div className="r" dir="rtl">{c.intro.titleRtl}</div></div>
          {c.intro.contentEn && <div className="pp-body-en" dir="ltr">{c.intro.contentEn}</div>}
          {c.intro.contentRtl && <div className="pp-body-rtl" dir="rtl">{c.intro.contentRtl}</div>}
        </div>

        {c.areas.map(area => (
          <div key={area.id} className="pp-section">
            <div className="pp-band">
              <div className="l" dir="ltr">{area.areaNum}. {area.areaTitleEn}</div>
              <div className="r" dir="rtl">{area.areaTitleRtl}</div>
            </div>
            {area.areaIntroEn && <div className="pp-area-intro-en" dir="ltr">{area.areaIntroEn}</div>}
            {area.areaIntroRtl && <div className="pp-area-intro-rtl" dir="rtl">{area.areaIntroRtl}</div>}
            {area.services.map(svc => (
              <div key={svc.id} className="pp-service-card">
                <div className="svc-num">{svc.serviceNum}</div>
                <div className="svc-title-en" dir="ltr">{svc.titleEn}</div>
                {svc.titleRtl && <div className="svc-title-rtl" dir="rtl">{svc.titleRtl}</div>}
                {svc.descEn && <div className="pp-body-en" dir="ltr" style={{ padding: '6px 0' }}>{svc.descEn}</div>}
                {svc.descRtl && <div className="pp-body-rtl" dir="rtl">{svc.descRtl}</div>}
                {svc.forEn && <div className="for-en" dir="ltr"><b>Ideal for:</b> {svc.forEn}</div>}
                {svc.forRtl && <div className="for-rtl" dir="rtl"><b>مناسب برای:</b> {svc.forRtl}</div>}
              </div>
            ))}
          </div>
        ))}

        <div className="pp-section">
          <div className="pp-band"><div className="l" dir="ltr">{c.howWeWork.titleEn}</div><div className="r" dir="rtl">{c.howWeWork.titleRtl}</div></div>
          {c.howWeWork.pointsEn.map((p, i) => <div key={`en-${i}`} className="pp-bullet-en" dir="ltr">• {p}</div>)}
          {c.howWeWork.pointsRtl.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {c.howWeWork.pointsRtl.map((p, i) => <div key={`rtl-${i}`} className="pp-bullet-rtl" dir="rtl">• {p}</div>)}
            </div>
          )}
        </div>

        <div className="pp-section">
          <div className="pp-band"><div className="l" dir="ltr">{c.contact.titleEn}</div><div className="r" dir="rtl">{c.contact.titleRtl}</div></div>
          {c.contact.contentEn && <div className="pp-body-en" dir="ltr">{c.contact.contentEn}</div>}
          {c.contact.contentRtl && <div className="pp-body-rtl" dir="rtl">{c.contact.contentRtl}</div>}
          {contactLine && <div className="pp-contact-line" dir="ltr">{contactLine}</div>}
        </div>

        <div className="pp-foot">
          <div className="co">{c.companyName || 'Services Catalog'}</div>
          <div className="en">This document is a services catalog for reference. Pricing and scope are confirmed in proposals and contracts.</div>
          <div className="rtl" dir="rtl">این سند کاتالوگ خدمات برای مرجع است. قیمت و دامنه در پروپوزال و قرارداد تأیید می‌شود.</div>
        </div>
      </div>
    );
  };

  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{T ? 'کاتالوگ شرکت' : 'Company Catalog'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {T ? 'دوزبانه (EN + فارسی/عربی) — معرفی خدمات، حوزه‌ها، ایمپورت JSON، خروجی PDF' : 'Bilingual (EN + FA/AR) — services, areas, AI JSON import, PDF export'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadSample} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              {T ? 'دانلود سمپل JSON' : 'Download sample JSON'}
            </button>
            {!readonly && (
              <>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1">
                  <IconUpload className="w-3.5 h-3.5" />{T ? 'آپلود JSON' : 'Upload JSON'}
                </button>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
                <button type="button" onClick={startNew} className="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1">
                  <IconPlus className="w-3.5 h-3.5" />{T ? 'کاتالوگ جدید' : 'New catalog'}
                </button>
              </>
            )}
          </div>
        </div>
        {importErr && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{importErr}</p>}
        <div className="relative max-w-md">
          <IconSearch className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={T ? 'جستجو شماره، عنوان…' : 'Search ref, title…'} className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
        </div>
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-16 text-center text-sm text-gray-400">
            {list.length === 0 ? (T ? 'هنوز کاتالوگی ثبت نشده.' : 'No catalogs yet.') : (T ? 'نتیجه‌ای نیست.' : 'No matches.')}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="p-3 text-start">Ref</th>
                  <th className="p-3 text-start">{T ? 'عنوان' : 'Title'}</th>
                  <th className="p-3 text-center">{T ? 'تاریخ' : 'Date'}</th>
                  <th className="p-3 text-center">{T ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3 text-end">{T ? 'اقدام' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="p-3 font-mono text-xs" dir="ltr">{c.refNo}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900">{c.titleEn}</div>
                      {c.titleRtl && <div className="text-xs text-gray-500" dir="rtl">{c.titleRtl}</div>}
                    </td>
                    <td className="p-3 text-xs text-gray-500 text-center whitespace-nowrap" dir="ltr">{c.catalogDate}</td>
                    <td className="p-3 text-center"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusCls(c.status)}`}>{statusLabel(c.status)}</span></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => { setDraft(c); setMode('preview'); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><IconPrinter className="w-4 h-4" /></button>
                        {!readonly && <button type="button" onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><IconEdit className="w-4 h-4" /></button>}
                        {!readonly && <button type="button" onClick={() => void remove(c.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (!draft) return null;

  if (mode === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 sticky top-0 bg-gray-50/90 backdrop-blur z-10 py-2">
          <button type="button" onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {T ? 'بازگشت' : 'Back'}</button>
          <div className="flex gap-2">
            {!readonly && <button type="button" onClick={() => setMode('editor')} className="text-xs px-3 py-2 rounded-lg border border-gray-200">{T ? 'ویرایش' : 'Edit'}</button>}
            <button type="button" onClick={exportCurrent} className="text-xs px-3 py-2 rounded-lg border border-gray-200">JSON</button>
            <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} className="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-1 disabled:opacity-50">
              <IconPrinter className="w-3.5 h-3.5" />{pdfBusy ? (T ? 'در حال ساخت PDF…' : 'Building PDF…') : (T ? 'دانلود PDF' : 'Download PDF')}
            </button>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 md:p-10">
          <PreviewDoc c={draft} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2 sticky top-0 bg-gray-50/90 backdrop-blur z-10 py-2">
        <button type="button" onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {T ? 'بازگشت' : 'Back'}</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCurrent} className="text-xs px-3 py-2 rounded-lg border border-gray-200">JSON</button>
          <button type="button" onClick={() => setMode('preview')} className="text-xs px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-1"><IconPrinter className="w-3.5 h-3.5" />{T ? 'پیش‌نمایش' : 'Preview'}</button>
          {!readonly && (
            <button type="button" onClick={() => void save()} disabled={saving} className="text-xs px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
              <IconCheck className="w-3.5 h-3.5" />{saving ? '…' : (T ? 'ذخیره' : 'Save')}
            </button>
          )}
        </div>
      </div>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'اطلاعات کلی' : 'Header'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={label}>Ref No.</label>
            <div className="flex gap-2">
              <input className={field} dir="ltr" value={draft.refNo} onChange={e => upd({ refNo: e.target.value })} />
              <button type="button" className="text-xs px-2 border rounded-lg" onClick={() => upd({ refNo: genCatalogRefNo() })}>{T ? 'جدید' : 'New'}</button>
            </div>
          </div>
          <div>
            <label className={label}>{T ? 'تاریخ کاتالوگ' : 'Catalog date'}</label>
            <input type="date" className={field} value={draft.catalogDate} onChange={e => upd({ catalogDate: e.target.value })} />
          </div>
          <div>
            <label className={label}>{T ? 'وضعیت' : 'Status'}</label>
            <select className={field} value={draft.status} onChange={e => upd({ status: e.target.value as CatalogStatus })}>
              {(['draft', 'published'] as CatalogStatus[]).map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{T ? 'زبان RTL' : 'RTL language'}</label>
            <select className={field} value={draft.rtlLanguage} onChange={e => upd({ rtlLanguage: e.target.value as 'fa' | 'ar' })}>
              <option value="fa">فارسی</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={label}>{T ? 'زبان‌ها (با کاما)' : 'Languages (comma-separated)'}</label>
            <input className={field} dir="ltr" value={draft.languages.join(', ')} onChange={e => upd({ languages: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} />
          </div>
          <div><label className={label}>Title (EN)</label><input className={field} value={draft.titleEn} onChange={e => upd({ titleEn: e.target.value })} /></div>
          <div><label className={label}>عنوان (RTL)</label><input className={field} dir="rtl" value={draft.titleRtl} onChange={e => upd({ titleRtl: e.target.value })} /></div>
          <div><label className={label}>Subtitle (EN)</label><input className={field} value={draft.subtitleEn || ''} onChange={e => upd({ subtitleEn: e.target.value })} /></div>
          <div><label className={label}>زیرعنوان (RTL)</label><input className={field} dir="rtl" value={draft.subtitleRtl || ''} onChange={e => upd({ subtitleRtl: e.target.value })} /></div>
          <div className="md:col-span-3">
            <label className={label}>{T ? 'نام شرکت (فوتر)' : 'Company name (footer)'}</label>
            <input className={field} value={draft.companyName || ''} onChange={e => upd({ companyName: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'لوگوها' : 'Logos'}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(slot => {
            const url = slot === 1 ? draft.logoUrl : draft.logo2Url;
            const busy = logoBusy === slot;
            return (
              <div key={slot}>
                <label className={label}>{T ? `لوگو ${slot}` : `Logo ${slot}`}</label>
                <button type="button" onClick={() => (slot === 1 ? logo1Ref : logo2Ref).current?.click()} className="w-full h-28 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 hover:bg-gray-100 overflow-hidden">
                  {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain p-2" /> : (
                    <span className="text-xs text-gray-400 flex flex-col items-center gap-1"><IconUpload className="w-5 h-5" />{busy ? '…' : (T ? 'آپلود لوگو' : 'Upload logo')}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <input ref={logo1Ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(1, f); e.target.value = ''; }} />
        <input ref={logo2Ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(2, f); e.target.value = ''; }} />
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'درباره شرکت' : 'Company block'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className={label}>Label (EN)</label><input className={field} value={draft.company.labelEn} onChange={e => upd({ company: { ...draft.company, labelEn: e.target.value } })} /></div>
          <div><label className={label}>برچسب (RTL)</label><input className={field} dir="rtl" value={draft.company.labelRtl} onChange={e => upd({ company: { ...draft.company, labelRtl: e.target.value } })} /></div>
          <div><label className={label}>Company (EN)</label><input className={field} value={draft.company.companyEn} onChange={e => upd({ company: { ...draft.company, companyEn: e.target.value } })} /></div>
          <div><label className={label}>شرکت (RTL)</label><input className={field} dir="rtl" value={draft.company.companyRtl} onChange={e => upd({ company: { ...draft.company, companyRtl: e.target.value } })} /></div>
          <div><label className={label}>Reg No.</label><input className={field} value={draft.company.regNo || ''} onChange={e => upd({ company: { ...draft.company, regNo: e.target.value } })} /></div>
          <div><label className={label}>Country / Location</label><input className={field} value={draft.company.country || ''} onChange={e => upd({ company: { ...draft.company, country: e.target.value } })} /></div>
          <div><label className={label}>Rep (EN)</label><input className={field} value={draft.company.repNameEn || ''} onChange={e => upd({ company: { ...draft.company, repNameEn: e.target.value } })} /></div>
          <div><label className={label}>نماینده (RTL)</label><input className={field} dir="rtl" value={draft.company.repNameRtl || ''} onChange={e => upd({ company: { ...draft.company, repNameRtl: e.target.value } })} /></div>
          <div><label className={label}>Email</label><input className={field} dir="ltr" value={draft.company.contactEmail || ''} onChange={e => upd({ company: { ...draft.company, contactEmail: e.target.value } })} /></div>
          <div><label className={label}>Phone / Website</label>
            <div className="flex gap-2">
              <input className={field} dir="ltr" value={draft.company.contactPhone || ''} onChange={e => upd({ company: { ...draft.company, contactPhone: e.target.value } })} placeholder="Phone" />
              <input className={field} dir="ltr" value={draft.company.website || ''} onChange={e => upd({ company: { ...draft.company, website: e.target.value } })} placeholder="Website" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'مقدمه / درباره ما' : 'Introduction'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className={label}>Title (EN)</label><input className={field} value={draft.intro.titleEn} onChange={e => upd({ intro: { ...draft.intro, titleEn: e.target.value } })} /></div>
          <div><label className={label}>عنوان (RTL)</label><input className={field} dir="rtl" value={draft.intro.titleRtl} onChange={e => upd({ intro: { ...draft.intro, titleRtl: e.target.value } })} /></div>
          <div className="md:col-span-2"><label className={label}>Content (EN)</label><textarea className={ta} value={draft.intro.contentEn} onChange={e => upd({ intro: { ...draft.intro, contentEn: e.target.value } })} /></div>
          <div className="md:col-span-2"><label className={label}>متن (RTL)</label><textarea className={ta} dir="rtl" value={draft.intro.contentRtl} onChange={e => upd({ intro: { ...draft.intro, contentRtl: e.target.value } })} /></div>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'حوزه‌های خدمات' : 'Service areas'}</h4>
          {!readonly && (
            <button type="button" onClick={() => upd({ areas: [...draft.areas, { id: uid('area'), areaNum: String(draft.areas.length + 1), areaTitleEn: '', areaTitleRtl: '', areaIntroEn: '', areaIntroRtl: '', services: [] }] })} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-1">
              <IconPlus className="w-3.5 h-3.5" />{T ? 'حوزه جدید' : 'Add area'}
            </button>
          )}
        </div>
        {draft.areas.map((area, ai) => (
          <div key={area.id} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs font-bold text-gray-400">{T ? 'حوزه' : 'Area'} {area.areaNum}</span>
              {!readonly && draft.areas.length > 0 && (
                <button type="button" className="text-red-400 p-1" onClick={() => upd({ areas: draft.areas.filter((_, i) => i !== ai) })}><IconTrash className="w-4 h-4" /></button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className={label}>#</label><input className={field} value={area.areaNum} onChange={e => updArea(ai, { areaNum: e.target.value })} /></div>
              <div><label className={label}>Title (EN)</label><input className={field} value={area.areaTitleEn} onChange={e => updArea(ai, { areaTitleEn: e.target.value })} /></div>
              <div><label className={label}>عنوان (RTL)</label><input className={field} dir="rtl" value={area.areaTitleRtl} onChange={e => updArea(ai, { areaTitleRtl: e.target.value })} /></div>
              <div className="md:col-span-3"><label className={label}>Intro (EN)</label><textarea className={ta} rows={2} value={area.areaIntroEn || ''} onChange={e => updArea(ai, { areaIntroEn: e.target.value })} /></div>
              <div className="md:col-span-3"><label className={label}>مقدمه (RTL)</label><textarea className={ta} dir="rtl" rows={2} value={area.areaIntroRtl || ''} onChange={e => updArea(ai, { areaIntroRtl: e.target.value })} /></div>
            </div>
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600">{T ? 'خدمات' : 'Services'}</span>
                {!readonly && (
                  <button type="button" onClick={() => updArea(ai, { services: [...area.services, { id: uid('svc'), serviceNum: `${area.areaNum}.${area.services.length + 1}`, titleEn: '', titleRtl: '', descEn: '', descRtl: '' }] })} className="text-xs text-indigo-600">{T ? '+ خدمت' : '+ Service'}</button>
                )}
              </div>
              {area.services.map((svc, si) => (
                <div key={svc.id} className="bg-white border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <input className="w-20 border rounded px-2 py-1 text-xs" value={svc.serviceNum} onChange={e => updService(ai, si, { serviceNum: e.target.value })} />
                    {!readonly && <button type="button" className="text-red-400" onClick={() => updArea(ai, { services: area.services.filter((_, i) => i !== si) })}><IconTrash className="w-3.5 h-3.5" /></button>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input className={field} placeholder="Title EN" value={svc.titleEn} onChange={e => updService(ai, si, { titleEn: e.target.value })} />
                    <input className={field} dir="rtl" placeholder="عنوان RTL" value={svc.titleRtl} onChange={e => updService(ai, si, { titleRtl: e.target.value })} />
                    <textarea className={ta} rows={3} placeholder="Description EN" value={svc.descEn} onChange={e => updService(ai, si, { descEn: e.target.value })} />
                    <textarea className={ta} dir="rtl" rows={3} placeholder="توضیح RTL" value={svc.descRtl} onChange={e => updService(ai, si, { descRtl: e.target.value })} />
                    <input className={field} placeholder="Ideal for (EN)" value={svc.forEn || ''} onChange={e => updService(ai, si, { forEn: e.target.value })} />
                    <input className={field} dir="rtl" placeholder="مناسب برای (RTL)" value={svc.forRtl || ''} onChange={e => updService(ai, si, { forRtl: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'چگونه کار می‌کنیم' : 'How we work'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2"><label className={label}>Points (EN) — one per line</label><textarea className={ta} rows={6} value={arrToLines(draft.howWeWork.pointsEn)} onChange={e => upd({ howWeWork: { ...draft.howWeWork, pointsEn: linesToArr(e.target.value) } })} /></div>
          <div className="md:col-span-2"><label className={label}>نکات (RTL) — هر خط یک مورد</label><textarea className={ta} dir="rtl" rows={6} value={arrToLines(draft.howWeWork.pointsRtl)} onChange={e => upd({ howWeWork: { ...draft.howWeWork, pointsRtl: linesToArr(e.target.value) } })} /></div>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'تماس' : 'Contact'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className={label}>Title (EN)</label><input className={field} value={draft.contact.titleEn} onChange={e => upd({ contact: { ...draft.contact, titleEn: e.target.value } })} /></div>
          <div><label className={label}>عنوان (RTL)</label><input className={field} dir="rtl" value={draft.contact.titleRtl} onChange={e => upd({ contact: { ...draft.contact, titleRtl: e.target.value } })} /></div>
          <div className="md:col-span-2"><label className={label}>Content (EN)</label><textarea className={ta} value={draft.contact.contentEn || ''} onChange={e => upd({ contact: { ...draft.contact, contentEn: e.target.value } })} /></div>
          <div className="md:col-span-2"><label className={label}>متن (RTL)</label><textarea className={ta} dir="rtl" value={draft.contact.contentRtl || ''} onChange={e => upd({ contact: { ...draft.contact, contentRtl: e.target.value } })} /></div>
          <div><label className={label}>Email</label><input className={field} dir="ltr" value={draft.contact.email || ''} onChange={e => upd({ contact: { ...draft.contact, email: e.target.value } })} /></div>
          <div><label className={label}>Phone</label><input className={field} dir="ltr" value={draft.contact.phone || ''} onChange={e => upd({ contact: { ...draft.contact, phone: e.target.value } })} /></div>
          <div><label className={label}>Website</label><input className={field} dir="ltr" value={draft.contact.website || ''} onChange={e => upd({ contact: { ...draft.contact, website: e.target.value } })} /></div>
          <div><label className={label}>Location</label><input className={field} value={draft.contact.location || ''} onChange={e => upd({ contact: { ...draft.contact, location: e.target.value } })} /></div>
        </div>
      </section>
    </div>
  );
};
