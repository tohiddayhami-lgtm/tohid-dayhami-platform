import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CommercialProposal,
  Personnel,
  ProposalAddOn,
  ProposalLineItem,
  ProposalParty,
  ProposalSection,
  ProposalStatus,
} from '../types';
import { Language } from '../App';
import {
  subscribeToProposals,
  saveProposalToCloud,
  deleteProposalFromCloud,
  uploadFileWithProgress,
} from '../services/firebaseService';
import {
  emptyProposal,
  exportProposalEnvelope,
  parseProposalJson,
  proposalClientName,
  genProposalRefNo,
} from '../utils/proposalFormat';
import { IconPlus, IconTrash, IconEdit, IconPrinter, IconUpload, IconSearch, IconCheck } from './Icons';

interface Props {
  currentUser: Personnel;
  lang: Language;
  readonly?: boolean;
}

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const logoH = (size?: string) => (size === 'lg' ? 56 : size === 'sm' ? 36 : 46);

export const ProposalManager: React.FC<Props> = ({ currentUser, lang, readonly }) => {
  const T = lang === 'fa';
  const [list, setList] = useState<CommercialProposal[]>([]);
  const [mode, setMode] = useState<'list' | 'editor' | 'preview'>('list');
  const [draft, setDraft] = useState<CommercialProposal | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState<1 | 2 | null>(null);
  const [importErr, setImportErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const logo1Ref = useRef<HTMLInputElement>(null);
  const logo2Ref = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToProposals(setList);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      p.refNo.toLowerCase().includes(q)
      || p.titleEn.toLowerCase().includes(q)
      || p.titleRtl.includes(q)
      || proposalClientName(p).toLowerCase().includes(q),
    );
  }, [list, search]);

  const startNew = () => {
    setDraft(emptyProposal(currentUser));
    setMode('editor');
    setImportErr('');
  };

  const startEdit = (p: CommercialProposal) => {
    setDraft(JSON.parse(JSON.stringify(p)));
    setMode('editor');
    setImportErr('');
  };

  const save = async () => {
    if (!draft || readonly) return;
    setSaving(true);
    try {
      const payload: CommercialProposal = {
        ...draft,
        updatedAt: new Date().toISOString(),
        createdBy: draft.createdBy || currentUser.fullName,
        createdByPersonnelId: draft.createdByPersonnelId || currentUser.id,
      };
      await saveProposalToCloud(payload, currentUser);
      setDraft(payload);
      setMode('list');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (readonly) return;
    if (!confirm(T ? 'این پروپوزال حذف شود؟' : 'Delete this proposal?')) return;
    await deleteProposalFromCloud(id, currentUser);
  };

  const importJson = (file: File) => {
    setImportErr('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const proposal = parseProposalJson(parsed, currentUser);
        proposal.id = `prop-${Date.now()}`;
        proposal.createdAt = new Date().toISOString();
        proposal.updatedAt = proposal.createdAt;
        setDraft(proposal);
        setMode('editor');
      } catch (e) {
        setImportErr(T
          ? 'فایل JSON نامعتبر است. فرمت سمپل را رعایت کنید.'
          : 'Invalid JSON. Use the sample proposal format.');
      }
    };
    reader.readAsText(file);
  };

  const downloadSample = () => {
    const sample = exportProposalEnvelope(emptyProposal(currentUser));
    (sample.proposal as CommercialProposal).titleEn = 'METAVERSE EXPORT PAVILION — COMMERCIAL PROPOSAL';
    (sample.proposal as CommercialProposal).titleRtl = 'پیشنهاد تجاری غرفه صادراتی متاورسی';
    (sample.proposal as CommercialProposal).sections = [
      {
        id: 'es',
        sectionNum: 'EXECUTIVE SUMMARY',
        titleEn: 'EXECUTIVE SUMMARY',
        titleRtl: 'خلاصه مدیریتی',
        contentEn: 'Describe the offer in English…',
        contentRtl: 'توضیح پیشنهاد به فارسی…',
      },
      {
        id: 'sc',
        sectionNum: '1',
        titleEn: 'SCOPE & DELIVERABLES',
        titleRtl: 'دامنه و تحویل‌دادنی‌ها',
        contentEn: 'List deliverables…',
        contentRtl: 'فهرست تحویل‌دادنی‌ها…',
      },
    ];
    (sample.proposal as CommercialProposal).lineItems = [
      { id: 'li1', itemEn: 'Package A', itemRtl: 'بسته الف', qty: '1', unitPrice: '1,500', total: '1,500', notes: '' },
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'proposal_sample.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportCurrent = () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(exportProposalEnvelope(draft), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proposal_${draft.refNo}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const uploadLogo = (slot: 1 | 2, file: File) => {
    if (!draft) return;
    setLogoBusy(slot);
    uploadFileWithProgress(
      file,
      () => {},
      (url) => {
        setDraft(d => d ? { ...d, [slot === 1 ? 'logoUrl' : 'logo2Url']: url } : d);
        setLogoBusy(null);
      },
      (err) => { alert(err.message); setLogoBusy(null); },
      'images',
    );
  };

  const upd = (patch: Partial<CommercialProposal>) => setDraft(d => d ? { ...d, ...patch } : d);

  const updParty = (idx: number, patch: Partial<ProposalParty>) => {
    setDraft(d => {
      if (!d) return d;
      const parties = [...d.parties];
      parties[idx] = { ...parties[idx], ...patch };
      return { ...d, parties };
    });
  };

  const updSection = (idx: number, patch: Partial<ProposalSection>) => {
    setDraft(d => {
      if (!d) return d;
      const sections = [...d.sections];
      sections[idx] = { ...sections[idx], ...patch };
      return { ...d, sections };
    });
  };

  const updLine = (idx: number, patch: Partial<ProposalLineItem>) => {
    setDraft(d => {
      if (!d) return d;
      const lineItems = [...d.lineItems];
      lineItems[idx] = { ...lineItems[idx], ...patch };
      return { ...d, lineItems };
    });
  };

  const updAddOn = (idx: number, patch: Partial<ProposalAddOn>) => {
    setDraft(d => {
      if (!d) return d;
      const addOns = [...d.addOns];
      addOns[idx] = { ...addOns[idx], ...patch };
      return { ...d, addOns };
    });
  };

  const statusLabel = (s: ProposalStatus) =>
    ({ draft: T ? 'پیش‌نویس' : 'Draft', sent: T ? 'ارسال‌شده' : 'Sent', accepted: T ? 'پذیرفته' : 'Accepted', declined: T ? 'رد شده' : 'Declined' })[s];

  const statusCls = (s: ProposalStatus) =>
    ({ draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-100 text-blue-700', accepted: 'bg-emerald-100 text-emerald-700', declined: 'bg-red-100 text-red-600' })[s];

  const printDoc = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${draft?.refNo || 'Proposal'}</title>
      <style>
        @page { margin: 14mm; }
        body { font-family: Inter, Tahoma, Arial, sans-serif; color: #111827; margin: 0; }
        * { box-sizing: border-box; }
        .pp-root { max-width: 820px; margin: 0 auto; }
        .pp-logos { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .pp-logos.center { justify-content:center; }
        .pp-logos img { object-fit:contain; }
        .pp-head { text-align:center; border-bottom:2px solid #0f172a; padding-bottom:14px; margin-bottom:18px; }
        .pp-head h1 { margin:0 0 6px; font-size:18px; letter-spacing:.04em; }
        .pp-head h2 { margin:0; font-size:15px; font-weight:700; color:#334155; direction:rtl; }
        .pp-meta { display:flex; justify-content:space-between; gap:12px; font-size:12px; color:#475569; margin-bottom:16px; }
        .pp-parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; }
        .pp-party { border:1px solid #e2e8f0; border-radius:10px; padding:12px; background:#f8fafc; }
        .pp-party b { display:block; font-size:11px; letter-spacing:.08em; color:#64748b; margin-bottom:6px; }
        .pp-party .co { font-weight:800; font-size:13px; margin-bottom:2px; }
        .pp-party .co-rtl { direction:rtl; font-size:12px; color:#334155; }
        .pp-section { margin-bottom:16px; page-break-inside:avoid; }
        .pp-section h3 { margin:0 0 4px; font-size:13px; letter-spacing:.04em; }
        .pp-section h4 { margin:0 0 8px; font-size:12px; color:#475569; direction:rtl; font-weight:700; }
        .pp-section .en { white-space:pre-wrap; font-size:12.5px; line-height:1.55; margin-bottom:8px; }
        .pp-section .rtl { white-space:pre-wrap; font-size:12.5px; line-height:1.8; direction:rtl; color:#1e293b; background:#f8fafc; border-radius:8px; padding:10px; }
        table { width:100%; border-collapse:collapse; font-size:12px; margin:8px 0 16px; }
        th, td { border:1px solid #e2e8f0; padding:8px 10px; text-align:left; }
        th { background:#0f172a; color:#fff; font-size:11px; letter-spacing:.04em; }
        td.rtl { direction:rtl; text-align:right; }
        .pp-foot { margin-top:24px; font-size:11px; color:#64748b; text-align:center; border-top:1px solid #e2e8f0; padding-top:10px; }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-800/20';
  const label = 'block text-xs font-bold text-gray-500 mb-1';

  // ── Preview document ──
  const PreviewDoc = ({ p }: { p: CommercialProposal }) => {
    const h = logoH(p.contractLogoSize);
    const logos = (
      <div className={`pp-logos ${p.contractLogoAlign === 'center' ? 'center' : ''}`}>
        {p.logoUrl ? <img src={p.logoUrl} alt="" style={{ height: h }} /> : <span />}
        {p.logo2Url ? <img src={p.logo2Url} alt="" style={{ height: h }} /> : <span />}
      </div>
    );
    return (
      <div className="pp-root" ref={printRef}>
        {logos}
        <div className="pp-head">
          <div style={{ fontSize: 11, letterSpacing: '.12em', color: '#64748b', marginBottom: 6 }}>{p.refNo}</div>
          <h1>{p.titleEn}</h1>
          {p.titleRtl && <h2>{p.titleRtl}</h2>}
          {(p.subtitleEn || p.subtitleRtl) && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
              {p.subtitleEn && <div>{p.subtitleEn}</div>}
              {p.subtitleRtl && <div style={{ direction: 'rtl' }}>{p.subtitleRtl}</div>}
            </div>
          )}
        </div>
        <div className="pp-meta">
          <div><b>Date:</b> {p.proposalDate}</div>
          <div><b>Valid until:</b> {p.validUntil}</div>
          <div><b>Currency:</b> {p.currency}</div>
        </div>
        <div className="pp-parties">
          {p.parties.map(party => (
            <div key={party.id} className="pp-party">
              <b>{party.labelEn} / {party.labelRtl}</b>
              <div className="co">{party.companyEn || '—'}</div>
              {party.companyRtl && <div className="co-rtl">{party.companyRtl}</div>}
              {party.regNo && <div style={{ fontSize: 11, color: '#64748b' }}>CR: {party.regNo}</div>}
              {party.country && <div style={{ fontSize: 11 }}>{party.country}</div>}
              {(party.repNameEn || party.repNameRtl) && (
                <div style={{ fontSize: 11, marginTop: 6 }}>
                  {party.repNameEn}{party.repTitleEn ? ` — ${party.repTitleEn}` : ''}
                  {party.repNameRtl && <div style={{ direction: 'rtl' }}>{party.repNameRtl}{party.repTitleRtl ? ` — ${party.repTitleRtl}` : ''}</div>}
                </div>
              )}
              {(party.contactEmail || party.contactPhone) && (
                <div style={{ fontSize: 11, marginTop: 4, color: '#475569' }} dir="ltr">
                  {[party.contactEmail, party.contactPhone].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
        {p.sections.map(sec => (
          <div key={sec.id} className="pp-section">
            <h3>{sec.sectionNum}. {sec.titleEn}</h3>
            {sec.titleRtl && <h4>{sec.titleRtl}</h4>}
            {sec.contentEn && <div className="en">{sec.contentEn}</div>}
            {sec.contentRtl && <div className="rtl">{sec.contentRtl}</div>}
          </div>
        ))}
        {p.lineItems.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, letterSpacing: '.04em' }}>PRICING / قیمت‌گذاری</h3>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="rtl">مورد</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {p.lineItems.map(li => (
                  <tr key={li.id} style={li.selected ? { background: '#ecfdf5' } : undefined}>
                    <td>{li.itemEn}{li.notes ? <div style={{ fontSize: 10, color: '#64748b' }}>{li.notes}</div> : null}</td>
                    <td className="rtl">{li.itemRtl}</td>
                    <td dir="ltr">{li.qty}</td>
                    <td dir="ltr">{li.unitPrice} {p.currency}</td>
                    <td dir="ltr"><b>{li.total} {p.currency}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {p.addOns.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, letterSpacing: '.04em' }}>OPTIONAL ADD-ONS / افزودنی‌های اختیاری</h3>
            <table>
              <thead>
                <tr>
                  <th>Add-on</th>
                  <th className="rtl">افزودنی</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {p.addOns.map(ao => (
                  <tr key={ao.id} style={ao.selected ? { background: '#ecfdf5' } : undefined}>
                    <td>{ao.nameEn}{ao.descEn ? <div style={{ fontSize: 10, color: '#64748b' }}>{ao.descEn}</div> : null}</td>
                    <td className="rtl">{ao.nameRtl}{ao.descRtl ? <div style={{ fontSize: 10, color: '#64748b' }}>{ao.descRtl}</div> : null}</td>
                    <td dir="ltr">{ao.price} {p.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="pp-foot">
          {p.companyName || 'Commercial proposal — not a binding contract.'}
          <div>This document is a commercial proposal and does not constitute a legal contract.</div>
          <div style={{ direction: 'rtl' }}>این سند پیشنهاد تجاری است و قرارداد الزام‌آور محسوب نمی‌شود.</div>
        </div>
      </div>
    );
  };

  // ── LIST ──
  if (mode === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{T ? 'پروپوزال‌های تجاری' : 'Commercial Proposals'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {T ? 'دوزبانه (EN + فارسی/عربی) — قابل ویرایش، لوگو، ایمپورت JSON از هوش مصنوعی' : 'Bilingual (EN + FA/AR) — edit, logos, AI JSON import'}
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={T ? 'جستجو شماره، عنوان، مشتری…' : 'Search ref, title, client…'} className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-gray-200 text-sm" />
        </div>
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl py-16 text-center text-sm text-gray-400">
            {list.length === 0 ? (T ? 'هنوز پروپوزالی ثبت نشده.' : 'No proposals yet.') : (T ? 'نتیجه‌ای نیست.' : 'No matches.')}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-start p-3 font-bold">{T ? 'شماره' : 'Ref'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'عنوان' : 'Title'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'مشتری' : 'Client'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'تاریخ' : 'Date'}</th>
                  <th className="text-center p-3 font-bold">{T ? 'وضعیت' : 'Status'}</th>
                  <th className="text-end p-3 font-bold">{T ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="p-3 font-mono text-xs" dir="ltr">{p.refNo}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900 line-clamp-1">{p.titleEn}</div>
                      {p.titleRtl && <div className="text-xs text-gray-400 line-clamp-1" dir="rtl">{p.titleRtl}</div>}
                    </td>
                    <td className="p-3 text-gray-600">{proposalClientName(p)}</td>
                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap" dir="ltr">{p.proposalDate}</td>
                    <td className="p-3 text-center"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusCls(p.status)}`}>{statusLabel(p.status)}</span></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => { setDraft(p); setMode('preview'); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title={T ? 'پیش‌نمایش' : 'Preview'}><IconPrinter className="w-4 h-4" /></button>
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

  // ── PREVIEW ──
  if (mode === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 sticky top-0 bg-gray-50/90 backdrop-blur z-10 py-2">
          <button type="button" onClick={() => setMode('list')} className="text-sm text-gray-500 hover:text-gray-800">← {T ? 'بازگشت' : 'Back'}</button>
          <div className="flex gap-2">
            {!readonly && <button type="button" onClick={() => setMode('editor')} className="text-xs px-3 py-2 rounded-lg border border-gray-200">{T ? 'ویرایش' : 'Edit'}</button>}
            <button type="button" onClick={exportCurrent} className="text-xs px-3 py-2 rounded-lg border border-gray-200">JSON</button>
            <button type="button" onClick={printDoc} className="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-1"><IconPrinter className="w-3.5 h-3.5" />{T ? 'چاپ / PDF' : 'Print / PDF'}</button>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 md:p-10">
          <PreviewDoc p={draft} />
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

      {/* Header meta */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'اطلاعات کلی' : 'Header'}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={label}>Ref No.</label>
            <div className="flex gap-2">
              <input className={field} dir="ltr" value={draft.refNo} onChange={e => upd({ refNo: e.target.value })} />
              <button type="button" className="text-xs px-2 border rounded-lg" onClick={() => upd({ refNo: genProposalRefNo() })}>{T ? 'جدید' : 'New'}</button>
            </div>
          </div>
          <div>
            <label className={label}>{T ? 'تاریخ' : 'Date'}</label>
            <input type="date" className={field} value={draft.proposalDate} onChange={e => upd({ proposalDate: e.target.value })} />
          </div>
          <div>
            <label className={label}>{T ? 'اعتبار تا' : 'Valid until'}</label>
            <input type="date" className={field} value={draft.validUntil} onChange={e => upd({ validUntil: e.target.value })} />
          </div>
          <div>
            <label className={label}>{T ? 'وضعیت' : 'Status'}</label>
            <select className={field} value={draft.status} onChange={e => upd({ status: e.target.value as ProposalStatus })}>
              {(['draft', 'sent', 'accepted', 'declined'] as ProposalStatus[]).map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{T ? 'ارز' : 'Currency'}</label>
            <input className={field} dir="ltr" value={draft.currency} onChange={e => upd({ currency: e.target.value })} />
          </div>
          <div>
            <label className={label}>{T ? 'زبان RTL' : 'RTL language'}</label>
            <select className={field} value={draft.rtlLanguage} onChange={e => upd({ rtlLanguage: e.target.value as 'fa' | 'ar' })}>
              <option value="fa">فارسی</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={label}>Title (EN)</label>
            <input className={field} value={draft.titleEn} onChange={e => upd({ titleEn: e.target.value })} />
          </div>
          <div>
            <label className={label}>عنوان (RTL)</label>
            <input className={field} dir="rtl" value={draft.titleRtl} onChange={e => upd({ titleRtl: e.target.value })} />
          </div>
          <div>
            <label className={label}>Subtitle (EN)</label>
            <input className={field} value={draft.subtitleEn || ''} onChange={e => upd({ subtitleEn: e.target.value })} />
          </div>
          <div>
            <label className={label}>زیرعنوان (RTL)</label>
            <input className={field} dir="rtl" value={draft.subtitleRtl || ''} onChange={e => upd({ subtitleRtl: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className={label}>{T ? 'نام شرکت (فوتر)' : 'Company name (footer)'}</label>
            <input className={field} value={draft.companyName || ''} onChange={e => upd({ companyName: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'لوگوها' : 'Logos'}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(slot => {
            const url = slot === 1 ? draft.logoUrl : draft.logo2Url;
            const busy = logoBusy === slot;
            return (
              <div key={slot}>
                <label className={label}>{T ? `لوگو ${slot}` : `Logo ${slot}`}</label>
                <button
                  type="button"
                  onClick={() => (slot === 1 ? logo1Ref : logo2Ref).current?.click()}
                  className="w-full h-28 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 hover:bg-gray-100 overflow-hidden"
                >
                  {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain p-2" /> : (
                    <span className="text-xs text-gray-400 flex flex-col items-center gap-1">
                      <IconUpload className="w-5 h-5" />{busy ? (T ? 'آپلود…' : 'Uploading…') : (T ? 'آپلود لوگو' : 'Upload logo')}
                    </span>
                  )}
                </button>
                {url && !readonly && (
                  <button type="button" className="text-xs text-red-500 mt-1" onClick={() => upd(slot === 1 ? { logoUrl: '' } : { logo2Url: '' })}>
                    {T ? 'حذف لوگو' : 'Remove'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <input ref={logo1Ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(1, f); e.target.value = ''; }} />
        <input ref={logo2Ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(2, f); e.target.value = ''; }} />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>{T ? 'چیدمان' : 'Layout'}</label>
            <select className={field} value={draft.contractLogoLayout || 'corners'} onChange={e => upd({ contractLogoLayout: e.target.value as CommercialProposal['contractLogoLayout'] })}>
              <option value="corners">Corners</option>
              <option value="row">Row</option>
              <option value="single">Single</option>
            </select>
          </div>
          <div>
            <label className={label}>{T ? 'تراز' : 'Align'}</label>
            <select className={field} value={draft.contractLogoAlign || 'center'} onChange={e => upd({ contractLogoAlign: e.target.value as CommercialProposal['contractLogoAlign'] })}>
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
            </select>
          </div>
          <div>
            <label className={label}>{T ? 'اندازه' : 'Size'}</label>
            <select className={field} value={draft.contractLogoSize || 'md'} onChange={e => upd({ contractLogoSize: e.target.value as CommercialProposal['contractLogoSize'] })}>
              <option value="sm">S</option>
              <option value="md">M</option>
              <option value="lg">L</option>
            </select>
          </div>
        </div>
      </section>

      {/* Parties */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <h4 className="font-bold text-gray-800">{T ? 'طرفین' : 'Parties'}</h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {draft.parties.map((party, idx) => (
            <div key={party.id} className="border border-gray-100 rounded-xl p-4 space-y-2 bg-gray-50/50">
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label}>Label EN</label><input className={field} value={party.labelEn} onChange={e => updParty(idx, { labelEn: e.target.value })} /></div>
                <div><label className={label}>برچسب RTL</label><input className={field} dir="rtl" value={party.labelRtl} onChange={e => updParty(idx, { labelRtl: e.target.value })} /></div>
                <div><label className={label}>Company EN</label><input className={field} value={party.companyEn} onChange={e => updParty(idx, { companyEn: e.target.value })} /></div>
                <div><label className={label}>شرکت RTL</label><input className={field} dir="rtl" value={party.companyRtl} onChange={e => updParty(idx, { companyRtl: e.target.value })} /></div>
                <div><label className={label}>CR / Reg</label><input className={field} dir="ltr" value={party.regNo || ''} onChange={e => updParty(idx, { regNo: e.target.value })} /></div>
                <div><label className={label}>Country</label><input className={field} value={party.country || ''} onChange={e => updParty(idx, { country: e.target.value })} /></div>
                <div><label className={label}>Rep EN</label><input className={field} value={party.repNameEn || ''} onChange={e => updParty(idx, { repNameEn: e.target.value })} /></div>
                <div><label className={label}>نماینده RTL</label><input className={field} dir="rtl" value={party.repNameRtl || ''} onChange={e => updParty(idx, { repNameRtl: e.target.value })} /></div>
                <div><label className={label}>Email</label><input className={field} dir="ltr" value={party.contactEmail || ''} onChange={e => updParty(idx, { contactEmail: e.target.value })} /></div>
                <div><label className={label}>Phone</label><input className={field} dir="ltr" value={party.contactPhone || ''} onChange={e => updParty(idx, { contactPhone: e.target.value })} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sections */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'بخش‌ها' : 'Sections'}</h4>
          {!readonly && (
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200" onClick={() => upd({
              sections: [...draft.sections, { id: uid('sc'), sectionNum: String(draft.sections.length), titleEn: '', titleRtl: '', contentEn: '', contentRtl: '' }],
            })}>+ {T ? 'بخش' : 'Section'}</button>
          )}
        </div>
        {draft.sections.map((sec, idx) => (
          <div key={sec.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="grid grid-cols-3 gap-2 flex-1">
                <div><label className={label}>#</label><input className={field} value={sec.sectionNum} onChange={e => updSection(idx, { sectionNum: e.target.value })} /></div>
                <div><label className={label}>Title EN</label><input className={field} value={sec.titleEn} onChange={e => updSection(idx, { titleEn: e.target.value })} /></div>
                <div><label className={label}>عنوان RTL</label><input className={field} dir="rtl" value={sec.titleRtl} onChange={e => updSection(idx, { titleRtl: e.target.value })} /></div>
              </div>
              {!readonly && draft.sections.length > 1 && (
                <button type="button" className="text-red-400 p-1" onClick={() => upd({ sections: draft.sections.filter((_, i) => i !== idx) })}><IconTrash className="w-4 h-4" /></button>
              )}
            </div>
            <div>
              <label className={label}>Content EN</label>
              <textarea rows={3} className={field} value={sec.contentEn} onChange={e => updSection(idx, { contentEn: e.target.value })} />
            </div>
            <div>
              <label className={label}>محتوا RTL</label>
              <textarea rows={3} className={field} dir="rtl" value={sec.contentRtl} onChange={e => updSection(idx, { contentRtl: e.target.value })} />
            </div>
          </div>
        ))}
      </section>

      {/* Line items */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'اقلام قیمت' : 'Line items'}</h4>
          {!readonly && (
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200" onClick={() => upd({
              lineItems: [...draft.lineItems, { id: uid('li'), itemEn: '', itemRtl: '', qty: '1', unitPrice: '', total: '', notes: '', selected: false }],
            })}>+ Item</button>
          )}
        </div>
        {draft.lineItems.map((li, idx) => (
          <div key={li.id} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end border border-gray-50 rounded-lg p-2">
            <div className="md:col-span-2"><label className={label}>Item EN</label><input className={field} value={li.itemEn} onChange={e => updLine(idx, { itemEn: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={label}>مورد RTL</label><input className={field} dir="rtl" value={li.itemRtl} onChange={e => updLine(idx, { itemRtl: e.target.value })} /></div>
            <div><label className={label}>Qty</label><input className={field} dir="ltr" value={li.qty} onChange={e => updLine(idx, { qty: e.target.value })} /></div>
            <div><label className={label}>Unit</label><input className={field} dir="ltr" value={li.unitPrice} onChange={e => updLine(idx, { unitPrice: e.target.value, total: e.target.value })} /></div>
            <div><label className={label}>Total</label><input className={field} dir="ltr" value={li.total} onChange={e => updLine(idx, { total: e.target.value })} /></div>
            <div><label className={label}>Notes</label><input className={field} value={li.notes || ''} onChange={e => updLine(idx, { notes: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={!!li.selected} onChange={e => updLine(idx, { selected: e.target.checked })} />{T ? 'انتخاب‌شده' : 'Selected'}</label>
            {!readonly && <button type="button" className="text-red-400 text-xs justify-self-end" onClick={() => upd({ lineItems: draft.lineItems.filter((_, i) => i !== idx) })}>{T ? 'حذف' : 'Remove'}</button>}
          </div>
        ))}
      </section>

      {/* Add-ons */}
      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'افزودنی‌ها' : 'Add-ons'}</h4>
          {!readonly && (
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200" onClick={() => upd({
              addOns: [...draft.addOns, { id: uid('ao'), nameEn: '', nameRtl: '', descEn: '', descRtl: '', price: '', selected: false }],
            })}>+ Add-on</button>
          )}
        </div>
        {draft.addOns.map((ao, idx) => (
          <div key={ao.id} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end border border-gray-50 rounded-lg p-2">
            <div><label className={label}>Name EN</label><input className={field} value={ao.nameEn} onChange={e => updAddOn(idx, { nameEn: e.target.value })} /></div>
            <div><label className={label}>نام RTL</label><input className={field} dir="rtl" value={ao.nameRtl} onChange={e => updAddOn(idx, { nameRtl: e.target.value })} /></div>
            <div><label className={label}>Price</label><input className={field} dir="ltr" value={ao.price} onChange={e => updAddOn(idx, { price: e.target.value })} /></div>
            <div><label className={label}>Desc EN</label><input className={field} value={ao.descEn || ''} onChange={e => updAddOn(idx, { descEn: e.target.value })} /></div>
            {!readonly && <button type="button" className="text-red-400 text-xs" onClick={() => upd({ addOns: draft.addOns.filter((_, i) => i !== idx) })}>{T ? 'حذف' : 'Remove'}</button>}
          </div>
        ))}
      </section>
    </div>
  );
};
