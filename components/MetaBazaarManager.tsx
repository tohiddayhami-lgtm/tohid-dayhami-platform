import React, { useState, useRef } from 'react';
import { MetaBazaar, MetaBazaarNode, MetaShop } from '../types';
import { IconPlus, IconTrash, IconEdit, IconCopy, IconLink, IconGlobe, IconUpload, IconCheck, IconSearch } from './Icons';
import { downloadSample } from './metaShopSamples';
import { ExpoEditor } from './ExpoEditor';
import { Language } from '../App';

interface Props {
  bazaars: MetaBazaar[];
  shops: MetaShop[];
  lang: Language;
  shopBaseUrl: string;
  onSave: (b: MetaBazaar) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readonly?: boolean;
}

let _nid = 0;
const newNodeId = () => `n-${Date.now().toString(36)}-${_nid++}`;
// Immutable recursive tree helpers
const updateNodeIn = (nodes: MetaBazaarNode[], id: string, patch: Partial<MetaBazaarNode>): MetaBazaarNode[] =>
  nodes.map(n => n.id === id ? { ...n, ...patch } : { ...n, children: n.children ? updateNodeIn(n.children, id, patch) : n.children });
const addChildIn = (nodes: MetaBazaarNode[], parentId: string | null, child: MetaBazaarNode): MetaBazaarNode[] => {
  if (parentId === null) return [...nodes, child];
  return nodes.map(n => n.id === parentId ? { ...n, children: [...(n.children || []), child] } : { ...n, children: n.children ? addChildIn(n.children, parentId, child) : n.children });
};
const deleteNodeIn = (nodes: MetaBazaarNode[], id: string): MetaBazaarNode[] =>
  nodes.filter(n => n.id !== id).map(n => ({ ...n, children: n.children ? deleteNodeIn(n.children, id) : n.children }));

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `bazaar-${Date.now().toString(36)}`;
const blank = (): MetaBazaar => ({ id: `bz-${Date.now()}`, slug: '', name: '', isActive: true, defaultLang: 'en', theme: { primary: '#2d4a1a', cover: '#1f2a18' }, levelLabels: [], tree: [], createdAt: new Date().toISOString() });
const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeBazaar = (raw: string, base: MetaBazaar): MetaBazaar => {
  const j = JSON.parse(raw);
  const { _instructions, _aiInstructions, ...clean } = j;
  return {
    ...base, ...clean,
    id: base.id, createdAt: base.createdAt,
    tree: Array.isArray(j.tree) ? j.tree : (base.tree || []),
    levelLabels: Array.isArray(j.levelLabels) ? j.levelLabels : (base.levelLabels || []),
    theme: { ...(base.theme || {}), ...(j.theme || {}) },
    expo: j.expo ? { ...(base.expo || {}), ...j.expo } : base.expo,
  };
};

