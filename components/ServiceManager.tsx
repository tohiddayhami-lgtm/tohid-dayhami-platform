
import React, { useState, useRef } from 'react';
import { ServiceOption, Currency, SubService } from '../types';
import { IconPlus, IconEdit, IconTrash, IconCheck, IconFileText, IconCopy } from './Icons';
import { Language } from '../App';

interface Props {
  services: ServiceOption[];
  onUpdate: (services: ServiceOption[]) => void;
  readonly?: boolean;
  lang: Language;
}

const CURRENCIES: Currency[] = ['IRR', 'OMR', 'USD'];
const CUR_LABEL: Record<Currency, string> = { IRR: 'ریال', OMR: 'OMR', USD: 'USD' };

const blankForm = (): Partial<ServiceOption> => ({
  title: '', titleEn: '', description: '', descriptionEn: '',
  icon: '', price: { amount: 0, currency: 'OMR' }, isActive: true, subServices: [],
});

const blankSub = () => ({ title: '', titleEn: '', amount: 0, currency: 'OMR' as Currency });

export const ServiceManager: React.FC<Props> = ({ services, onUpdate, readonly = false, lang }) => {
  // which card is open
  const [openId,      setOpenId]      = useState<string | null>(null);
  // which service is in edit mode (null = add-new panel)
  const [editingId,   setEditingId]   = useState<string | null | 'NEW'>(null);
  const [form,        setForm]        = useState(blankForm());
  // sub-service inline forms per service id
  const [subForms,    setSubForms]    = useState<Record<string, ReturnType<typeof blankSub>>>({});
  // import state
  const [importStatus, setImportStatus] = useState<'idle'|'preview'|'error'>('idle');
  const [importData,   setImportData]   = useState<ServiceOption[]>([]);
  const [importError,  setImportError]  = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  // per-service share link "copied" feedback
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Build & copy a service-specific link that opens the request form with this service pre-selected
  const copyServiceLink = (id: string) => {
    const link = `${window.location.origin}/?page=form&service=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(link)
      .then(() => { setCopiedLinkId(id); setTimeout(() => setCopiedLinkId(null), 2000); })
      .catch(() => { window.prompt('لینک اختصاصی این خدمت:', link); });
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const fmtPrice = (amt: number, cur: Currency) =>
    amt > 0 ? `${amt.toLocaleString()} ${CUR_LABEL[cur]}` : '—';

  const toggleOpen = (id: string) =>
    setOpenId(prev => prev === id ? null : id);

  // ── add / edit service ──────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(blankForm());
    setEditingId('NEW');
    setOpenId(null);
  };

  const openEdit = (svc: ServiceOption) => {
    setForm({ ...svc, subServices: svc.subServices || [] });
    setEditingId(svc.id);
    setOpenId(svc.id);
  };

  const cancelEdit = () => { setEditingId(null); setForm(blankForm()); };

  const saveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title?.trim()) return;
    if (editingId === 'NEW') {
      const svc: ServiceOption = {
        id: `s-${Date.now()}`,
        title: form.title!,
        titleEn: form.titleEn || form.title!,
        description: form.description || '',
        descriptionEn: form.descriptionEn || form.description || '',
        icon: form.icon || '✨',
        price: form.price,
        isActive: form.isActive ?? true,
        subServices: form.subServices || [],
      };
      onUpdate([...services, svc]);
      setOpenId(svc.id);
    } else {
      onUpdate(services.map(s => s.id === editingId ? { ...s, ...form } as ServiceOption : s));
    }
    setEditingId(null);
    setForm(blankForm());
  };

  // ── delete service ──────────────────────────────────────────────────────────
  const deleteService = (id: string) => {
    if (window.confirm('آیا از حذف این خدمت اطمینان دارید؟'))
      onUpdate(services.filter(s => s.id !== id));
  };

  // ── toggle active ───────────────────────────────────────────────────────────
  const toggleActive = (id: string) =>
    onUpdate(services.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));

  // ── move up/down ────────────────────────────────────────────────────────────
  const move = (idx: number, dir: 'up' | 'down') => {
    const arr = [...services];
    if (dir === 'up' && idx > 0) [arr[idx], arr[idx-1]] = [arr[idx-1], arr[idx]];
    else if (dir === 'down' && idx < arr.length-1) [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
    onUpdate(arr);
  };

  // ── sub-service operations ──────────────────────────────────────────────────
  const getSubForm = (svcId: string) =>
    subForms[svcId] || blankSub();

  const setSubForm = (svcId: string, patch: Partial<ReturnType<typeof blankSub>>) =>
    setSubForms(p => ({ ...p, [svcId]: { ...getSubForm(svcId), ...patch } }));

  const addSubService = (svcId: string) => {
    const sf = getSubForm(svcId);
    if (!sf.title.trim()) return;
    const sub: SubService = {
      id: `sub-${Date.now()}`,
      title: sf.title,
      titleEn: sf.titleEn || sf.title,
      price: { amount: sf.amount, currency: sf.currency },
    };
    onUpdate(services.map(s =>
      s.id === svcId ? { ...s, subServices: [...(s.subServices||[]), sub] } : s
    ));
    setSubForms(p => ({ ...p, [svcId]: blankSub() }));
  };

  const removeSubService = (svcId: string, subId: string) =>
    onUpdate(services.map(s =>
      s.id === svcId ? { ...s, subServices: s.subServices?.filter(sb => sb.id !== subId) } : s
    ));

  // ── export ────────────────────────────────────────────────────────────────
  const exportJSON = () => {
    const payload = {
      _meta: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        platform: 'Tohid Dayhami Platform',
        description: 'لیست خدمات و تعرفه‌های شرکت — قابل ویرایش توسط هوش مصنوعی',
        aiInstructions: [
          'این فایل JSON شامل خدمات و تعرفه‌های شرکت است.',
          'هر آیتم در آرایه services یک خدمت اصلی است.',
          'هر خدمت می‌تواند آرایه‌ای از subServices داشته باشد.',
          'فیلدهای id را تغییر ندهید — برای حفظ یکپارچگی سیستم لازم است.',
          'برای افزودن خدمت جدید، یک شیء با id منحصربه‌فرد اضافه کنید مثل: s-new1',
          'isActive: true یعنی در فرم مشتری نمایش داده می‌شود.',
          'currency: IRR | OMR | USD',
        ],
        fieldGuide: {
          id: 'شناسه یکتا — تغییر ندهید',
          title: 'عنوان فارسی خدمت — اجباری',
          titleEn: 'عنوان انگلیسی خدمت',
          description: 'توضیحات فارسی — اجباری',
          descriptionEn: 'توضیحات انگلیسی',
          icon: 'ایموجی آیکون',
          'price.amount': 'مبلغ تعرفه پایه (عدد)',
          'price.currency': 'واحد پول: IRR | OMR | USD',
          isActive: 'نمایش در فرم مشتری: true | false',
          subServices: 'آرایه زیرمجموعه‌ها (اختیاری)',
        },
      },
      services: services.map(s => ({
        id: s.id,
        title: s.title,
        titleEn: s.titleEn || '',
        description: s.description,
        descriptionEn: s.descriptionEn || '',
        icon: s.icon || '',
        price: { amount: s.price?.amount || 0, currency: s.price?.currency || 'OMR' },
        isActive: s.isActive,
        defaultCommission: s.defaultCommission || 0,
        subServices: (s.subServices || []).map(sub => ({
          id: sub.id,
          title: sub.title,
          titleEn: sub.titleEn || '',
          price: { amount: sub.price?.amount || 0, currency: sub.price?.currency || 'OMR' },
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `services-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── import ─────────────────────────────────────────────────────────────────
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        // accept either { services: [...] } or a plain array
        const arr: unknown[] = Array.isArray(raw) ? raw : (raw?.services ?? []);
        if (!Array.isArray(arr) || arr.length === 0) throw new Error('آرایه services یافت نشد');
        // validate minimum fields
        const parsed: ServiceOption[] = arr.map((item: unknown, i: number) => {
          const it = item as Record<string, unknown>;
          if (!it.title) throw new Error(`آیتم ${i+1}: فیلد title اجباری است`);
          return {
            id:             String(it.id || `s-imp-${Date.now()}-${i}`),
            title:          String(it.title),
            titleEn:        String(it.titleEn || it.title),
            description:    String(it.description || ''),
            descriptionEn:  String(it.descriptionEn || it.description || ''),
            icon:           String(it.icon || '✨'),
            price:          it.price ? { amount: Number((it.price as Record<string,unknown>).amount||0), currency: String((it.price as Record<string,unknown>).currency||'OMR') as Currency } : { amount:0, currency:'OMR' as Currency },
            isActive:       it.isActive !== false,
            defaultCommission: Number(it.defaultCommission || 0),
            subServices:    Array.isArray(it.subServices) ? (it.subServices as Record<string,unknown>[]).map((sub, j) => ({
              id:      String(sub.id || `sub-imp-${Date.now()}-${j}`),
              title:   String(sub.title || ''),
              titleEn: String(sub.titleEn || sub.title || ''),
              price:   sub.price ? { amount: Number((sub.price as Record<string,unknown>).amount||0), currency: String((sub.price as Record<string,unknown>).currency||'OMR') as Currency } : { amount:0, currency:'OMR' as Currency },
            })) : [],
          };
        });
        setImportData(parsed);
        setImportStatus('preview');
        setImportError('');
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'خطای ناشناخته');
        setImportStatus('error');
      }
      // reset input so same file can be re-imported
      if (importRef.current) importRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const confirmImport = (mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      onUpdate(importData);
    } else {
      // merge: keep existing, add/overwrite by id
      const existing = new Map(services.map(s => [s.id, s]));
      importData.forEach(s => existing.set(s.id, s));
      onUpdate([...existing.values()]);
    }
    setImportStatus('idle');
    setImportData([]);
  };

  // ── form field component ────────────────────────────────────────────────────
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );

  const inp = "w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 transition-colors";

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800">خدمات و تعرفه‌ها</h2>
          <p className="text-xs text-gray-400 mt-0.5">{services.length} خدمت ثبت‌شده</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Export */}
          <button
            onClick={exportJSON}
            className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            title="خروجی JSON برای ویرایش با AI"
          >
            <IconFileText className="w-4 h-4 text-indigo-500"/> خروجی JSON
          </button>
          {/* Import */}
          {!readonly && (
            <>
              <button
                onClick={() => importRef.current?.click()}
                className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all"
                title="ورودی JSON از فایل"
              >
                <IconFileText className="w-4 h-4"/> ورودی JSON
              </button>
              <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile}/>
            </>
          )}
          {/* Add Service */}
          {!readonly && (
            <button
              onClick={editingId === 'NEW' ? cancelEdit : openAdd}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all ${editingId === 'NEW' ? 'bg-gray-200 text-gray-600' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}
            >
              <IconPlus className="w-4 h-4"/>
              {editingId === 'NEW' ? 'انصراف' : 'افزودن خدمت'}
            </button>
          )}
        </div>
      </div>

      {/* ── Import Error ── */}
      {importStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="text-xs font-bold text-red-700">⚠ خطا در پردازش فایل: {importError}</div>
          <button onClick={()=>setImportStatus('idle')} className="text-red-400 hover:text-red-600 text-xs font-bold">بستن</button>
        </div>
      )}

      {/* ── Import Preview Modal ── */}
      {importStatus === 'preview' && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-indigo-900">پیش‌نمایش ورودی JSON</div>
                <div className="text-xs text-indigo-500 mt-0.5">{importData.length} خدمت آماده ورود</div>
              </div>
              <button onClick={()=>setImportStatus('idle')} className="p-1.5 hover:bg-indigo-100 rounded-full text-indigo-400">✕</button>
            </div>
            {/* preview list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {importData.map(s => (
                <div key={s.id} className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <span className="text-lg shrink-0">{s.icon||'✨'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800">{s.title}
                      {s.titleEn && <span className="text-gray-400 font-normal text-xs mr-2 dir-ltr">{s.titleEn}</span>}
                    </div>
                    {s.description && <div className="text-xs text-gray-500 truncate">{s.description}</div>}
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {s.price && s.price.amount > 0 && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">{s.price.amount.toLocaleString()} {s.price.currency}</span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${s.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>{s.isActive ? 'فعال' : 'غیرفعال'}</span>
                      {(s.subServices?.length||0) > 0 && (
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{s.subServices!.length} زیرمجموعه</span>
                      )}
                      {services.find(e=>e.id===s.id) && (
                        <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold">جایگزین موجود</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* action buttons */}
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 space-y-2">
              <div className="text-xs text-gray-500 mb-3">
                <strong>جایگزینی کامل:</strong> همه خدمات فعلی پاک می‌شوند و این لیست جایگزین می‌شود.<br/>
                <strong>ادغام:</strong> خدمات جدید اضافه و خدمات موجود (با همان ID) به‌روز می‌شوند.
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setImportStatus('idle')} className="flex-1 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl">انصراف</button>
                <button onClick={()=>confirmImport('merge')} className="flex-1 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200">ادغام با موجود</button>
                <button onClick={()=>confirmImport('replace')} className="flex-1 py-2.5 text-sm font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-md shadow-rose-200">جایگزینی کامل</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add New Service Panel ── */}
      {editingId === 'NEW' && (
        <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-md overflow-hidden animate-fade-in">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
            <IconPlus className="w-4 h-4 text-indigo-600"/>
            <span className="text-sm font-bold text-indigo-800">خدمت جدید</span>
          </div>
          <form onSubmit={saveService} className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="عنوان (فارسی)">
                <input required className={inp} value={form.title||''} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="مثلاً: طراحی گرافیک"/>
              </Field>
              <Field label="عنوان (انگلیسی)">
                <input className={`${inp} dir-ltr`} value={form.titleEn||''} onChange={e=>setForm(p=>({...p,titleEn:e.target.value}))} placeholder="Graphic Design"/>
              </Field>
              <Field label="آیکون (ایموجی)">
                <input className={inp} value={form.icon||''} onChange={e=>setForm(p=>({...p,icon:e.target.value}))} placeholder="🎨"/>
              </Field>
              <Field label="تعرفه پایه">
                <div className="flex gap-2">
                  <input type="number" min="0" className={`${inp} flex-1`} value={form.price?.amount||0} onChange={e=>setForm(p=>({...p,price:{...p.price!, amount:+e.target.value}}))}/>
                  <select className="w-24 px-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white" value={form.price?.currency||'OMR'} onChange={e=>setForm(p=>({...p,price:{...p.price!, currency:e.target.value as Currency}}))}>
                    {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="توضیحات (فارسی)">
                <input className={inp} value={form.description||''} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="شرح مختصر خدمت"/>
              </Field>
              <Field label="توضیحات (انگلیسی)">
                <input className={`${inp} dir-ltr`} value={form.descriptionEn||''} onChange={e=>setForm(p=>({...p,descriptionEn:e.target.value}))} placeholder="Brief description"/>
              </Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600" checked={form.isActive??true} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))}/>
              <span className="text-sm text-gray-700">نمایش در فرم مشتری (فعال)</span>
            </label>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl">انصراف</button>
              <button type="submit" className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700">افزودن خدمت</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Service Cards ── */}
      <div className="space-y-2">
        {services.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-sm font-bold">هیچ خدمتی ثبت نشده</div>
          </div>
        )}
        {services.map((svc, idx) => {
          const isOpen   = openId === svc.id;
          const isEditing = editingId === svc.id;

          return (
            <div key={svc.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isOpen ? 'border-indigo-200 shadow-indigo-50' : 'border-gray-100'}`}>

              {/* ── Card Header ── */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                onClick={() => !isEditing && toggleOpen(svc.id)}
              >
                {/* order arrows */}
                {!readonly && (
                  <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => move(idx,'up')} disabled={idx===0} className="w-5 h-4 flex items-center justify-center text-gray-300 hover:text-indigo-500 disabled:opacity-20 text-[10px]">▲</button>
                    <button onClick={() => move(idx,'down')} disabled={idx===services.length-1} className="w-5 h-4 flex items-center justify-center text-gray-300 hover:text-indigo-500 disabled:opacity-20 text-[10px]">▼</button>
                  </div>
                )}

                {/* icon */}
                <div className="text-xl w-8 shrink-0 text-center">{svc.icon||'✨'}</div>

                {/* title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 text-sm">{svc.title}</div>
                  {svc.titleEn && <div className="text-[10px] text-gray-400 dir-ltr">{svc.titleEn}</div>}
                </div>

                {/* price */}
                {svc.price && svc.price.amount > 0 && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0 hidden sm:block">
                    {fmtPrice(svc.price.amount, svc.price.currency)}
                  </span>
                )}

                {/* sub-service count */}
                {(svc.subServices?.length||0) > 0 && (
                  <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                    {svc.subServices!.length} زیرمجموعه
                  </span>
                )}

                {/* per-service share link */}
                <button
                  onClick={e => { e.stopPropagation(); copyServiceLink(svc.id); }}
                  className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 transition-all ${copiedLinkId === svc.id ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600'}`}
                  title="کپی لینک اختصاصی فرم درخواست این خدمت (با تیک پیش‌فرض همین خدمت)"
                >
                  {copiedLinkId === svc.id ? <IconCheck className="w-3 h-3" /> : <IconCopy className="w-3 h-3" />}
                  {copiedLinkId === svc.id ? 'کپی شد' : 'لینک'}
                </button>

                {/* active toggle */}
                {!readonly && (
                  <button
                    onClick={e => { e.stopPropagation(); toggleActive(svc.id); }}
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full border shrink-0 transition-all ${svc.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                  >
                    {svc.isActive ? 'فعال' : 'غیرفعال'}
                  </button>
                )}

                {/* chevron */}
                <span className={`text-gray-400 text-xs transition-transform inline-block ${isOpen ? 'rotate-180' : ''}`}>▼</span>
              </div>

              {/* ── Card Body ── */}
              {isOpen && (
                <div className="border-t border-gray-100 animate-fade-in">

                  {/* edit form */}
                  {isEditing ? (
                    <form onSubmit={saveService} className="p-4 space-y-4 bg-indigo-50/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="عنوان (فارسی)">
                          <input required className={inp} value={form.title||''} onChange={e=>setForm(p=>({...p,title:e.target.value}))}/>
                        </Field>
                        <Field label="عنوان (انگلیسی)">
                          <input className={`${inp} dir-ltr`} value={form.titleEn||''} onChange={e=>setForm(p=>({...p,titleEn:e.target.value}))}/>
                        </Field>
                        <Field label="آیکون">
                          <input className={inp} value={form.icon||''} onChange={e=>setForm(p=>({...p,icon:e.target.value}))}/>
                        </Field>
                        <Field label="تعرفه پایه">
                          <div className="flex gap-2">
                            <input type="number" min="0" className={`${inp} flex-1`} value={form.price?.amount||0} onChange={e=>setForm(p=>({...p,price:{...p.price!, amount:+e.target.value}}))}/>
                            <select className="w-24 px-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white" value={form.price?.currency||'OMR'} onChange={e=>setForm(p=>({...p,price:{...p.price!, currency:e.target.value as Currency}}))}>
                              {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </Field>
                        <Field label="توضیحات (فارسی)">
                          <input className={inp} value={form.description||''} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
                        </Field>
                        <Field label="توضیحات (انگلیسی)">
                          <input className={`${inp} dir-ltr`} value={form.descriptionEn||''} onChange={e=>setForm(p=>({...p,descriptionEn:e.target.value}))}/>
                        </Field>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" className="w-4 h-4 rounded accent-indigo-600" checked={form.isActive??true} onChange={e=>setForm(p=>({...p,isActive:e.target.checked}))}/>
                        <span className="text-sm text-gray-700">نمایش در فرم مشتری (فعال)</span>
                      </label>
                      <div className="flex gap-2">
                        <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl">انصراف</button>
                        <button type="submit" className="px-5 py-2 text-sm font-bold bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-1.5"><IconCheck className="w-4 h-4"/>ذخیره تغییرات</button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-4 space-y-4">
                      {/* description */}
                      {svc.description && (
                        <p className="text-xs text-gray-500">{svc.description}</p>
                      )}

                      {/* sub-services list */}
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">زیرمجموعه‌ها</div>
                        <div className="space-y-1.5">
                          {(svc.subServices||[]).length === 0 && (
                            <div className="text-xs text-gray-300 italic">زیرمجموعه‌ای ثبت نشده</div>
                          )}
                          {(svc.subServices||[]).map(sub => (
                            <div key={sub.id} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"/>
                                <span className="text-sm font-medium text-gray-700">{sub.title}</span>
                                {sub.titleEn && sub.titleEn !== sub.title && (
                                  <span className="text-[10px] text-gray-400 dir-ltr">{sub.titleEn}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {sub.price && sub.price.amount > 0 && (
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    {fmtPrice(sub.price.amount, sub.price.currency)}
                                  </span>
                                )}
                                {!readonly && (
                                  <button onClick={() => removeSubService(svc.id, sub.id)} className="p-1 text-red-400 hover:bg-red-50 rounded-lg">
                                    <IconTrash className="w-3.5 h-3.5"/>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* inline add sub-service */}
                        {!readonly && (
                          <div className="mt-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3">
                            <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">افزودن زیرمجموعه</div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <input
                                className="sm:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-indigo-400"
                                placeholder="عنوان (فارسی) — مثلاً: طراحی لوگو"
                                value={getSubForm(svc.id).title}
                                onChange={e => setSubForm(svc.id, {title: e.target.value})}
                                onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addSubService(svc.id))}
                              />
                              <input
                                className="px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-indigo-400 dir-ltr"
                                placeholder="Title (EN)"
                                value={getSubForm(svc.id).titleEn}
                                onChange={e => setSubForm(svc.id, {titleEn: e.target.value})}
                              />
                              <div className="flex gap-1">
                                <input
                                  type="number" min="0"
                                  className="flex-1 px-2 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-indigo-400"
                                  placeholder="قیمت"
                                  value={getSubForm(svc.id).amount || ''}
                                  onChange={e => setSubForm(svc.id, {amount: +e.target.value})}
                                />
                                <select
                                  className="w-16 px-1 border border-gray-200 rounded-xl text-xs outline-none bg-white"
                                  value={getSubForm(svc.id).currency}
                                  onChange={e => setSubForm(svc.id, {currency: e.target.value as Currency})}
                                >
                                  {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => addSubService(svc.id)}
                              disabled={!getSubForm(svc.id).title.trim()}
                              className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5"
                            >
                              <IconPlus className="w-3.5 h-3.5"/> افزودن زیرمجموعه
                            </button>
                          </div>
                        )}
                      </div>

                      {/* actions */}
                      {!readonly && (
                        <div className="flex gap-2 pt-1 border-t border-gray-100">
                          <button
                            onClick={() => openEdit(svc)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <IconEdit className="w-3.5 h-3.5"/> ویرایش خدمت
                          </button>
                          <button
                            onClick={() => deleteService(svc.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <IconTrash className="w-3.5 h-3.5"/> حذف
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
