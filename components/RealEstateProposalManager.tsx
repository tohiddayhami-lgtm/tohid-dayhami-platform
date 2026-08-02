import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Personnel,
  RealEstateDealType,
  RealEstateProposal,
  RealEstateProposalPhoto,
  RealEstateProposalStatus,
  RealEstatePropertyHighlight,
} from '../types';
import { Language } from '../App';
import {
  subscribeToRealEstateProposals,
  saveRealEstateProposalToCloud,
  deleteRealEstateProposalFromCloud,
  uploadFileWithProgress,
} from '../services/firebaseService';
import {
  emptyRealEstateProposal,
  exportRealEstateProposalEnvelope,
  parseRealEstateProposalJson,
  realEstateProposalClientName,
  genRealEstateProposalRefNo,
  buildRealEstateProposalSampleEnvelope,
  downloadRealEstateProposalJson,
  dealTypeLabel,
  RE_DEAL_TYPES,
} from '../utils/realEstateProposalFormat';
import { exportPdfFromPreviewElement } from '../utils/exportPreviewPdf';
import { exportRealEstateProposalWord } from '../utils/exportRealEstateProposalWord';
import { BilingualPrintPreview } from './BilingualPrintPreview';
import type { PrintSectionRef } from './BilingualPrintPreview';
import { IconPlus, IconTrash, IconEdit, IconPrinter, IconUpload, IconSearch, IconCheck, IconImage } from './Icons';

interface Props {
  currentUser: Personnel;
  lang: Language;
  readonly?: boolean;
}

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const logoH = (size?: string) => (size === 'lg' ? 56 : size === 'sm' ? 36 : 46);
const linesToArr = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
const arrToLines = (a?: string[]) => (a || []).join('\n');