export const MetaBazaarManager: React.FC<Props> = ({ bazaars, shops, lang, shopBaseUrl, onSave, onDelete, readonly = false }) => {
  const [draft, setDraft] = useState<MetaBazaar | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const newFileRef = useRef<HTMLInputElement>(null);
  const updFileRef = useRef<HTMLInputElement>(null);
  const [updTarget, setUpdTarget] = useState<MetaBazaar | null>(null);
  const [shopPanelFor, setShopPanelFor] = useState<string | null>(null);
  const [shopSearch, setShopSearch] = useState('');
  const T = lang === 'fa';

  const t = {
    title: T ? 'بازارچه‌ها' : 'Bazaars', subtitle: T ? 'دایرکتوری‌های چندسطحی فروشگاه‌ها' : 'Multi-level shop directories',
    newBlank: T ? 'بازارچه جدید' : 'New bazaar', newJson: T ? 'ساخت از فایل JSON' : 'Create from JSON', sample: T ? 'دانلود نمونه بازارچه' : 'Bazaar sample',
    empty: T ? 'هنوز بازارچه‌ای نساخته‌اید.' : 'No bazaars yet.',
    open: T ? 'باز کردن' : 'Open', copy: T ? 'کپی لینک' : 'Copy link', copied: T ? 'کپی شد ✓' : 'Copied ✓',
    edit: T ? 'ویرایش' : 'Edit', duplicate: T ? 'Duplicate' : 'Duplicate', del: T ? 'حذف' : 'Delete', download: T ? 'دانلود JSON' : 'Download JSON', update: T ? 'به‌روزرسانی از JSON' : 'Update from JSON',
    back: T ? 'بازگشت' : 'Back', save: T ? 'ذخیره بازارچه' : 'Save bazaar', active: T ? 'فعال' : 'Active',
    name: T ? 'نام بازارچه' : 'Bazaar name', slug: T ? 'شناسه لینک (slug)' : 'Link slug', defLang: T ? 'زبان پیش‌فرض' : 'Default language',
    titleFa: T ? 'عنوان (فارسی)' : 'Title (FA)', titleEn: T ? 'عنوان (انگلیسی)' : 'Title (EN)', subFa: T ? 'زیرعنوان (فارسی)' : 'Subtitle (FA)', subEn: T ? 'زیرعنوان (انگلیسی)' : 'Subtitle (EN)',
    coverImg: T ? 'تصویر کاور (URL)' : 'Cover image (URL)', logo: T ? 'لوگو (URL)' : 'Logo (URL)', primary: T ? 'رنگ اصلی' : 'Primary color', cover: T ? 'رنگ کاور' : 'Cover color',
    treeNote: T ? 'دسته‌بندی چندسطحی (کشور ← شهر ← گروه کالایی ← …) و انتساب فروشگاه‌ها از طریق فایل JSON مدیریت می‌شود: دکمه «دانلود JSON» را بزنید، درخت را ویرایش کنید و دوباره «به‌روزرسانی از JSON» کنید.' : 'The multi-level tree (Country → City → Product group → …) and shop assignment is managed via JSON: click “Download JSON”, edit the tree, then “Update from JSON”.',
    nodes: T ? 'تعداد گره‌ها' : 'nodes', deleteConfirm: T ? 'این بازارچه حذف شود؟' : 'Delete this bazaar?', invalid: T ? 'فایل JSON نامعتبر است.' : 'Invalid JSON file.',
    levels: T ? 'سطوح' : 'Levels',
    structure: T ? 'ساختار دسته‌بندی' : 'Category structure',
    structureHint: T ? 'دسته‌ها را اضافه/ویرایش/حذف کنید و فروشگاه‌ها را به هر گره وصل کنید.' : 'Add/edit/delete categories and attach shops to any node.',
    levelNames: T ? 'نام سطوح' : 'Level names', addLevel: T ? 'افزودن سطح' : 'Add level',
    addRoot: T ? 'افزودن دسته اصلی' : 'Add top category', addChild: T ? 'زیرمجموعه' : 'Subcategory', delNode: T ? 'حذف' : 'Delete',
    shopsBtn: T ? 'فروشگاه‌ها' : 'Shops', noTree: T ? 'هنوز دسته‌ای اضافه نشده. «افزودن دسته اصلی» را بزنید.' : 'No categories yet. Click “Add top category”.',
    nodeFa: T ? 'نام (فارسی)' : 'Name (FA)', nodeEn: T ? 'نام (انگلیسی)' : 'Name (EN)',
    searchShop: T ? 'جستجوی فروشگاه...' : 'Search shop...', noShops: T ? 'فروشگاهی موجود نیست. ابتدا در تب «فروشگاه‌ها» بسازید.' : 'No shops. Create some in the Shops tab first.',
    newCatFa: T ? 'دسته جدید' : 'New category',
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

  const uniqueSlug = (base: string, excludeId?: string) => {
    const root = slugify(base);
    let candidate = root;
    let i = 2;
    while (bazaars.some(b => b.id !== excludeId && b.slug === candidate)) {
      candidate = `${root}-${i++}`;
    }
    return candidate;
  };

  const duplicateBazaar = async (source: MetaBazaar) => {
    const suffix = T ? 'کپی' : 'Copy';
    const copyName = `${source.name || (T ? 'بازارچه' : 'Bazaar')} ${suffix}`;
    const copy: MetaBazaar = {
      ...cloneJson(source),
      id: `bz-${Date.now()}`,
      name: copyName,
      slug: uniqueSlug(`${source.slug || source.name}-copy`),
      isActive: source.isActive !== false,
      createdAt: new Date().toISOString(),
    };
    setSaving(true);
    try {
      await onSave(copy);
      setDraft(copy);
    } catch {
      alert(T ? 'خطا در ساخت کپی بازارچه' : 'Failed to duplicate bazaar');
    } finally {
      setSaving(false);
    }
  };

  // Save the bazaar (without leaving the editor), then open the 3D expo in a new tab.
  // The preview reads the PERSISTED bazaar, so it must be saved first or it shows "not found".
  const previewExpo = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { alert(T ? 'ابتدا نام بازارچه را وارد کنید.' : 'Enter a bazaar name first.'); return; }
    const slug = (draft.slug || '').trim() || slugify(draft.name);
    if (bazaars.some(b => b.id !== draft.id && b.slug === slug)) { alert(T ? 'این شناسه قبلاً استفاده شده.' : 'Slug already used.'); return; }
    // Open the tab synchronously (inside the click) so popup blockers don't kill it.
    const w = window.open('', '_blank');
    setSaving(true);
    try {
      await onSave({ ...draft, slug });
      setDraft(d => d ? { ...d, slug } : d);
      const url = `${shopBaseUrl}?expo=${encodeURIComponent(slug)}`;
      if (w) w.location.href = url; else window.open(url, '_blank');
    } catch { if (w) w.close(); alert(T ? 'خطا در ذخیره' : 'Save failed'); }
    finally { setSaving(false); }
  };

  const upd = (patch: Partial<MetaBazaar>) => setDraft(d => d ? { ...d, ...patch } : d);
  const updCat = (field: 'title' | 'subtitle', which: 'fa' | 'en', val: string) => setDraft(d => d ? { ...d, [field]: { ...(d[field] || {}), [which]: val } } : d);
  // Tree editing
  const setTree = (fn: (tree: MetaBazaarNode[]) => MetaBazaarNode[]) => setDraft(d => d ? { ...d, tree: fn(d.tree || []) } : d);
  const addRoot = () => setTree(tr => addChildIn(tr, null, { id: newNodeId(), label: { fa: t.newCatFa, en: 'New category' }, children: [], shopSlugs: [] }));
  const addChild = (parentId: string) => setTree(tr => addChildIn(tr, parentId, { id: newNodeId(), label: { fa: t.newCatFa, en: 'New category' }, children: [], shopSlugs: [] }));
  const setNodeLabel = (id: string, which: 'fa' | 'en', val: string) => setDraft(d => { if (!d) return d; const upd2 = (nodes: MetaBazaarNode[]): MetaBazaarNode[] => nodes.map(n => n.id === id ? { ...n, label: { ...n.label, [which]: val } } : { ...n, children: n.children ? upd2(n.children) : n.children }); return { ...d, tree: upd2(d.tree || []) }; });
  const delNode = (id: string) => setTree(tr => deleteNodeIn(tr, id));
  const toggleShop = (id: string, slug: string) => setDraft(d => { if (!d) return d; const tog = (nodes: MetaBazaarNode[]): MetaBazaarNode[] => nodes.map(n => { if (n.id === id) { const cur = n.shopSlugs || []; return { ...n, shopSlugs: cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug] }; } return { ...n, children: n.children ? tog(n.children) : n.children }; }); return { ...d, tree: tog(d.tree || []) }; });
  // Level labels
  const setLevelLabel = (i: number, which: 'fa' | 'en', val: string) => setDraft(d => { if (!d) return d; const arr = [...(d.levelLabels || [])]; while (arr.length <= i) arr.push({}); arr[i] = { ...arr[i], [which]: val }; return { ...d, levelLabels: arr }; });
  const addLevel = () => setDraft(d => d ? { ...d, levelLabels: [...(d.levelLabels || []), {}] } : d);
  const removeLevel = (i: number) => setDraft(d => d ? { ...d, levelLabels: (d.levelLabels || []).filter((_, j) => j !== i) } : d);

  // Recursive visual node editor
  const NodeEditor: React.FC<{ node: MetaBazaarNode; depth: number }> = ({ node, depth }) => {
    const levelName = T ? (draft?.levelLabels?.[depth]?.fa || draft?.levelLabels?.[depth]?.en) : (draft?.levelLabels?.[depth]?.en || draft?.levelLabels?.[depth]?.fa);
    const count = (node.shopSlugs || []).length;
    const open = shopPanelFor === node.id;
    const q = shopSearch.trim().toLowerCase();
    const filteredShops = q ? shops.filter(s => `${s.name} ${s.slug}`.toLowerCase().includes(q)) : shops;
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-2.5 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {levelName && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5 shrink-0">{levelName}</span>}
          <input className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500 flex-1 min-w-[110px]" value={node.label?.fa || ''} onChange={e => setNodeLabel(node.id, 'fa', e.target.value)} placeholder={t.nodeFa} />
          <input className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-indigo-500 flex-1 min-w-[110px] dir-ltr" value={node.label?.en || ''} onChange={e => setNodeLabel(node.id, 'en', e.target.value)} placeholder={t.nodeEn} />
          <button onClick={() => { setShopPanelFor(open ? null : node.id); setShopSearch(''); }} className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${open ? 'bg-indigo-600 text-white border-indigo-600' : count ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>🛍 {t.shopsBtn}{count > 0 ? ` (${count})` : ''}</button>
          <button onClick={() => addChild(node.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addChild}</button>
          <button onClick={() => { if (confirm(T ? 'این گره و همه زیرمجموعه‌هایش حذف شود؟' : 'Delete this node and its children?')) delNode(node.id); }} className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-4 h-4" /></button>
        </div>

        {open && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            {shops.length === 0 ? <p className="text-xs text-gray-400 py-2">{t.noShops}</p> : (
              <>
                <div className="relative mb-2 max-w-xs"><IconSearch className="absolute top-1/2 -translate-y-1/2 ltr:left-2.5 rtl:right-2.5 w-3.5 h-3.5 text-gray-400" /><input value={shopSearch} onChange={e => setShopSearch(e.target.value)} placeholder={t.searchShop} className="w-full ltr:pl-8 rtl:pr-8 px-2 py-1.5 rounded-lg border border-gray-200 text-xs outline-none" /></div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {filteredShops.map(s => { const on = (node.shopSlugs || []).includes(s.slug); return (
                    <button key={s.id} onClick={() => toggleShop(node.id, s.slug)} className={`text-xs px-2.5 py-1 rounded-full border ${on ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`} title={s.slug}>{on ? '✓ ' : ''}{s.name}</button>
                  ); })}
                </div>
              </>
            )}
          </div>
        )}

        {node.children && node.children.length > 0 && (
          <div className="mt-2 ms-3 ps-2 border-s-2 border-dashed border-gray-200">
            {node.children.map(ch => <NodeEditor key={ch.id} node={ch} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  };

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
        </div>

        {/* ── Visual category structure editor ── */}
        <div className={card}>
          <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
            <h4 className="font-bold text-gray-700">{t.structure} <span className="text-xs text-gray-400">({countNodes(draft.tree)} {t.nodes})</span></h4>
            {!readonly && <button onClick={addRoot} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addRoot}</button>}
          </div>
          <p className="text-xs text-gray-500 mb-3">{t.structureHint}</p>

          {/* Level names */}
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600">{t.levelNames}</span>
              {!readonly && <button onClick={addLevel} className="text-[11px] px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addLevel}</button>}
            </div>
            <div className="space-y-1.5">
              {(draft.levelLabels || []).map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 w-5 text-center">{i + 1}</span>
                  <input className="px-2 py-1 rounded border border-gray-200 text-xs outline-none flex-1" value={l.fa || ''} onChange={e => setLevelLabel(i, 'fa', e.target.value)} placeholder={T ? 'مثلا: کشور' : 'e.g. Country'} />
                  <input className="px-2 py-1 rounded border border-gray-200 text-xs outline-none flex-1 dir-ltr" value={l.en || ''} onChange={e => setLevelLabel(i, 'en', e.target.value)} placeholder="e.g. Country" />
                  <button onClick={() => removeLevel(i)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {(draft.levelLabels || []).length === 0 && <p className="text-[11px] text-gray-400">{T ? 'بدون نام سطح (اختیاری).' : 'No level names (optional).'}</p>}
            </div>
          </div>

          {/* Tree */}
          {(draft.tree || []).length === 0
            ? <p className="text-sm text-gray-400 text-center py-6">{t.noTree}</p>
            : (draft.tree || []).map(n => <NodeEditor key={n.id} node={n} depth={0} />)}

          <p className="mt-3 text-[11px] text-gray-400">{t.treeNote}</p>
        </div>

        {/* ── Metaverse 3D exhibition for this bazaar ── */}
        <ExpoEditor
          expo={draft.expo}
          shops={shops}
          lang={lang}
          bazaarSlug={draft.slug}
          shopBaseUrl={shopBaseUrl}
          onChange={(expo) => upd({ expo })}
          onPreview={previewExpo}
          readonly={readonly}
        />
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
                  {!readonly && <button onClick={() => duplicateBazaar(b)} disabled={saving} className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-purple-600 hover:bg-purple-50 disabled:opacity-50" title={t.duplicate}><IconCopy className="w-3.5 h-3.5" /></button>}
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
