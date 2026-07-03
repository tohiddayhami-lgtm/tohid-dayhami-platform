import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ContractAddOn,
  ContractClause,
  ContractParty,
  ContractScheduleRow,
  ContractStatus,
  LegalContract,
  Personnel,
} from '../types';
import { Language } from '../App';
import {
  subscribeToContracts,
  saveContractToCloud,
  deleteContractFromCloud,
  uploadFileWithProgress,
} from '../services/firebaseService';
import {
  emptyContract,
  exportContractEnvelope,
  parseContractJson,
  contractClientName,
  genContractRefNo,
} from '../utils/contractFormat';
import { IconPlus, IconTrash, IconEdit, IconPrinter, IconUpload, IconSearch, IconCheck } from './Icons';

interface Props {
  currentUser: Personnel;
  lang: Language;
  readonly?: boolean;
}

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const logoH = (size?: string) => (size === 'lg' ? 56 : size === 'sm' ? 36 : 46);

export const ContractManager: React.FC<Props> = ({ currentUser, lang, readonly }) => {
  const T = lang === 'fa';
  const [list, setList] = useState<LegalContract[]>([]);
  const [mode, setMode] = useState<'list' | 'editor' | 'preview'>('list');
  const [draft, setDraft] = useState<LegalContract | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState<1 | 2 | null>(null);
  const [importErr, setImportErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const logo1Ref = useRef<HTMLInputElement>(null);
  const logo2Ref = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToContracts(setList);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(c =>
      c.refNo.toLowerCase().includes(q)
      || c.titleEn.toLowerCase().includes(q)
      || c.titleRtl.includes(q)
      || contractClientName(c).toLowerCase().includes(q),
    );
  }, [list, search]);

  const startNew = () => { setDraft(emptyContract(currentUser)); setMode('editor'); setImportErr(''); };
  const startEdit = (c: LegalContract) => { setDraft(JSON.parse(JSON.stringify(c))); setMode('editor'); setImportErr(''); };

  const save = async () => {
    if (!draft || readonly) return;
    setSaving(true);
    try {
      const payload: LegalContract = {
        ...draft,
        updatedAt: new Date().toISOString(),
        createdBy: draft.createdBy || currentUser.fullName,
        createdByPersonnelId: draft.createdByPersonnelId || currentUser.id,
      };
      await saveContractToCloud(payload, currentUser);
      setDraft(payload);
      setMode('list');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (readonly) return;
    if (!confirm(T ? 'این قرارداد حذف شود؟' : 'Delete this contract?')) return;
    await deleteContractFromCloud(id, currentUser);
  };

  const importJson = (file: File) => {
    setImportErr('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        const contract = parseContractJson(parsed, currentUser);
        contract.id = `ctr-${Date.now()}`;
        contract.createdAt = new Date().toISOString();
        contract.updatedAt = contract.createdAt;
        setDraft(contract);
        setMode('editor');
      } catch {
        setImportErr(T
          ? 'فایل JSON نامعتبر است. فرمت سمپل قرارداد را رعایت کنید.'
          : 'Invalid JSON. Use the sample contract format.');
      }
    };
    reader.readAsText(file);
  };

  const downloadSample = () => {
    const sample = exportContractEnvelope(emptyContract(currentUser));
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contract_sample.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportCurrent = () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(exportContractEnvelope(draft), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contract_${draft.refNo}.json`;
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

  const upd = (patch: Partial<LegalContract>) => setDraft(d => d ? { ...d, ...patch } : d);

  const updParty = (idx: number, patch: Partial<ContractParty>) => {
    setDraft(d => {
      if (!d) return d;
      const parties = [...d.parties];
      parties[idx] = { ...parties[idx], ...patch };
      return { ...d, parties };
    });
  };

  const updClause = (idx: number, patch: Partial<ContractClause>) => {
    setDraft(d => {
      if (!d) return d;
      const clauses = [...d.clauses];
      clauses[idx] = { ...clauses[idx], ...patch };
      return { ...d, clauses };
    });
  };

  const updSchedule = (idx: number, patch: Partial<ContractScheduleRow>) => {
    setDraft(d => {
      if (!d) return d;
      const scheduleRows = [...d.scheduleRows];
      scheduleRows[idx] = { ...scheduleRows[idx], ...patch };
      return { ...d, scheduleRows };
    });
  };

  const updAddOn = (idx: number, patch: Partial<ContractAddOn>) => {
    setDraft(d => {
      if (!d) return d;
      const addOns = [...d.addOns];
      addOns[idx] = { ...addOns[idx], ...patch };
      return { ...d, addOns };
    });
  };

  const statusLabel = (s: ContractStatus) =>
    ({ draft: T ? 'پیش‌نویس' : 'Draft', final: T ? 'نهایی' : 'Final', signed: T ? 'امضا شده' : 'Signed' })[s];

  const statusCls = (s: ContractStatus) =>
    ({ draft: 'bg-gray-100 text-gray-600', final: 'bg-blue-100 text-blue-700', signed: 'bg-emerald-100 text-emerald-700' })[s];

  const printDoc = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${draft?.refNo || 'Contract'}</title>
      <style>
        @page { margin: 14mm; }
        body { font-family: Inter, Tahoma, Arial, sans-serif; color: #111827; margin: 0; }
        * { box-sizing: border-box; }
        .ct-root { max-width: 820px; margin: 0 auto; }
        .ct-logos { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .ct-logos.center { justify-content:center; }
        .ct-logos.banner { justify-content:center; margin-bottom:10px; }
        .ct-logos img { object-fit:contain; }
        .ct-head { text-align:center; border-bottom:2px solid #0f172a; padding-bottom:14px; margin-bottom:18px; }
        .ct-head.left { text-align:left; display:flex; align-items:center; gap:16px; }
        .ct-head.right { text-align:right; display:flex; flex-direction:row-reverse; align-items:center; gap:16px; }
        .ct-head h1 { margin:0 0 6px; font-size:17px; letter-spacing:.04em; }
        .ct-head h2 { margin:0; font-size:14px; font-weight:700; color:#334155; direction:rtl; }
        .ct-meta { display:flex; justify-content:space-between; gap:12px; font-size:12px; color:#475569; margin-bottom:16px; }
        .ct-parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px; }
        .ct-party { border:1px solid #e2e8f0; border-radius:10px; padding:12px; background:#f8fafc; }
        .ct-party b { display:block; font-size:11px; letter-spacing:.08em; color:#64748b; margin-bottom:6px; }
        .ct-party .co { font-weight:800; font-size:13px; }
        .ct-party .co-rtl { direction:rtl; font-size:12px; color:#334155; }
        .ct-clause { margin-bottom:16px; page-break-inside:avoid; }
        .ct-clause h3 { margin:0 0 4px; font-size:12.5px; letter-spacing:.03em; }
        .ct-clause h4 { margin:0 0 8px; font-size:12px; color:#475569; direction:rtl; font-weight:700; }
        .ct-clause .en { white-space:pre-wrap; font-size:12px; line-height:1.55; margin-bottom:8px; }
        .ct-clause .rtl { white-space:pre-wrap; font-size:12px; line-height:1.85; direction:rtl; color:#1e293b; background:#f8fafc; border-radius:8px; padding:10px; }
        table { width:100%; border-collapse:collapse; font-size:11.5px; margin:8px 0 16px; }
        th, td { border:1px solid #e2e8f0; padding:7px 9px; text-align:left; }
        th { background:#0f172a; color:#fff; font-size:10.5px; letter-spacing:.04em; }
        td.rtl { direction:rtl; text-align:right; }
        .ct-sign { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:32px; page-break-inside:avoid; }
        .ct-sign .box { border-top:1px solid #94a3b8; padding-top:10px; font-size:11px; color:#475569; min-height:70px; }
        .ct-foot { margin-top:20px; font-size:10.5px; color:#64748b; text-align:center; border-top:1px solid #e2e8f0; padding-top:10px; }
      </style></head><body>${html}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-800/20';
  const label = 'block text-xs font-bold text-gray-500 mb-1';

  const PreviewDoc = ({ c }: { c: LegalContract }) => {
    const h = logoH(c.contractLogoSize);
    const layout = c.contractLogoLayout || 'corners';
    const logos = (c.logoUrl || c.logo2Url) ? (
      <div className={`ct-logos ${c.contractLogoAlign === 'center' || layout === 'banner-top' ? 'center' : ''} ${layout === 'banner-top' ? 'banner' : ''}`}>
        {c.logoUrl ? <img src={c.logoUrl} alt="" style={{ height: h }} /> : <span />}
        {c.logo2Url ? <img src={c.logo2Url} alt="" style={{ height: h }} /> : <span />}
      </div>
    ) : null;

    const headClass = layout === 'title-left' ? 'left' : layout === 'title-right' ? 'right' : '';
    const titleBlock = (
      <div>
        <div style={{ fontSize: 11, letterSpacing: '.12em', color: '#64748b', marginBottom: 6 }}>{c.refNo}</div>
        <h1>{c.titleEn}</h1>
        {c.titleRtl && <h2>{c.titleRtl}</h2>}
        {(c.subtitleEn || c.subtitleRtl) && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
            {c.subtitleEn && <div>{c.subtitleEn}</div>}
            {c.subtitleRtl && <div style={{ direction: 'rtl' }}>{c.subtitleRtl}</div>}
          </div>
        )}
      </div>
    );

    return (
      <div className="ct-root" ref={printRef}>
        {layout === 'banner-top' && logos}
        {layout === 'corners' && logos}
        <div className={`ct-head ${headClass}`}>
          {layout === 'title-left' && c.logoUrl && <img src={c.logoUrl} alt="" style={{ height: h }} />}
          {titleBlock}
          {layout === 'title-right' && c.logoUrl && <img src={c.logoUrl} alt="" style={{ height: h }} />}
          {layout === 'title-left' && c.logo2Url && <img src={c.logo2Url} alt="" style={{ height: h }} />}
          {layout === 'title-right' && c.logo2Url && <img src={c.logo2Url} alt="" style={{ height: h }} />}
        </div>
        <div className="ct-meta">
          <div><b>Effective Date:</b> {c.effectiveDate}</div>
          <div><b>Status:</b> {statusLabel(c.status)}</div>
          <div><b>Ref:</b> {c.refNo}</div>
        </div>
        <div className="ct-parties">
          {c.parties.map(party => (
            <div key={party.id} className="ct-party">
              <b>{party.labelEn} / {party.labelRtl}</b>
              <div className="co">{party.companyEn || '—'}</div>
              {party.companyRtl && <div className="co-rtl">{party.companyRtl}</div>}
              {party.aliasEn && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>({party.aliasEn})</div>}
              {party.regNo && <div style={{ fontSize: 11, color: '#64748b' }}>CR: {party.regNo}</div>}
              {party.country && <div style={{ fontSize: 11 }}>{party.country}</div>}
              {(party.repNameEn || party.repNameRtl) && (
                <div style={{ fontSize: 11, marginTop: 6 }}>
                  {party.repNameEn}{party.repTitleEn ? ` — ${party.repTitleEn}` : ''}
                  {party.repNameRtl && <div style={{ direction: 'rtl' }}>{party.repNameRtl}{party.repTitleRtl ? ` — ${party.repTitleRtl}` : ''}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
        {c.clauses.map(cl => (
          <div key={cl.id} className="ct-clause">
            <h3>{cl.articleNum === 'RECITALS' ? '' : `ARTICLE ${cl.articleNum} — `}{cl.titleEn}</h3>
            {cl.titleRtl && <h4>{cl.titleRtl}</h4>}
            {cl.contentEn && <div className="en">{cl.contentEn}</div>}
            {cl.contentRtl && <div className="rtl">{cl.contentRtl}</div>}
          </div>
        ))}
        {c.scheduleRows.length > 0 && (
          <>
            <h3 style={{ fontSize: 13, letterSpacing: '.04em' }}>SCHEDULE A — FEES / پیوست الف — حق‌الزحمه</h3>
            <table>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th className="rtl">سطح</th>
                  <th>Build Fee</th>
                  <th>Annual Fee</th>
                  <th>Interp. hrs</th>
                </tr>
              </thead>
              <tbody>
                {c.scheduleRows.map(sr => (
                  <tr key={sr.id} style={sr.selected ? { background: '#ecfdf5' } : undefined}>
                    <td>{sr.tierEn}</td>
                    <td className="rtl">{sr.tierRtl}</td>
                    <td dir="ltr">{sr.buildFee} OMR</td>
                    <td dir="ltr">{sr.annualFee} OMR</td>
                    <td dir="ltr">{sr.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {c.addOns.length > 0 && (
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
                {c.addOns.map(ao => (
                  <tr key={ao.id} style={ao.selected ? { background: '#ecfdf5' } : undefined}>
                    <td>{ao.nameEn}{ao.descEn ? <div style={{ fontSize: 10, color: '#64748b' }}>{ao.descEn}</div> : null}</td>
                    <td className="rtl">{ao.nameRtl}{ao.descRtl ? <div style={{ fontSize: 10, color: '#64748b' }}>{ao.descRtl}</div> : null}</td>
                    <td dir="ltr">{ao.price} OMR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="ct-sign">
          {c.parties.map(party => (
            <div key={party.id} className="box">
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{party.labelEn}</div>
              <div style={{ direction: 'rtl', fontSize: 11 }}>{party.labelRtl}</div>
              <div style={{ marginTop: 28 }}>________________________</div>
              <div style={{ marginTop: 4 }}>{party.repNameEn || party.companyEn}</div>
              <div style={{ direction: 'rtl' }}>{party.repNameRtl || party.companyRtl}</div>
            </div>
          ))}
        </div>
        <div className="ct-foot">
          {c.companyName}
          <div>Executed in English and Persian. In case of discrepancy, the English version prevails.</div>
          <div style={{ direction: 'rtl' }}>این قرارداد به دو زبان انگلیسی و فارسی تنظیم شده است. در صورت تعارض، نسخه‌ی انگلیسی مالک است.</div>
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
            <h3 className="text-lg font-bold text-gray-900">{T ? 'قراردادها' : 'Contracts'}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {T ? 'دوزبانه حقوقی — مواد، پیوست الف، لوگو، ایمپورت JSON' : 'Bilingual legal — clauses, Schedule A, logos, AI JSON import'}
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
                  <IconPlus className="w-3.5 h-3.5" />{T ? 'قرارداد جدید' : 'New contract'}
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
            {list.length === 0 ? (T ? 'هنوز قراردادی ثبت نشده.' : 'No contracts yet.') : (T ? 'نتیجه‌ای نیست.' : 'No matches.')}
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-start p-3 font-bold">{T ? 'شماره' : 'Ref'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'عنوان' : 'Title'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'مشتری' : 'Client'}</th>
                  <th className="text-start p-3 font-bold">{T ? 'تاریخ اجرا' : 'Effective'}</th>
                  <th className="text-center p-3 font-bold">{T ? 'وضعیت' : 'Status'}</th>
                  <th className="text-end p-3 font-bold">{T ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="p-3 font-mono text-xs" dir="ltr">{c.refNo}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gray-900 line-clamp-1">{c.titleEn}</div>
                      {c.titleRtl && <div className="text-xs text-gray-400 line-clamp-1" dir="rtl">{c.titleRtl}</div>}
                    </td>
                    <td className="p-3 text-gray-600">{contractClientName(c)}</td>
                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap" dir="ltr">{c.effectiveDate}</td>
                    <td className="p-3 text-center"><span className={`text-[11px] font-bold px-2 py-1 rounded-full ${statusCls(c.status)}`}>{statusLabel(c.status)}</span></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => { setDraft(c); setMode('preview'); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><IconPrinter className="w-4 h-4" /></button>
                        {!readonly && <button type="button" onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"><IconEdit className="w-4 h-4" /></button>}
                        {!readonly && <button type="button" onClick={() => void remove(c.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><IconTrash className="w-4 h-4" /></button>}
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
            <button type="button" onClick={printDoc} className="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white flex items-center gap-1"><IconPrinter className="w-3.5 h-3.5" />{T ? 'چاپ / PDF' : 'Print / PDF'}</button>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 md:p-10">
          <PreviewDoc c={draft} />
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
              <button type="button" className="text-xs px-2 border rounded-lg" onClick={() => upd({ refNo: genContractRefNo() })}>{T ? 'جدید' : 'New'}</button>
            </div>
          </div>
          <div>
            <label className={label}>{T ? 'تاریخ اجرا' : 'Effective date'}</label>
            <input type="date" className={field} value={draft.effectiveDate} onChange={e => upd({ effectiveDate: e.target.value })} />
          </div>
          <div>
            <label className={label}>{T ? 'وضعیت' : 'Status'}</label>
            <select className={field} value={draft.status} onChange={e => upd({ status: e.target.value as ContractStatus })}>
              {(['draft', 'final', 'signed'] as ContractStatus[]).map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
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
            <label className={label}>{T ? 'نام شرکت (فوتر)' : 'Company name (footer)'}</label>
            <input className={field} value={draft.companyName || ''} onChange={e => upd({ companyName: e.target.value })} />
          </div>
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
            <select className={field} value={draft.contractLogoLayout || 'corners'} onChange={e => upd({ contractLogoLayout: e.target.value as LegalContract['contractLogoLayout'] })}>
              <option value="corners">Corners</option>
              <option value="banner-top">Banner top</option>
              <option value="title-left">Title left</option>
              <option value="title-right">Title right</option>
            </select>
          </div>
          <div>
            <label className={label}>{T ? 'تراز' : 'Align'}</label>
            <select className={field} value={draft.contractLogoAlign || 'center'} onChange={e => upd({ contractLogoAlign: e.target.value as LegalContract['contractLogoAlign'] })}>
              <option value="start">Start</option>
              <option value="center">Center</option>
              <option value="end">End</option>
            </select>
          </div>
          <div>
            <label className={label}>{T ? 'اندازه' : 'Size'}</label>
            <select className={field} value={draft.contractLogoSize || 'md'} onChange={e => upd({ contractLogoSize: e.target.value as LegalContract['contractLogoSize'] })}>
              <option value="sm">S</option>
              <option value="md">M</option>
              <option value="lg">L</option>
            </select>
          </div>
        </div>
      </section>

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
                <div><label className={label}>Alias EN</label><input className={field} value={party.aliasEn || ''} onChange={e => updParty(idx, { aliasEn: e.target.value })} /></div>
                <div><label className={label}>نام مستعار RTL</label><input className={field} dir="rtl" value={party.aliasRtl || ''} onChange={e => updParty(idx, { aliasRtl: e.target.value })} /></div>
                <div><label className={label}>CR / Reg</label><input className={field} dir="ltr" value={party.regNo || ''} onChange={e => updParty(idx, { regNo: e.target.value })} /></div>
                <div><label className={label}>Country</label><input className={field} value={party.country || ''} onChange={e => updParty(idx, { country: e.target.value })} /></div>
                <div><label className={label}>Rep EN</label><input className={field} value={party.repNameEn || ''} onChange={e => updParty(idx, { repNameEn: e.target.value })} /></div>
                <div><label className={label}>نماینده RTL</label><input className={field} dir="rtl" value={party.repNameRtl || ''} onChange={e => updParty(idx, { repNameRtl: e.target.value })} /></div>
                <div><label className={label}>Title EN</label><input className={field} value={party.repTitleEn || ''} onChange={e => updParty(idx, { repTitleEn: e.target.value })} /></div>
                <div><label className={label}>سمت RTL</label><input className={field} dir="rtl" value={party.repTitleRtl || ''} onChange={e => updParty(idx, { repTitleRtl: e.target.value })} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'مواد قرارداد (Clauses)' : 'Clauses'}</h4>
          {!readonly && (
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200" onClick={() => upd({
              clauses: [...draft.clauses, { id: uid('a'), articleNum: String(draft.clauses.length), titleEn: '', titleRtl: '', contentEn: '', contentRtl: '' }],
            })}>+ {T ? 'ماده' : 'Article'}</button>
          )}
        </div>
        {draft.clauses.map((cl, idx) => (
          <div key={cl.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="grid grid-cols-3 gap-2 flex-1">
                <div><label className={label}>Article #</label><input className={field} value={cl.articleNum} onChange={e => updClause(idx, { articleNum: e.target.value })} /></div>
                <div><label className={label}>Title EN</label><input className={field} value={cl.titleEn} onChange={e => updClause(idx, { titleEn: e.target.value })} /></div>
                <div><label className={label}>عنوان RTL</label><input className={field} dir="rtl" value={cl.titleRtl} onChange={e => updClause(idx, { titleRtl: e.target.value })} /></div>
              </div>
              {!readonly && draft.clauses.length > 1 && (
                <button type="button" className="text-red-400 p-1" onClick={() => upd({ clauses: draft.clauses.filter((_, i) => i !== idx) })}><IconTrash className="w-4 h-4" /></button>
              )}
            </div>
            <div>
              <label className={label}>Content EN</label>
              <textarea rows={4} className={field} value={cl.contentEn} onChange={e => updClause(idx, { contentEn: e.target.value })} />
            </div>
            <div>
              <label className={label}>محتوا RTL</label>
              <textarea rows={4} className={field} dir="rtl" value={cl.contentRtl} onChange={e => updClause(idx, { contentRtl: e.target.value })} />
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800">{T ? 'پیوست الف — جدول حق‌الزحمه' : 'Schedule A — Fees'}</h4>
          {!readonly && (
            <button type="button" className="text-xs px-3 py-1.5 rounded-lg border border-gray-200" onClick={() => upd({
              scheduleRows: [...draft.scheduleRows, { id: uid('sr'), tierEn: '', tierRtl: '', buildFee: '', annualFee: '', interpretation: '', selected: false }],
            })}>+ Tier</button>
          )}
        </div>
        {draft.scheduleRows.map((sr, idx) => (
          <div key={sr.id} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end border border-gray-50 rounded-lg p-2">
            <div className="md:col-span-2"><label className={label}>Tier EN</label><input className={field} value={sr.tierEn} onChange={e => updSchedule(idx, { tierEn: e.target.value })} /></div>
            <div className="md:col-span-2"><label className={label}>سطح RTL</label><input className={field} dir="rtl" value={sr.tierRtl} onChange={e => updSchedule(idx, { tierRtl: e.target.value })} /></div>
            <div><label className={label}>Build Fee</label><input className={field} dir="ltr" value={sr.buildFee} onChange={e => updSchedule(idx, { buildFee: e.target.value })} /></div>
            <div><label className={label}>Annual Fee</label><input className={field} dir="ltr" value={sr.annualFee} onChange={e => updSchedule(idx, { annualFee: e.target.value })} /></div>
            <div><label className={label}>Interp. hrs</label><input className={field} dir="ltr" value={sr.interpretation} onChange={e => updSchedule(idx, { interpretation: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={!!sr.selected} onChange={e => updSchedule(idx, { selected: e.target.checked })} />{T ? 'انتخاب‌شده' : 'Selected'}</label>
            {!readonly && <button type="button" className="text-red-400 text-xs justify-self-end" onClick={() => upd({ scheduleRows: draft.scheduleRows.filter((_, i) => i !== idx) })}>{T ? 'حذف' : 'Remove'}</button>}
          </div>
        ))}
      </section>

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