export const RealEstateProposalManager: React.FC<Props> = ({ currentUser, lang, readonly }) => {
  const T = lang === 'fa';
  const [list, setList] = useState<RealEstateProposal[]>([]);
  const [mode, setMode] = useState<'list' | 'editor' | 'preview'>('list');
  const [draft, setDraft] = useState<RealEstateProposal | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState<1 | 2 | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [importErr, setImportErr] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logo1Ref = useRef<HTMLInputElement>(null);
  const logo2Ref = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToRealEstateProposals(setList);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      p.refNo.toLowerCase().includes(q)
      || p.titleEn.toLowerCase().includes(q)
      || p.titleRtl.includes(q)
      || (p.property.titleEn || '').toLowerCase().includes(q)
      || (p.property.city || '').toLowerCase().includes(q)
      || realEstateProposalClientName(p).toLowerCase().includes(q),
    );
  }, [list, search]);

  const upd = (patch: Partial<RealEstateProposal>) => setDraft(d => d ? { ...d, ...patch } : d);
  const updProp = (patch: Partial<RealEstatePropertyHighlight>) =>
    setDraft(d => d ? { ...d, property: { ...d.property, ...patch } } : d);

  const startNew = () => { setDraft(emptyRealEstateProposal(currentUser)); setMode('editor'); setImportErr(''); };
  const startEdit = (p: RealEstateProposal) => { setDraft(JSON.parse(JSON.stringify(p))); setMode('editor'); setImportErr(''); };

  const save = async () => {
    if (!draft || readonly) return;
    setSaving(true);
    try {
      const payload: RealEstateProposal = {
        ...draft,
        updatedAt: new Date().toISOString(),
        createdBy: draft.createdBy || currentUser.fullName,
        createdByPersonnelId: draft.createdByPersonnelId || currentUser.id,
      };
      await saveRealEstateProposalToCloud(payload, currentUser);
      setDraft(payload);
      setMode('list');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (readonly) return;
    if (!confirm(T ? 'این پروپوزال املاک حذف شود؟' : 'Delete this real-estate proposal?')) return;
    await deleteRealEstateProposalFromCloud(id, currentUser);
  };

  const importJson = (file: File) => {
    setImportErr('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const proposal = parseRealEstateProposalJson(parsed, currentUser);
        setDraft(proposal);
        setMode('editor');
      } catch {
        setImportErr(T ? 'فایل JSON نامعتبر است. فرمت سمپل را رعایت کنید.' : 'Invalid JSON. Use the sample format.');
      }
    };
    reader.readAsText(file);
  };

  const downloadSample = () => downloadRealEstateProposalJson(buildRealEstateProposalSampleEnvelope(), 'real_estate_proposal_sample.json');
  const exportCurrent = () => {
    if (!draft) return;
    downloadRealEstateProposalJson(exportRealEstateProposalEnvelope(draft), `re_proposal_${draft.refNo}.json`);
  };

  const uploadLogo = (slot: 1 | 2, file: File) => {
    if (!draft) return;
    setLogoBusy(slot);
    uploadFileWithProgress(file, () => {}, url => {
      setDraft(d => d ? { ...d, [slot === 1 ? 'logoUrl' : 'logo2Url']: url } : d);
      setLogoBusy(null);
    }, () => setLogoBusy(null), 'images');
  };

  const uploadPhotos = (files: FileList | null) => {
    if (!files?.length || !draft || readonly) return;
    const listFiles = Array.from(files).slice(0, 12);
    setPhotoBusy(true);
    let remaining = listFiles.length;
    listFiles.forEach(file => {
      uploadFileWithProgress(file, () => {}, url => {
        const photo: RealEstateProposalPhoto = { id: uid('ph'), url, captionEn: '', captionRtl: '' };
        setDraft(d => d ? { ...d, photos: [...d.photos, photo] } : d);
        remaining -= 1;
        if (remaining <= 0) setPhotoBusy(false);
      }, () => {
        remaining -= 1;
        if (remaining <= 0) setPhotoBusy(false);
      }, 'images');
    });
  };

  const downloadPdf = async () => {
    if (!draft || pdfBusy) return;
    if (!printRef.current) {
      alert(T ? 'پیش‌نمایش آماده نیست.' : 'Preview not ready.');
      return;
    }
    setPdfBusy(true);
    try {
      await exportPdfFromPreviewElement(printRef.current, `re_proposal_${draft.refNo || 'draft'}.pdf`);
    } catch (e) {
      console.error(e);
      alert(T ? 'ساخت PDF ناموفق بود.' : 'PDF export failed.');
    } finally {
      setPdfBusy(false);
    }
  };

  const statusLabel = (s: RealEstateProposalStatus) =>
    ({ draft: T ? 'پیش‌نویس' : 'Draft', sent: T ? 'ارسال‌شده' : 'Sent', accepted: T ? 'پذیرفته' : 'Accepted', declined: T ? 'رد شده' : 'Declined' })[s];
  const statusCls = (s: RealEstateProposalStatus) =>
    ({ draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-emerald-100 text-emerald-700', declined: 'bg-red-100 text-red-600' })[s];

  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-800/20';
  const label = 'block text-xs font-bold text-gray-500 mb-1';
  const ta = `${field} min-h-[90px] resize-y`;

  const fmtDateLong = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  };

  const partyBlock = (party: RealEstateProposal['parties'][0], index: number) => (
    <td key={party.id}>
      <div className="en-block">
        <div className="num">{index + 1}. {party.labelEn}</div>
        <div className="co">{party.companyEn || '—'}</div>
        {party.regNo && <div className="row">CR: {party.regNo}</div>}
        {party.country && <div className="row">{party.country}</div>}
        {party.repNameEn && <div className="row" style={{ marginTop: 6 }}>{party.repNameEn}</div>}
        {party.repTitleEn && <div className="row">{party.repTitleEn}</div>}
        {party.contactPhone && <div className="row">{party.contactPhone}</div>}
        {party.contactEmail && <div className="row">{party.contactEmail}</div>}
      </div>
      {(party.companyRtl || party.labelRtl) && (
        <div className="rtl-block" dir="rtl">
          <div className="num-rtl">{index + 1}. {party.labelRtl}</div>
          {party.companyRtl && <div className="co-rtl">{party.companyRtl}</div>}
          {party.repNameRtl && <div className="row-rtl">{party.repNameRtl}</div>}
          {party.repTitleRtl && <div className="row-rtl">{party.repTitleRtl}</div>}
        </div>
      )}
    </td>
  );

  const PreviewDoc = ({ p, pageBreakBefore }: { p: RealEstateProposal; pageBreakBefore?: string[] }) => {
    const h = logoH(p.contractLogoSize);
    const prop = p.property;
    const brk = (id: string) => (pageBreakBefore?.includes(id) ? ' pp-force-page-break' : '');
    const cur = prop.currency || p.currency || 'OMR';
    const facts = [
      prop.areaSqm && `${prop.areaSqm} sqm`,
      prop.bedrooms && `${prop.bedrooms} Beds`,
      prop.bathrooms && `${prop.bathrooms} Baths`,
      prop.floors && `${prop.floors} Floors`,
      prop.yearBuilt && `Built ${prop.yearBuilt}`,
    ].filter(Boolean) as string[];

    return (
      <>
        {(p.logoUrl || p.logo2Url) && (
          <div className={`pp-logos ${p.contractLogoAlign === 'center' ? 'center' : ''}`}>
            {p.logoUrl ? <img src={p.logoUrl} alt="" style={{ height: h }} /> : <span />}
            {p.logo2Url ? <img src={p.logo2Url} alt="" style={{ height: h }} /> : <span />}
          </div>
        )}
        <div className="pp-title-block">
          <h1 className="en-title" dir="ltr">{p.titleEn}</h1>
          {p.titleRtl && <h2 className="rtl-title" dir="rtl">{p.titleRtl}</h2>}
          {p.subtitleEn && <div className="en-sub" dir="ltr">{p.subtitleEn}</div>}
          {p.subtitleRtl && <div className="rtl-sub" dir="rtl">{p.subtitleRtl}</div>}
        </div>
        <div className="pp-meta-bar">
          <span>Ref. {p.refNo}</span><span>|</span>
          <span>Date: {fmtDateLong(p.proposalDate)}</span><span>|</span>
          <span>Valid until: {p.validUntil}</span>
        </div>
        <div className="pp-meta-sub">Real Estate Proposal · {p.companyName || '—'}</div>

        <div className="pp-band"><div className="l" dir="ltr">PARTIES</div><div className="r" dir="rtl">طرفین</div></div>
        <table className="pp-parties-table">
          <tbody>
            <tr>
              {p.parties[0] && partyBlock(p.parties[0], 0)}
              {p.parties[1] && partyBlock(p.parties[1], 1)}
            </tr>
          </tbody>
        </table>

        <div data-section-id="__property__" className={`pp-section${brk('__property__')}`}>
          <div className="pp-band"><div className="l" dir="ltr">FEATURED PROPERTY</div><div className="r" dir="rtl">ملک پیشنهادی</div></div>
          <div className="pp-re-hero">
            <div className="pp-re-badge">{dealTypeLabel(prop.dealType, 'en')} · {prop.propertyTypeEn || 'Property'}</div>
            <div className="pp-re-badge-rtl" dir="rtl">{dealTypeLabel(prop.dealType, 'fa')} · {prop.propertyTypeRtl || 'ملک'}</div>
            <h3 className="pp-re-title" dir="ltr">{prop.titleEn || '—'}</h3>
            {prop.titleRtl && <h4 className="pp-re-title-rtl" dir="rtl">{prop.titleRtl}</h4>}
            {(prop.addressEn || prop.city) && (
              <div className="pp-re-addr" dir="ltr">{[prop.addressEn, prop.district, prop.city].filter(Boolean).join(' · ')}</div>
            )}
            {prop.addressRtl && <div className="pp-re-addr-rtl" dir="rtl">{prop.addressRtl}</div>}
            {prop.price && <div className="pp-re-price" dir="ltr">{cur} {prop.price}</div>}
            {prop.priceNoteEn && <div className="pp-re-price-note" dir="ltr">{prop.priceNoteEn}</div>}
            {prop.priceNoteRtl && <div className="pp-re-price-note-rtl" dir="rtl">{prop.priceNoteRtl}</div>}
            {facts.length > 0 && (
              <div className="pp-re-facts">{facts.map(f => <span key={f}>{f}</span>)}</div>
            )}
            {(prop.amenitiesEn || []).length > 0 && (
              <div className="pp-re-amenities">{(prop.amenitiesEn || []).map(a => <span key={a}>{a}</span>)}</div>
            )}
            {(prop.amenitiesRtl || []).length > 0 && (
              <div className="pp-re-amenities-rtl" dir="rtl">{(prop.amenitiesRtl || []).map(a => <span key={a}>{a}</span>)}</div>
            )}
          </div>
        </div>

        {p.sections.map(sec => (
          <div key={sec.id} data-section-id={sec.id} className={`pp-section${brk(sec.id)}`}>
            <div className="pp-band">
              <div className="l" dir="ltr">{sec.titleEn || sec.sectionNum}</div>
              <div className="r" dir="rtl">{sec.titleRtl || '—'}</div>
            </div>
            {sec.contentEn && <div className="pp-body-en" dir="ltr">{sec.contentEn}</div>}
            {sec.contentRtl && <div className="pp-body-rtl" dir="rtl">{sec.contentRtl}</div>}
          </div>
        ))}

        {p.photos.filter(ph => ph.url).length > 0 && (
          <div data-section-id="__gallery__" className={`pp-section${brk('__gallery__')} pp-force-page-break`}>
            <div className="pp-band"><div className="l" dir="ltr">PROPERTY GALLERY</div><div className="r" dir="rtl">گالری تصاویر ملک</div></div>
            <div className="pp-gallery">
              {p.photos.filter(ph => ph.url).map((ph, i) => (
                <figure key={ph.id} className="pp-gallery-item">
                  <img src={ph.url} alt={ph.captionEn || `Photo ${i + 1}`} />
                  {(ph.captionEn || ph.captionRtl) && (
                    <figcaption>
                      {ph.captionEn && <span dir="ltr">{ph.captionEn}</span>}
                      {ph.captionRtl && <span dir="rtl">{ph.captionRtl}</span>}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        )}

        <div className="pp-foot">
          <div className="co">{p.companyName || 'Real Estate Proposal'}</div>
          <div className="en">This document is a real-estate proposal for discussion purposes and does not constitute a binding offer until a sale/lease agreement is signed.</div>
          <div className="rtl" dir="rtl">این سند صورت پروپوزال املاک برای مذاکره است و تا امضای قرارداد خرید/اجاره الزام‌آور نیست.</div>
        </div>
      </>
    );
  };

  const printSections = (p: RealEstateProposal): PrintSectionRef[] => [
    { id: '__property__', label: T ? 'ملک پیشنهادی' : 'Featured property' },
    ...p.sections.map(s => ({ id: s.id, label: s.titleEn || s.sectionNum })),
    ...(p.photos.some(ph => ph.url) ? [{ id: '__gallery__', label: T ? 'گالری تصاویر' : 'Gallery' }] : []),
  ];

  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{T ? 'صورت پروپوزال املاک' : 'Real Estate Proposals'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {T ? 'دوزبانه حرفه‌ای — معرفی ملک، شرایط، و گالری عکس در انتهای سند' : 'Bilingual property proposals — overview, terms, and photo gallery at the end'}
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
                  <IconPlus className="w-3.5 h-3.5" />{T ? 'پروپوزال جدید' : 'New proposal'}
                </button>
              </>
            )}
          </div>
        </div>
        {importErr && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{importErr}</p>}
        <div className="relative max-w-md">
          <IconSearch className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={T ? 'جستجو شماره، ملک، شهر…' : 'Search ref, property, city…'} className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
        </div>
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-16 text-center text-sm text-gray-400">
            {list.length === 0 ? (T ? 'هنوز پروپوزال املاکی ثبت نشده.' : 'No real-estate proposals yet.') : (T ? 'نتیجه‌ای نیست.' : 'No matches.')}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-start p-3 font-bold">{T ? 'شماره' : 'Ref'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'ملک' : 'Property'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'موکل' : 'Client'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'قیمت' : 'Price'}</th>
                  <th className="text-center p-3 font-bold">{T ? 'وضعیت' : 'Status'}</th>
                  <th className="text-end p-3 font-bold">{T ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="p-3 font-mono text-xs" dir="ltr">{p.refNo}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900 line-clamp-1">{p.property.titleEn || p.titleEn}</div>
                      <div className="text-xs text-gray-400">{dealTypeLabel(p.property.dealType, T ? 'fa' : 'en')} · {p.property.city || '—'}</div>
                    </td>
                    <td className="p-3 text-gray-600">{realEstateProposalClientName(p)}</td>
                    <td className="p-3 text-xs font-bold text-teal-800" dir="ltr">
                      {p.property.price ? `${p.property.currency || p.currency} ${p.property.price}` : '—'}
                    </td>
                    <td className="p-3 text-center"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusCls(p.status)}`}>{statusLabel(p.status)}</span></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => { setDraft(p); setMode('preview'); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><IconPrinter className="w-4 h-4" /></button>
                        {!readonly && <button type="button" onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"><IconEdit className="w-4 h-4" /></button>}
                        {!readonly && <button type="button" onClick={() => void remove(p.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><IconTrash className="w-4 h-4" /></button>}
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
            <button type="button" onClick={() => exportRealEstateProposalWord(draft, `re_proposal_${draft.refNo || 'draft'}.doc`)} className="text-xs px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-bold">Word</button>
            {!readonly && (
              <button type="button" onClick={() => void save()} disabled={saving} className="text-xs px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 font-bold disabled:opacity-50">
                {saving ? '…' : (T ? 'ذخیره چیدمان' : 'Save layout')}
              </button>
            )}
            <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} className="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-1 disabled:opacity-50">
              <IconPrinter className="w-3.5 h-3.5" />{pdfBusy ? '…' : 'PDF'}
            </button>
          </div>
        </div>
        <div className="bg-slate-200/70 rounded-xl p-4 md:p-6 overflow-auto">
          <BilingualPrintPreview
            layout={draft.printLayout}
            onLayoutChange={layout => setDraft(d => d ? { ...d, printLayout: layout } : d)}
            printRef={printRef}
            sections={printSections(draft)}
            lang={T ? 'fa' : 'en'}
            readonly={readonly}
          >
            <PreviewDoc p={draft} pageBreakBefore={draft.printLayout?.pageBreakBefore} />
          </BilingualPrintPreview>
        </div>
      </div>
    );
  }

  // ── EDITOR ──
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
              <button type="button" className="text-xs px-2 border rounded-lg" onClick={() => upd({ refNo: genRealEstateProposalRefNo() })}>{T ? 'جدید' : 'New'}</button>
            </div>
          </div>
          <div><label className={label}>{T ? 'تاریخ' : 'Date'}</label><input type="date" className={field} value={draft.proposalDate} onChange={e => upd({ proposalDate: e.target.value })} /></div>
          <div><label className={label}>{T ? 'اعتبار تا' : 'Valid until'}</label><input type="date" className={field} value={draft.validUntil} onChange={e => upd({ validUntil: e.target.value })} /></div>
          <div>
            <label className={label}>{T ? 'وضعیت' : 'Status'}</label>
            <select className={field} value={draft.status} onChange={e => upd({ status: e.target.value as RealEstateProposalStatus })}>
              {(['draft', 'sent', 'accepted', 'declined'] as RealEstateProposalStatus[]).map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div><label className={label}>{T ? 'ارز' : 'Currency'}</label><input className={field} dir="ltr" value={draft.currency} onChange={e => upd({ currency: e.target.value })} /></div>
          <div><label className={label}>{T ? 'نام شرکت' : 'Company'}</label><input className={field} value={draft.companyName || ''} onChange={e => upd({ companyName: e.target.value })} /></div>
          <div className="md:col-span-3"><label className={label}>Title EN</label><input className={field} dir="ltr" value={draft.titleEn} onChange={e => upd({ titleEn: e.target.value })} /></div>
          <div className="md:col-span-3"><label className={label}>Title FA</label><input className={field} dir="rtl" value={draft.titleRtl} onChange={e => upd({ titleRtl: e.target.value })} /></div>
          <div><label className={label}>Subtitle EN</label><input className={field} dir="ltr" value={draft.subtitleEn || ''} onChange={e => upd({ subtitleEn: e.target.value })} /></div>
          <div><label className={label}>Subtitle FA</label><input className={field} dir="rtl" value={draft.subtitleRtl || ''} onChange={e => upd({ subtitleRtl: e.target.value })} /></div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="button" onClick={() => logo1Ref.current?.click()} className="text-xs px-3 py-2 rounded-lg border border-gray-200">{logoBusy === 1 ? '…' : (T ? 'لوگو ۱' : 'Logo 1')}</button>
          <button type="button" onClick={() => logo2Ref.current?.click()} className="text-xs px-3 py-2 rounded-lg border border-gray-200">{logoBusy === 2 ? '…' : (T ? 'لوگو ۲' : 'Logo 2')}</button>
          <input ref={logo1Ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(1, f); e.target.value = ''; }} />
          <input ref={logo2Ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(2, f); e.target.value = ''; }} />
        </div>
      </section>

      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white rounded-2xl p-5 space-y-4 shadow-lg">
        <h4 className="font-black text-white/95">{T ? 'ملک پیشنهادی' : 'Featured property'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-white/60 mb-1">{T ? 'نوع معامله' : 'Deal type'}</label>
            <select className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" value={draft.property.dealType} onChange={e => updProp({ dealType: e.target.value as RealEstateDealType })}>
              {RE_DEAL_TYPES.map(d => <option key={d} value={d}>{dealTypeLabel(d, T ? 'fa' : 'en')}</option>)}
            </select>
          </div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Type EN</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.propertyTypeEn} onChange={e => updProp({ propertyTypeEn: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Type FA</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="rtl" value={draft.property.propertyTypeRtl} onChange={e => updProp({ propertyTypeRtl: e.target.value })} /></div>
          <div className="md:col-span-3"><label className="block text-[10px] font-bold text-white/60 mb-1">Property title EN</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.titleEn} onChange={e => updProp({ titleEn: e.target.value })} /></div>
          <div className="md:col-span-3"><label className="block text-[10px] font-bold text-white/60 mb-1">Property title FA</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="rtl" value={draft.property.titleRtl} onChange={e => updProp({ titleRtl: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="block text-[10px] font-bold text-white/60 mb-1">Address EN</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.addressEn || ''} onChange={e => updProp({ addressEn: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">City</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" value={draft.property.city || ''} onChange={e => updProp({ city: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="block text-[10px] font-bold text-white/60 mb-1">Address FA</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="rtl" value={draft.property.addressRtl || ''} onChange={e => updProp({ addressRtl: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">District</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" value={draft.property.district || ''} onChange={e => updProp({ district: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Area m²</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.areaSqm || ''} onChange={e => updProp({ areaSqm: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Beds</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.bedrooms || ''} onChange={e => updProp({ bedrooms: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Baths</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.bathrooms || ''} onChange={e => updProp({ bathrooms: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Price</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900 font-bold" dir="ltr" value={draft.property.price || ''} onChange={e => updProp({ price: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Price currency</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.currency || draft.currency} onChange={e => updProp({ currency: e.target.value })} /></div>
          <div><label className="block text-[10px] font-bold text-white/60 mb-1">Price note EN</label><input className="w-full rounded-lg px-3 py-2 text-sm text-gray-900" dir="ltr" value={draft.property.priceNoteEn || ''} onChange={e => updProp({ priceNoteEn: e.target.value })} /></div>
          <div className="md:col-span-3"><label className="block text-[10px] font-bold text-white/60 mb-1">{T ? 'امکانات (هر خط یکی) EN' : 'Amenities EN (one per line)'}</label><textarea className="w-full rounded-lg px-3 py-2 text-sm text-gray-900 min-h-[70px]" dir="ltr" value={arrToLines(draft.property.amenitiesEn)} onChange={e => updProp({ amenitiesEn: linesToArr(e.target.value) })} /></div>
          <div className="md:col-span-3"><label className="block text-[10px] font-bold text-white/60 mb-1">{T ? 'امکانات FA' : 'Amenities FA'}</label><textarea className="w-full rounded-lg px-3 py-2 text-sm text-gray-900 min-h-[70px]" dir="rtl" value={arrToLines(draft.property.amenitiesRtl)} onChange={e => updProp({ amenitiesRtl: linesToArr(e.target.value) })} /></div>
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'طرفین' : 'Parties'}</h4>
        </div>
        {draft.parties.map((party, idx) => (
          <div key={party.id} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div><label className={label}>Label EN</label><input className={field} dir="ltr" value={party.labelEn} onChange={e => {
              const parties = [...draft.parties]; parties[idx] = { ...party, labelEn: e.target.value }; upd({ parties });
            }} /></div>
            <div><label className={label}>Label FA</label><input className={field} dir="rtl" value={party.labelRtl} onChange={e => {
              const parties = [...draft.parties]; parties[idx] = { ...party, labelRtl: e.target.value }; upd({ parties });
            }} /></div>
            <div><label className={label}>Company EN</label><input className={field} dir="ltr" value={party.companyEn} onChange={e => {
              const parties = [...draft.parties]; parties[idx] = { ...party, companyEn: e.target.value }; upd({ parties });
            }} /></div>
            <div><label className={label}>Company FA</label><input className={field} dir="rtl" value={party.companyRtl} onChange={e => {
              const parties = [...draft.parties]; parties[idx] = { ...party, companyRtl: e.target.value }; upd({ parties });
            }} /></div>
            <div><label className={label}>Contact</label><input className={field} dir="ltr" value={party.repNameEn || ''} onChange={e => {
              const parties = [...draft.parties]; parties[idx] = { ...party, repNameEn: e.target.value }; upd({ parties });
            }} /></div>
            <div><label className={label}>Phone / Email</label><input className={field} dir="ltr" value={party.contactPhone || party.contactEmail || ''} onChange={e => {
              const parties = [...draft.parties]; parties[idx] = { ...party, contactPhone: e.target.value }; upd({ parties });
            }} /></div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'بخش‌های متنی' : 'Sections'}</h4>
          {!readonly && (
            <button type="button" onClick={() => upd({
              sections: [...draft.sections, { id: uid('sec'), sectionNum: String(draft.sections.length + 1).padStart(2, '0'), titleEn: '', titleRtl: '', contentEn: '', contentRtl: '' }],
            })} className="text-xs px-3 py-1.5 rounded-lg bg-gray-900 text-white flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{T ? 'بخش' : 'Section'}</button>
          )}
        </div>
        {draft.sections.map((sec, idx) => (
          <div key={sec.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
              {!readonly && (
                <button type="button" onClick={() => upd({ sections: draft.sections.filter(s => s.id !== sec.id) })} className="text-red-400 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className={label}>Title EN</label><input className={field} dir="ltr" value={sec.titleEn} onChange={e => {
                const sections = [...draft.sections]; sections[idx] = { ...sec, titleEn: e.target.value }; upd({ sections });
              }} /></div>
              <div><label className={label}>Title FA</label><input className={field} dir="rtl" value={sec.titleRtl} onChange={e => {
                const sections = [...draft.sections]; sections[idx] = { ...sec, titleRtl: e.target.value }; upd({ sections });
              }} /></div>
              <div className="md:col-span-2"><label className={label}>Content EN</label><textarea className={ta} dir="ltr" value={sec.contentEn} onChange={e => {
                const sections = [...draft.sections]; sections[idx] = { ...sec, contentEn: e.target.value }; upd({ sections });
              }} /></div>
              <div className="md:col-span-2"><label className={label}>Content FA</label><textarea className={ta} dir="rtl" value={sec.contentRtl} onChange={e => {
                const sections = [...draft.sections]; sections[idx] = { ...sec, contentRtl: e.target.value }; upd({ sections });
              }} /></div>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-gray-800 flex items-center gap-2"><IconImage className="w-4 h-4" />{T ? 'گالری تصاویر (انتهای پروپوزال)' : 'Photo gallery (end of proposal)'}</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">{T ? 'عکس‌ها در انتهای سند چاپ می‌شوند — با کپشن دوزبانه' : 'Photos print at the end of the document with bilingual captions'}</p>
          </div>
          {!readonly && (
            <>
              <button type="button" disabled={photoBusy} onClick={() => photoRef.current?.click()} className="text-xs px-3 py-2 rounded-lg bg-teal-700 text-white hover:bg-teal-800 flex items-center gap-1 disabled:opacity-50">
                <IconUpload className="w-3.5 h-3.5" />{photoBusy ? '…' : (T ? 'افزودن عکس' : 'Add photos')}
              </button>
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { uploadPhotos(e.target.files); e.target.value = ''; }} />
            </>
          )}
        </div>
        {draft.photos.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center text-sm text-gray-400">
            {T ? 'هنوز عکسی اضافه نشده.' : 'No photos yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {draft.photos.map((ph, idx) => (
              <div key={ph.id} className="border border-gray-100 rounded-xl overflow-hidden bg-gray-50 shadow-sm">
                <div className="aspect-[4/3] bg-gray-200 relative">
                  <img src={ph.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <div className="p-3 space-y-2">
                  <input className={field} dir="ltr" placeholder="Caption EN" value={ph.captionEn || ''} onChange={e => {
                    const photos = [...draft.photos]; photos[idx] = { ...ph, captionEn: e.target.value }; upd({ photos });
                  }} />
                  <input className={field} dir="rtl" placeholder="کپشن فارسی" value={ph.captionRtl || ''} onChange={e => {
                    const photos = [...draft.photos]; photos[idx] = { ...ph, captionRtl: e.target.value }; upd({ photos });
                  }} />
                  {!readonly && (
                    <button type="button" onClick={() => upd({ photos: draft.photos.filter(x => x.id !== ph.id) })} className="text-xs text-red-500 font-bold flex items-center gap-1">
                      <IconTrash className="w-3.5 h-3.5" />{T ? 'حذف' : 'Remove'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
