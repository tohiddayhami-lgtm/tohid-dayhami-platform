import React, { useState, useRef } from 'react';
import { MetaBazaar } from '../types';
import { IconPlus, IconTrash, IconEdit, IconCopy, IconLink, IconGlobe, IconUpload, IconCheck } from './Icons';
import { downloadSample } from './metaShopSamples';
import { Language } from '../App';

interface Props {
  bazaars: MetaBazaar[];
  lang: Language;
  shopBaseUrl: string;
  onSave: (b: MetaBazaar) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readonly?: boolean;
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `bazaar-${Date.now().toString(36)}`;
const blank = (): MetaBazaar => ({ id: `bz-${Date.now()}`, slug: '', name: '', isActive: true, defaultLang: 'en', theme: { primary: '#2d4a1a', cover: '#1f2a18' }, levelLabels: [], tree: [], createdAt: new Date().toISOString() });

const normalizeBazaar = (raw: string, base: MetaBazaar): MetaBazaar => {
  const j = JSON.parse(raw);
  return {
    ...base, ...j,
    id: base.id, createdAt: base.createdAt,
    tree: Array.isArray(j.tree) ? j.tree : [],
    levelLabels: Array.isArray(j.levelLabels) ? j.levelLabels : [],
    theme: { ...(base.theme || {}), ...(j.theme || {}) },
  };
};

export const MetaBazaarManager: React.FC<Props> = ({ bazaars, lang, shopBaseUrl, onSave, onDelete, readonly = false }) => {
  const [draft, setDraft] = useState<MetaBazaar | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const newFileRef = useRef<HTMLInputElement>(null);
  const updFileRef = useRef<HTMLInputElement>(null);
  const [updTarget, setUpdTarget] = useState<MetaBazaar | null>(null);
  const T = lang === 'fa';

  const t = {
    title: T ? 'بازارچه‌ها' : 'Bazaars', subtitle: T ? 'دایرکتوری‌های چندسطحی فروشگاه‌ها' : 'Multi-level shop directories',
    newBlank: T ? 'بازارچه جدید' : 'New bazaar', newJson: T ? 'ساخت از فایل JSON' : 'Create from JSON', sample: T ? 'دانلود نمونه بازارچه' : 'Bazaar sample',
    empty: T ? 'هنوز بازارچه‌ای نساخته‌اید.' : 'No bazaars yet.',
    open: T ? 'باز کردن' : 'Open', copy: T ? 'کپی لینک' : 'Copy link', copied: T ? 'کپی شد ✓' : 'Copied ✓',
    edit: T ? 'ویرایش' : 'Edit', del: T ? 'حذف' : 'Delete', download: T ? 'دانلود JSON' : 'Download JSON', update: T ? 'به‌روزرسانی از JSON' : 'Update from JSON',
    back: T ? 'بازگشت' : 'Back', save: T ? 'ذخیره بازارچه' : 'Save bazaar', active: T ? 'فعال' : 'Active',
    name: T ? 'نام بازارچه' : 'Bazaar name', slug: T ? 'شناسه لینک (slug)' : 'Link slug', defLang: T ? 'زبان پیش‌فرض' : 'Default language',
    titleFa: T ? 'عنوان (فارسی)' : 'Title (FA)', titleEn: T ? 'عنوان (انگلیسی)' : 'Title (EN)', subFa: T ? 'زیرعنوان (فارسی)' : 'Subtitle (FA)', subEn: T ? 'زیرعنوان (انگلیسی)' : 'Subtitle (EN)',
    coverImg: T ? 'تصویر کاور (URL)' : 'Cover image (URL)', logo: T ? 'لوگو (URL)' : 'Logo (URL)', primary: T ? 'رنگ اصلی' : 'Primary color', cover: T ? 'رنگ کاور' : 'Cover color',
    treeNote: T ? 'دسته‌بندی چندسطحی (کشور ← شهر ← گروه کالایی ← …) و انتساب فروشگاه‌ها از طریق فایل JSON مدیریت می‌شود: دکمه «دانلود JSON» را بزنید، درخت را ویرایش کنید و دوباره «به‌روزرسانی از JSON» کنید.' : 'The multi-level tree (Country → City → Product group → …) and shop assignment is managed via JSON: click “Download JSON”, edit the tree, then “Update from JSON”.',
    nodes: T ? 'تعداد گره‌ها' : 'nodes', deleteConfirm: T ? 'این بازارچه حذف شود؟' : 'Delete this bazaar?', invalid: T ? 'فایل JSON نامعتبر است.' : 'Invalid JSON file.',
    levels: T ? 'سطوح' : 'Levels',
  };

  const url = (b: MetaBazaar) => `${shopBaseUrl}?bazaar=${encodeURIComponent(b.slug)}`;
  const countNodes = (nodes: MetaBazaar['tree']): number => (nodes || []).reduce((n, x) => n + 1 + countNodes(x.children || []), 0);
  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';
  const lbl = 'block text-[13px] font-semibold text-gray-700 mb-1.5';
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';

  const downloadBazaar = (b: MetaBazaar) => {
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bazaar-${b.slug || b.id}.json`; a.click();
  };
  const handleNewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { try { setDraft(normalizeBazaar(String(ev.target?.result || ''), blank())); } catch { alert(t.invalid); } };
    r.readAsText(f); e.target.value = '';
  };
  const handleUpdFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !updTarget) return;
    const r = new FileReader();
    r.onload = async ev => {
      try { const merged: MetaBazaar = { ...normalizeBazaar(String(ev.target?.result || ''), updTarget), id: updTarget.id, slug: updTarget.slug, createdAt: updTarget.createdAt }; await onSave(merged); if (draft && draft.id === merged.id) setDraft(merged); alert(T ? 'به‌روزرسانی شد.' : 'Updated.'); }
      catch { alert(t.invalid); }
    };
    r.readAsText(f); e.target.value = ''; setUpdTarget(null);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { alert(T ? 'نام بازارچه را وارد کنید.' : 'Enter a name.'); return; }
    const slug = (draft.slug || '').trim() || slugify(draft.name);
    if (bazaars.some(b => b.id !== draft.id && b.slug === slug)) { alert(T ? 'این شناسه قبلاً استفاده شده.' : 'Slug already used.'); return; }
    setSaving(true);
    try { await onSave({ ...draft, slug }); setDraft(null); } catch { alert(T ? 'خطا در ذخیره' : 'Save failed'); } finally { setSaving(false); }
  };

  const upd = (patch: Partial<MetaBazaar>) => setDraft(d => d ? { ...d, ...patch } : d);
  const updCat = (field: 'title' | 'subtitle', which: 'fa' | 'en', val: string) => setDraft(d => d ? { ...d, [field]: { ...(d[field] || {}), [which]: val } } : d);

  // ── EDITOR ──
  if (draft) {
    return (
      <div className="space-y-5 animate-fade-in pb-10">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setDraft(null)} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
          <div className="flex items-center gap-2">
            <a href={draft.slug ? url(draft) : undefined} target="_blank" rel="noreferrer" className={`text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1 ${!draft.slug ? 'opacity-40 pointer-events-none' : ''}`}><IconGlobe className="w-3.5 h-3.5" />{t.open}</a>
            <button onClick={() => downloadBazaar(draft)} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">⤓ {t.download}</button>
            {!readonly && <button onClick={() => { setUpdTarget(draft); updFileRef.current?.click(); }} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50">⤒ {t.update}</button>}
            {!readonly && <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"><IconCheck className="w-4 h-4" />{t.save}</button>}
          </div>
        </div>

        <div className={card}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className={lbl}>{t.name}</label><input className={fld} value={draft.name} onChange={e => upd({ name: e.target.value, slug: draft.slug || slugify(e.target.value) })} /></div>
            <div><label className={lbl}>{t.slug}</label><input className={fld + ' dir-ltr'} value={draft.slug} onChange={e => upd({ slug: slugify(e.target.value) })} placeholder="my-bazaar" /></div>
            <div><label className={lbl}>{t.defLang}</label><select className={fld + ' bg-white'} value={draft.defaultLang || 'en'} onChange={e => upd({ defaultLang: e.target.value })}><option value="en">English</option><option value="fa">فارسی</option></select></div>
            <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-gray-700 pb-2"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={draft.isActive} onChange={e => upd({ isActive: e.target.checked })} />{t.active}</label></div>
            <div><label className={lbl}>{t.titleFa}</label><input className={fld} value={draft.title?.fa || ''} onChange={e => updCat('title', 'fa', e.target.value)} /></div>
            <div><label className={lbl}>{t.titleEn}</label><input className={fld + ' dir-ltr'} value={draft.title?.en || ''} onChange={e => updCat('title', 'en', e.target.value)} /></div>
            <div><label className={lbl}>{t.subFa}</label><input className={fld} value={draft.subtitle?.fa || ''} onChange={e => updCat('subtitle', 'fa', e.target.value)} /></div>
            <div><label className={lbl}>{t.subEn}</label><input className={fld + ' dir-ltr'} value={draft.subtitle?.en || ''} onChange={e => updCat('subtitle', 'en', e.target.value)} /></div>
            <div><label className={lbl}>{t.coverImg}</label><input className={fld + ' dir-ltr'} value={draft.coverImage || ''} onChange={e => upd({ coverImage: e.target.value })} /></div>
            <div><label className={lbl}>{t.logo}</label><input className={fld + ' dir-ltr'} value={draft.logo || ''} onChange={e => upd({ logo: e.target.value })} /></div>
            <div><label className={lbl}>{t.primary}</label><div className="flex gap-2"><input type="color" value={draft.theme?.primary || '#2d4a1a'} onChange={e => upd({ theme: { ...(draft.theme || {}), primary: e.target.value } })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={draft.theme?.primary || ''} onChange={e => upd({ theme: { ...(draft.theme || {}), primary: e.target.value } })} /></div></div>
            <div><label className={lbl}>{t.cover}</label><div className="flex gap-2"><input type="color" value={draft.theme?.cover || '#1f2a18'} onChange={e => upd({ theme: { ...(draft.theme || {}), cover: e.target.value } })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={draft.theme?.cover || ''} onChange={e => upd({ theme: { ...(draft.theme || {}), cover: e.target.value } })} /></div></div>
          </div>
          <div className="mt-4 text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="mb-1"><b>{t.levels}:</b> {(draft.levelLabels || []).map(l => (T ? l.fa : l.en) || (l.en || l.fa)).filter(Boolean).join(' ← ') || '—'} · <b>{countNodes(draft.tree)}</b> {t.nodes}</p>
            {t.treeNote}
          </div>
        </div>
        <input type="file" ref={updFileRef} className="hidden" accept=".json,application/json" onChange={handleUpdFile} />
      </div>
    );
  }

  // ── LIST ──
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h3 className="text-lg font-bold text-gray-800">{t.title}</h3><p className="text-xs text-gray-400">{t.subtitle} ({bazaars.length})</p></div>
        {!readonly && <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => downloadSample('bazaar')} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">⤓ {t.sample}</button>
          <button onClick={() => newFileRef.current?.click()} className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"><IconUpload className="w-4 h-4" />{t.newJson}</button>
          <button onClick={() => setDraft(blank())} className="px-3 py-2 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><IconPlus className="w-4 h-4" />{t.newBlank}</button>
        </div>}
      </div>

      {bazaars.length === 0 ? <div className={card + ' text-center py-16 text-gray-400 text-sm'}>{t.empty}</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bazaars.map(b => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="h-16 flex items-center justify-center text-white font-bold relative" style={{ background: b.theme?.cover || '#1f2a18', backgroundImage: b.coverImage ? `linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.5)), url(${b.coverImage})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <span className="text-sm px-3 text-center">🏬 {(T ? b.title?.fa : b.title?.en) || b.name}</span>
                <span className={`absolute top-2 ${T ? 'left-2' : 'right-2'} text-[10px] px-2 py-0.5 rounded-full font-bold ${b.isActive ? 'bg-emerald-500 text-white' : 'bg-gray-400 text-white'}`}>{b.isActive ? t.active : '—'}</span>
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <h4 className="font-bold text-gray-800 text-sm truncate">{b.name}</h4>
                <div className="text-[11px] text-gray-400">{countNodes(b.tree)} {t.nodes} · {(b.levelLabels || []).length} {t.levels}</div>
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-[11px] text-gray-500 truncate" dir="ltr"><IconLink className="w-3 h-3 shrink-0" /><span className="truncate">?bazaar={b.slug}</span></div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <a href={url(b)} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.open}</a>
                  <button onClick={() => { navigator.clipboard.writeText(url(b)); setCopiedId(b.id); setTimeout(() => setCopiedId(null), 1800); }} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">{copiedId === b.id ? t.copied : <><IconCopy className="w-3.5 h-3.5" />{t.copy}</>}</button>
                  <button onClick={() => downloadBazaar(b)} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">⤓</button>
                  {!readonly && <button onClick={() => { setUpdTarget(b); updFileRef.current?.click(); }} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-emerald-600 hover:bg-emerald-50">⤒</button>}
                  {!readonly && <button onClick={() => setDraft(JSON.parse(JSON.stringify(b)))} className="text-xs px-2 py-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50"><IconEdit className="w-3.5 h-3.5" /></button>}
                  {!readonly && <button onClick={() => { if (confirm(t.deleteConfirm)) onDelete(b.id); }} className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <input type="file" ref={newFileRef} className="hidden" accept=".json,application/json" onChange={handleNewFile} />
      <input type="file" ref={updFileRef} className="hidden" accept=".json,application/json" onChange={handleUpdFile} />
    </div>
  );
};
