import React, { useRef, useState } from 'react';
import { MetaShop, MetaverseExpo, MetaverseBooth, MetaverseHotspot, HotspotType, EnvPreset, MetaShopDirCat, BoothFace } from '../types';
import { uploadFileWithProgress } from '../services/firebaseService';
import { autoArrangeBooths, shopToBoothFields } from './metaverse/expoUtils';
import { Language } from '../App';
import { IconPlus, IconTrash, IconGlobe, IconUpload, IconEdit } from './Icons';

interface Props {
  expo?: MetaverseExpo;
  shops: MetaShop[];
  lang: Language;
  bazaarSlug: string;
  shopBaseUrl: string;
  onChange: (expo: MetaverseExpo) => void;
  onPreview?: () => void | Promise<void>;  // saves the bazaar, then opens the 3D preview
  readonly?: boolean;
}

const PRESETS: EnvPreset[] = ['warehouse', 'city', 'sunset', 'dawn', 'night', 'forest', 'apartment', 'studio', 'park', 'lobby'];
const HOTSPOT_TYPES: HotspotType[] = ['product', 'company', 'video', 'pdf', 'image', 'url', 'page', 'whatsapp', 'contact', 'order'];
const PANEL_FACES: { face: BoothFace; fa: string; en: string }[] = [
  { face: 'innerBack', fa: 'دیوار پشت — داخل', en: 'Back wall — inside' },
  { face: 'innerLeft', fa: 'دیوار چپ — داخل', en: 'Left wall — inside' },
  { face: 'innerRight', fa: 'دیوار راست — داخل', en: 'Right wall — inside' },
  { face: 'outerBack', fa: 'دیوار پشت — بیرون', en: 'Back wall — outside' },
  { face: 'outerLeft', fa: 'دیوار چپ — بیرون', en: 'Left wall — outside' },
  { face: 'outerRight', fa: 'دیوار راست — بیرون', en: 'Right wall — outside' },
];

const blankExpo = (): MetaverseExpo => ({
  enabled: true, preset: 'warehouse', width: 30, depth: 30, height: 6,
  groundColor: '#cfd4dc', wallColor: '#e9edf3', spawn: { x: 0, y: 0, z: 8 }, booths: [], schemaVersion: 1,
});

const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;

export const ExpoEditor: React.FC<Props> = ({ expo, shops, lang, bazaarSlug, shopBaseUrl, onChange, onPreview, readonly = false }) => {
  const T = lang === 'fa';
  const e: MetaverseExpo = expo || { ...blankExpo(), enabled: false };
  const [openBooth, setOpenBooth] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [quickN, setQuickN] = useState(6);

  const t = {
    title: T ? 'نمایشگاه متاورس (سه‌بعدی)' : 'Metaverse Exhibition (3D)',
    hint: T ? 'یک سالن نمایشگاهی سه‌بعدی برای این بازارچه بسازید که بازدیدکنندگان با مرورگر، موبایل یا عینک VR داخلش قدم بزنند.' : 'Build a walkable 3D hall for this bazaar — visitors explore on web, mobile or a VR headset.',
    enable: T ? 'فعال‌سازی نمایشگاه سه‌بعدی' : 'Enable 3D exhibition',
    preview: T ? 'ذخیره و پیش‌نمایش نمایشگاه' : 'Save & preview exhibition',
    previewHint: T ? 'پیش‌نمایش، بازارچه را ذخیره می‌کند و نمایشگاه را در تب جدید باز می‌کند.' : 'Preview saves the bazaar and opens the exhibition in a new tab.',
    hall: T ? 'تنظیمات سالن' : 'Hall settings',
    titleFa: T ? 'عنوان (فارسی)' : 'Title (FA)', titleEn: T ? 'عنوان (انگلیسی)' : 'Title (EN)',
    subFa: T ? 'زیرعنوان (فارسی)' : 'Subtitle (FA)', subEn: T ? 'زیرعنوان (انگلیسی)' : 'Subtitle (EN)',
    width: T ? 'عرض سالن (متر)' : 'Width (m)', depth: T ? 'عمق سالن (متر)' : 'Depth (m)', height: T ? 'ارتفاع (متر)' : 'Height (m)',
    preset: T ? 'محیط/نور' : 'Environment', ground: T ? 'رنگ کف' : 'Ground color', wall: T ? 'رنگ دیوار' : 'Wall color',
    envGlb: T ? 'مدل محیط سفارشی (GLB)' : 'Custom environment GLB', skybox: T ? 'آسمان/HDR (URL)' : 'Skybox / HDR (URL)', music: T ? 'موزیک محیط (URL)' : 'Ambient music (URL)',
    spawn: T ? 'نقطه‌ی شروع بازدیدکننده' : 'Visitor start point',
    floorplan: T ? 'نقشه‌ی کف (غرفه‌ها را بکشید و جابه‌جا کنید)' : 'Floor plan (drag booths to place)',
    booths: T ? 'غرفه‌ها' : 'Booths', addBooth: T ? 'افزودن غرفه' : 'Add booth', noBooths: T ? 'هنوز غرفه‌ای اضافه نشده.' : 'No booths yet.',
    quickTitle: T ? 'چیدمان سریع' : 'Quick setup',
    quickHint: T ? 'تعداد غرفه‌ها را وارد کنید؛ فضای نمایشگاه به‌صورت خودکار اندازه و غرفه‌ها مرتب چیده می‌شوند. سپس هر غرفه را به یک فروشگاه وصل کنید.' : 'Enter how many booths — the hall is auto-sized and booths are laid out in tidy aisles. Then link each booth to a shop.',
    quickCount: T ? 'تعداد غرفه‌ها' : 'Number of booths',
    quickBuild: T ? 'ساخت و چیدمان خودکار' : 'Build & arrange',
    quickConfirm: T ? 'غرفه‌های فعلی پاک و دوباره چیده می‌شوند. ادامه می‌دهید؟' : 'Existing booths will be replaced and re-arranged. Continue?',
    screen: T ? 'ویدئوی ال‌سی‌دی غرفه' : 'Booth LCD video',
    screenHint: T ? 'لینک یوتیوب/ویمیو یا فایل mp4. روی نمایشگر داخل غرفه به‌صورت خودکار و بی‌صدا پخش می‌شود.' : 'YouTube/Vimeo link or mp4 file. Plays automatically (muted) on the in-booth LCD.',
    screenAuto: T ? 'از ویدئوی محصولات' : 'From product video',
    panels: T ? 'تابلوها و نمایشگرها (۳ داخل + ۳ بیرون)' : 'Panels & screens (3 inside + 3 outside)',
    panelsHint: T ? 'برای هر دیوار غرفه (داخل و بیرون) یک تصویر یا لینک ویدئو بگذارید. لینک ویدئو روی نمایشگر، به‌صورت خودکار و بی‌صدا پخش می‌شود؛ تصویر روی دیوار نصب می‌شود.' : 'Set an image or a video link for each booth wall (inside & outside). A video link plays automatically (muted) on a screen; an image mounts on the wall.',
    applyShop: T ? 'پر کردن اطلاعات از فروشگاه' : 'Fill from shop',
    boothFa: T ? 'نام غرفه (فارسی)' : 'Booth name (FA)', boothEn: T ? 'نام غرفه (انگلیسی)' : 'Booth name (EN)',
    shop: T ? 'فروشگاه مرتبط' : 'Linked shop', noShop: T ? '— بدون فروشگاه —' : '— none —',
    color: T ? 'رنگ غرفه' : 'Booth color', scale: T ? 'مقیاس' : 'Scale', rot: T ? 'چرخش (درجه)' : 'Rotation (deg)',
    logo: T ? 'لوگو' : 'Logo', banner: T ? 'بنر' : 'Banner', glb: T ? 'مدل GLB غرفه' : 'Booth GLB model', upload: T ? 'آپلود' : 'Upload', uploading: T ? 'در حال آپلود…' : 'Uploading…', clear: T ? 'حذف' : 'Clear',
    posX: 'X', posZ: 'Z',
    hotspots: T ? 'نشانگرهای تعاملی (هات‌اسپات)' : 'Interactive hotspots', addHotspot: T ? 'افزودن نشانگر' : 'Add hotspot', noHot: T ? 'بدون نشانگر.' : 'No hotspots.',
    hType: T ? 'نوع' : 'Type', hTitleFa: T ? 'عنوان (فا)' : 'Title (FA)', hTitleEn: T ? 'عنوان (en)' : 'Title (EN)', hBodyFa: T ? 'متن (فا)' : 'Text (FA)', hBodyEn: T ? 'متن (en)' : 'Text (EN)',
    hUrl: T ? 'لینک (ویدئو/PDF/تصویر/سایت)' : 'URL (video/pdf/image/site)', hProduct: T ? 'محصول' : 'Product', hPhone: T ? 'تلفن' : 'Phone', hWa: T ? 'واتس‌اپ' : 'WhatsApp', hEmail: T ? 'ایمیل' : 'Email',
    hPos: T ? 'موقعیت نسبت به غرفه (X/Y/Z)' : 'Position vs booth (X/Y/Z)',
    edit: T ? 'ویرایش غرفه' : 'Edit booth', glbErr: T ? 'فقط فایل GLB/GLTF مجاز است.' : 'Only GLB/GLTF files allowed.', tooBig: T ? 'حجم فایل بیش از ۳۰ مگابایت است.' : 'File exceeds 30MB.',
    typeLabels: {
      product: T ? 'محصول' : 'Product', company: T ? 'پروفایل شرکت' : 'Company', video: T ? 'ویدئو' : 'Video', pdf: T ? 'کاتالوگ PDF' : 'PDF', image: T ? 'تصویر' : 'Image',
      url: T ? 'لینک خارجی' : 'External link', page: T ? 'صفحه فروشگاه' : 'Shop page', whatsapp: 'WhatsApp', contact: T ? 'تماس' : 'Contact', order: T ? 'ثبت سفارش' : 'Order',
    } as Record<HotspotType, string>,
  };

  const fld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';
  const lbl = 'block text-[12px] font-semibold text-gray-600 mb-1';
  const card = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5';

  const patch = (p: Partial<MetaverseExpo>) => onChange({ ...e, ...p });
  const setBi = (field: 'title' | 'subtitle', which: 'fa' | 'en', val: string) => patch({ [field]: { ...(e[field] || {}), [which]: val } } as any);
  const setSpawn = (k: 'x' | 'z', v: number) => patch({ spawn: { x: e.spawn?.x ?? 0, y: 0, z: e.spawn?.z ?? 0, ...(e.spawn || {}), [k]: v } });

  // ── Booths ──
  const updBooths = (booths: MetaverseBooth[]) => patch({ booths });
  const addBooth = () => {
    const W = e.width || 30, D = e.depth || 30;
    const idx = (e.booths || []).length;
    const b: MetaverseBooth = { id: newId('booth'), name: { fa: T ? `غرفه ${idx + 1}` : `Booth ${idx + 1}`, en: `Booth ${idx + 1}` }, x: ((idx % 4) - 1.5) * (W / 5), y: 0, z: ((Math.floor(idx / 4)) - 1) * (D / 5), ry: 0, color: '#2d4a1a', hotspots: [] };
    updBooths([...(e.booths || []), b]);
    setOpenBooth(b.id);
  };
  const updBooth = (id: string, p: Partial<MetaverseBooth>) => updBooths((e.booths || []).map(b => b.id === id ? { ...b, ...p } : b));
  const delBooth = (id: string) => updBooths((e.booths || []).filter(b => b.id !== id));

  // Quick setup: ask "how many booths", auto-size the hall and arrange empty booths in aisles.
  const quickBuild = () => {
    if ((e.booths || []).length > 0 && !confirm(t.quickConfirm)) return;
    const { width, depth, spawn, cells } = autoArrangeBooths(quickN);
    const booths: MetaverseBooth[] = cells.map((c, i) => ({
      id: newId('booth'), name: { fa: `غرفه ${i + 1}`, en: `Booth ${i + 1}` },
      x: c.x, y: 0, z: c.z, ry: c.ry, color: '#2d4a1a', hotspots: [],
    }));
    patch({ width, depth, spawn, booths });
    setOpenBooth(null);
  };

  // Link a booth to a shop and pull the shop's name/logo/banner/color/video into the booth.
  const applyShopToBooth = (booth: MetaverseBooth, slug: string) => {
    if (!slug) { updBooth(booth.id, { shopSlug: undefined }); return; }
    const shop = shops.find(s => s.slug === slug);
    if (!shop) { updBooth(booth.id, { shopSlug: slug }); return; }
    updBooth(booth.id, shopToBoothFields(shop, lang));
  };
  const firstProductVideo = (slug?: string) => (slug ? (shops.find(s => s.slug === slug)?.products || []).find(p => p.videoUrl)?.videoUrl : undefined);

  // ── Booth wall panels (3 inner + 3 outer; each an image URL or a video link) ──
  const panelVal = (b: MetaverseBooth, face: BoothFace): string =>
    (b.panels?.[face]) || (face === 'innerBack' ? (b.screenUrl || b.bannerImage || '') : '');
  const setPanel = (b: MetaverseBooth, face: BoothFace, url: string) => {
    const panels = { ...(b.panels || {}) };
    if (url) panels[face] = url; else delete panels[face];
    const p: Partial<MetaverseBooth> = { panels };
    if (face === 'innerBack') { p.screenUrl = undefined; p.bannerImage = undefined; } // migrate legacy into panels
    updBooth(b.id, p);
  };

  // ── Hotspots ──
  const updHotspots = (boothId: string, hs: MetaverseHotspot[]) => updBooth(boothId, { hotspots: hs });
  const addHotspot = (b: MetaverseBooth) => {
    const h: MetaverseHotspot = { id: newId('hs'), type: 'company', x: 0, y: 1.6, z: 2, shopSlug: b.shopSlug, title: { fa: '', en: '' } };
    updHotspots(b.id, [...(b.hotspots || []), h]);
  };
  const updHotspot = (b: MetaverseBooth, hid: string, p: Partial<MetaverseHotspot>) => updHotspots(b.id, (b.hotspots || []).map(h => h.id === hid ? { ...h, ...p } : h));
  const delHotspot = (b: MetaverseBooth, hid: string) => updHotspots(b.id, (b.hotspots || []).filter(h => h.id !== hid));
  const setHotBi = (b: MetaverseBooth, hid: string, field: 'title' | 'body', which: 'fa' | 'en', val: string) => {
    const h = (b.hotspots || []).find(x => x.id === hid); if (!h) return;
    updHotspot(b, hid, { [field]: { ...((h[field] as MetaShopDirCat) || {}), [which]: val } } as any);
  };

  // ── Uploads ──
  const uploadImage = (key: string, file: File, onUrl: (u: string) => void) => {
    setUploading(key);
    uploadFileWithProgress(file, () => {}, u => { onUrl(u); setUploading(null); }, err => { alert(err.message); setUploading(null); }, 'images');
  };
  const uploadGlb = (key: string, file: File, onUrl: (u: string) => void) => {
    if (!/\.(glb|gltf)$/i.test(file.name)) { alert(t.glbErr); return; }
    if (file.size > 30 * 1024 * 1024) { alert(t.tooBig); return; }
    setUploading(key);
    uploadFileWithProgress(file, () => {}, u => { onUrl(u); setUploading(null); }, err => { alert(err.message); setUploading(null); }, 'documents');
  };

  const ImgUpload: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string }> = ({ id, value, onUrl, label }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex items-center gap-2">
          {value && <img src={value} alt="" className="w-9 h-9 rounded object-cover border border-gray-200" />}
          <button type="button" onClick={() => ref.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{uploading === id ? t.uploading : t.upload}</button>
          {value && <button type="button" onClick={() => onUrl('')} className="text-xs text-red-400 hover:text-red-600">{t.clear}</button>}
          <input type="file" ref={ref} className="hidden" accept="image/*" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadImage(id, f, onUrl); ev.target.value = ''; }} />
        </div>
      </div>
    );
  };
  const GlbUpload: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string }> = ({ id, value, onUrl, label }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex items-center gap-2">
          {value && <span className="text-[11px] text-emerald-600 font-bold">✓ GLB</span>}
          <button type="button" onClick={() => ref.current?.click()} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1"><IconUpload className="w-3.5 h-3.5" />{uploading === id ? t.uploading : t.upload}</button>
          {value && <button type="button" onClick={() => onUrl('')} className="text-xs text-red-400 hover:text-red-600">{t.clear}</button>}
          <input type="file" ref={ref} className="hidden" accept=".glb,.gltf,model/gltf-binary" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadGlb(id, f, onUrl); ev.target.value = ''; }} />
        </div>
      </div>
    );
  };

  // One wall-panel field: a URL input (image or video link) + an image-upload shortcut.
  const PanelField: React.FC<{ id: string; value?: string; onUrl: (u: string) => void; label: string; product?: string }> = ({ id, value, onUrl, label, product }) => {
    const ref = useRef<HTMLInputElement>(null);
    return (
      <div>
        <label className={lbl}>{label}</label>
        <div className="flex gap-1">
          <input className={fld + ' dir-ltr'} value={value || ''} onChange={ev => onUrl(ev.target.value)} placeholder={T ? 'لینک تصویر یا ویدئو' : 'image or video link'} />
          {!readonly && <button type="button" title={t.upload} onClick={() => ref.current?.click()} className="shrink-0 text-xs px-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"><IconUpload className="w-3.5 h-3.5" /></button>}
          {product && !readonly && <button type="button" title={t.screenAuto} onClick={() => onUrl(product)} className="shrink-0 text-[11px] px-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50">📹</button>}
          <input type="file" ref={ref} className="hidden" accept="image/*" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadImage(id, f, onUrl); ev.target.value = ''; }} />
        </div>
        {uploading === id && <span className="text-[10px] text-gray-400">{t.uploading}</span>}
      </div>
    );
  };

  // ── 2D floor-plan (drag to place) ──
  const FloorPlan: React.FC = () => {
    const svgRef = useRef<SVGSVGElement>(null);
    const W = Math.max(8, e.width || 30), D = Math.max(8, e.depth || 30);
    const dragId = useRef<string | null>(null);
    const toWorld = (clientX: number, clientY: number) => {
      const r = svgRef.current!.getBoundingClientRect();
      const nx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const ny = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      return { x: +(nx * W - W / 2).toFixed(2), z: +(ny * D - D / 2).toFixed(2) };
    };
    const onMove = (ev: React.PointerEvent) => {
      if (!dragId.current) return;
      const { x, z } = toWorld(ev.clientX, ev.clientY);
      if (dragId.current === '__spawn__') setSpawn('x', x), setSpawn('z', z);
      else updBooth(dragId.current, { x, z });
    };
    const wx = (x: number) => ((x + W / 2) / W) * 100;
    const wz = (z: number) => ((z + D / 2) / D) * 100;
    return (
      <svg
        ref={svgRef} viewBox="0 0 100 100" preserveAspectRatio="none"
        className="w-full rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-slate-100 touch-none select-none"
        style={{ aspectRatio: `${W} / ${D}`, cursor: dragId.current ? 'grabbing' : 'default' }}
        onPointerMove={onMove}
        onPointerUp={() => { dragId.current = null; }}
        onPointerLeave={() => { dragId.current = null; }}
      >
        <rect x={0.5} y={0.5} width={99} height={99} fill="none" stroke="#cbd5e1" strokeWidth={0.6} />
        {!readonly && (e.booths || []).map(b => (
          <g key={b.id} transform={`translate(${wx(b.x || 0)} ${wz(b.z || 0)})`} style={{ cursor: 'grab' }}
            onPointerDown={ev => { (ev.target as Element).setPointerCapture?.(ev.pointerId); dragId.current = b.id; }}
            onClick={() => setOpenBooth(b.id)}
          >
            <rect x={-3.2} y={-3.2} width={6.4} height={6.4} rx={1} fill={b.color || '#2d4a1a'} stroke="#fff" strokeWidth={0.5} />
            <text x={0} y={6.5} textAnchor="middle" fontSize={3} fill="#475569">{(T ? b.name?.fa : b.name?.en) || (b.name?.fa || b.name?.en) || ''}</text>
          </g>
        ))}
        {/* spawn marker */}
        <g transform={`translate(${wx(e.spawn?.x || 0)} ${wz(e.spawn?.z || 0)})`} style={{ cursor: 'grab' }}
          onPointerDown={ev => { (ev.target as Element).setPointerCapture?.(ev.pointerId); dragId.current = '__spawn__'; }}
        >
          <circle r={2.4} fill="#22d3ee" stroke="#0e7490" strokeWidth={0.6} />
          <text x={0} y={-3.2} textAnchor="middle" fontSize={3} fill="#0e7490" fontWeight="bold">{T ? 'شروع' : 'start'}</text>
        </g>
      </svg>
    );
  };

  const previewUrl = `${shopBaseUrl}?expo=${encodeURIComponent(bazaarSlug)}`;
  const shopProducts = (slug?: string) => (slug ? (shops.find(s => s.slug === slug)?.products || []) : []);

  return (
    <div className={card + ' space-y-4'}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥽</span>
          <div><h4 className="font-bold text-gray-800">{t.title}</h4><p className="text-xs text-gray-400 max-w-md">{t.hint}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {e.enabled && (
            onPreview
              ? <button type="button" onClick={() => onPreview()} title={t.previewHint} className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.preview}</button>
              : (bazaarSlug && <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5" />{t.preview}</a>)
          )}
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <input type="checkbox" className="w-4 h-4 accent-indigo-600" disabled={readonly} checked={!!e.enabled} onChange={ev => onChange({ ...(expo || blankExpo()), enabled: ev.target.checked })} />
            {t.enable}
          </label>
        </div>
      </div>

      {e.enabled && (
        <div className="space-y-5 animate-fade-in">
          {/* Hall settings */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h5 className="font-bold text-gray-700 text-sm mb-3">{t.hall}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label className={lbl}>{t.titleFa}</label><input className={fld} value={e.title?.fa || ''} onChange={ev => setBi('title', 'fa', ev.target.value)} /></div>
              <div><label className={lbl}>{t.titleEn}</label><input className={fld + ' dir-ltr'} value={e.title?.en || ''} onChange={ev => setBi('title', 'en', ev.target.value)} /></div>
              <div><label className={lbl}>{t.preset}</label><select className={fld + ' bg-white'} value={e.preset || 'warehouse'} onChange={ev => patch({ preset: ev.target.value as EnvPreset })}>{PRESETS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className={lbl}>{t.subFa}</label><input className={fld} value={e.subtitle?.fa || ''} onChange={ev => setBi('subtitle', 'fa', ev.target.value)} /></div>
              <div><label className={lbl}>{t.subEn}</label><input className={fld + ' dir-ltr'} value={e.subtitle?.en || ''} onChange={ev => setBi('subtitle', 'en', ev.target.value)} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className={lbl}>{t.width}</label><input type="number" className={fld} value={e.width ?? 30} onChange={ev => patch({ width: +ev.target.value })} /></div>
                <div><label className={lbl}>{t.depth}</label><input type="number" className={fld} value={e.depth ?? 30} onChange={ev => patch({ depth: +ev.target.value })} /></div>
                <div><label className={lbl}>{t.height}</label><input type="number" className={fld} value={e.height ?? 6} onChange={ev => patch({ height: +ev.target.value })} /></div>
              </div>
              <div><label className={lbl}>{t.ground}</label><div className="flex gap-2"><input type="color" value={e.groundColor || '#cfd4dc'} onChange={ev => patch({ groundColor: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={e.groundColor || ''} onChange={ev => patch({ groundColor: ev.target.value })} /></div></div>
              <div><label className={lbl}>{t.wall}</label><div className="flex gap-2"><input type="color" value={e.wallColor || '#e9edf3'} onChange={ev => patch({ wallColor: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={e.wallColor || ''} onChange={ev => patch({ wallColor: ev.target.value })} /></div></div>
              <GlbUpload id="env-glb" value={e.environmentUrl} onUrl={u => patch({ environmentUrl: u || undefined })} label={t.envGlb} />
              <div><label className={lbl}>{t.skybox}</label><input className={fld + ' dir-ltr'} value={e.skyboxUrl || ''} onChange={ev => patch({ skyboxUrl: ev.target.value || undefined })} placeholder="https://…/sky.hdr" /></div>
              <div><label className={lbl}>{t.music}</label><input className={fld + ' dir-ltr'} value={e.music || ''} onChange={ev => patch({ music: ev.target.value || undefined })} placeholder="https://…/ambient.mp3" /></div>
            </div>
          </div>

          {/* Floor plan */}
          <div className="border border-gray-100 rounded-xl p-4">
            <h5 className="font-bold text-gray-700 text-sm mb-3">{t.floorplan}</h5>
            <FloorPlan />
          </div>

          {/* Quick setup — N booths → auto-arrange */}
          {!readonly && (
            <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-4">
              <h5 className="font-bold text-indigo-700 text-sm mb-1">⚡ {t.quickTitle}</h5>
              <p className="text-[12px] text-indigo-600/80 mb-3 max-w-2xl">{t.quickHint}</p>
              <div className="flex items-end gap-2 flex-wrap">
                <div><label className={lbl}>{t.quickCount}</label><input type="number" min={1} max={60} className={fld + ' w-28'} value={quickN} onChange={ev => setQuickN(Math.max(1, Math.min(60, +ev.target.value || 1)))} /></div>
                <button onClick={quickBuild} className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-bold flex items-center gap-1"><IconPlus className="w-4 h-4" />{t.quickBuild}</button>
              </div>
            </div>
          )}

          {/* Booths */}
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-bold text-gray-700 text-sm">{t.booths} <span className="text-xs text-gray-400">({(e.booths || []).length})</span></h5>
              {!readonly && <button onClick={addBooth} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.addBooth}</button>}
            </div>
            {(e.booths || []).length === 0 ? <p className="text-sm text-gray-400 text-center py-4">{t.noBooths}</p> : (
              <div className="space-y-2">
                {(e.booths || []).map(b => {
                  const open = openBooth === b.id;
                  return (
                    <div key={b.id} className="rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2 p-2.5">
                        <span className="w-4 h-4 rounded shrink-0" style={{ background: b.color || '#2d4a1a' }} />
                        <span className="text-sm font-medium text-gray-700 flex-1 truncate">{(T ? b.name?.fa : b.name?.en) || b.name?.fa || b.name?.en || '—'}</span>
                        {b.shopSlug && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{b.shopSlug}</span>}
                        <span className="text-[10px] text-gray-400">{(b.hotspots || []).length} ⭐</span>
                        <button onClick={() => setOpenBooth(open ? null : b.id)} className="text-xs px-2 py-1 rounded-lg text-indigo-500 hover:bg-indigo-50 flex items-center gap-1"><IconEdit className="w-3.5 h-3.5" />{t.edit}</button>
                        {!readonly && <button onClick={() => delBooth(b.id)} className="text-xs px-2 py-1 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-3.5 h-3.5" /></button>}
                      </div>

                      {open && (
                        <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div><label className={lbl}>{t.boothFa}</label><input className={fld} value={b.name?.fa || ''} onChange={ev => updBooth(b.id, { name: { ...(b.name || {}), fa: ev.target.value } })} /></div>
                            <div><label className={lbl}>{t.boothEn}</label><input className={fld + ' dir-ltr'} value={b.name?.en || ''} onChange={ev => updBooth(b.id, { name: { ...(b.name || {}), en: ev.target.value } })} /></div>
                            <div><label className={lbl}>{t.shop}</label>
                              <div className="flex gap-1.5">
                                <select className={fld + ' bg-white'} value={b.shopSlug || ''} onChange={ev => applyShopToBooth(b, ev.target.value)}>
                                  <option value="">{t.noShop}</option>
                                  {shops.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}
                                </select>
                                {b.shopSlug && !readonly && <button type="button" title={t.applyShop} onClick={() => applyShopToBooth(b, b.shopSlug!)} className="shrink-0 text-xs px-2 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50">↻</button>}
                              </div>
                            </div>
                            <div><label className={lbl}>{t.color}</label><div className="flex gap-2"><input type="color" value={b.color || '#2d4a1a'} onChange={ev => updBooth(b.id, { color: ev.target.value })} className="w-10 h-9 rounded border border-gray-300" /><input className={fld + ' dir-ltr'} value={b.color || ''} onChange={ev => updBooth(b.id, { color: ev.target.value })} /></div></div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className={lbl}>{t.scale}</label><input type="number" step="0.1" className={fld} value={b.scale ?? 1} onChange={ev => updBooth(b.id, { scale: +ev.target.value })} /></div>
                              <div><label className={lbl}>{t.rot}</label><input type="number" className={fld} value={Math.round(((b.ry || 0) * 180 / Math.PI))} onChange={ev => updBooth(b.id, { ry: (+ev.target.value) * Math.PI / 180 })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><label className={lbl}>{t.posX}</label><input type="number" step="0.5" className={fld} value={b.x ?? 0} onChange={ev => updBooth(b.id, { x: +ev.target.value })} /></div>
                              <div><label className={lbl}>{t.posZ}</label><input type="number" step="0.5" className={fld} value={b.z ?? 0} onChange={ev => updBooth(b.id, { z: +ev.target.value })} /></div>
                            </div>
                            <ImgUpload id={`logo-${b.id}`} value={b.logo} onUrl={u => updBooth(b.id, { logo: u || undefined })} label={t.logo} />
                            <GlbUpload id={`glb-${b.id}`} value={b.modelUrl} onUrl={u => updBooth(b.id, { modelUrl: u || undefined })} label={t.glb} />
                          </div>

                          {/* Six wall panels (3 inner + 3 outer) — image or video per surface */}
                          <div className="border-t border-gray-100 pt-2">
                            <span className="text-xs font-bold text-gray-600">🖼 {t.panels}</span>
                            <p className="text-[11px] text-gray-400 mb-2 mt-0.5">{t.panelsHint}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                              {PANEL_FACES.map(pf => (
                                <PanelField key={pf.face} id={`panel-${b.id}-${pf.face}`} label={T ? pf.fa : pf.en}
                                  value={panelVal(b, pf.face)} onUrl={u => setPanel(b, pf.face, u)}
                                  product={pf.face === 'innerBack' ? firstProductVideo(b.shopSlug) : undefined} />
                              ))}
                            </div>
                          </div>

                          {/* Hotspots */}
                          <div className="border-t border-gray-100 pt-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-gray-600">{t.hotspots} <span className="text-gray-400">({(b.hotspots || []).length})</span></span>
                              {!readonly && <button onClick={() => addHotspot(b)} className="text-[11px] px-2 py-1 rounded bg-white border border-gray-200 hover:bg-gray-50 flex items-center gap-1"><IconPlus className="w-3 h-3" />{t.addHotspot}</button>}
                            </div>
                            {(b.hotspots || []).length === 0 ? <p className="text-[11px] text-gray-400">{t.noHot}</p> : (
                              <div className="space-y-2">
                                {(b.hotspots || []).map(h => (
                                  <div key={h.id} className="rounded-lg border border-gray-200 bg-white p-2.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                    <div><label className={lbl}>{t.hType}</label><select className={fld + ' bg-white'} value={h.type} onChange={ev => updHotspot(b, h.id, { type: ev.target.value as HotspotType })}>{HOTSPOT_TYPES.map(ht => <option key={ht} value={ht}>{t.typeLabels[ht]}</option>)}</select></div>
                                    <div><label className={lbl}>{t.hTitleFa}</label><input className={fld} value={h.title?.fa || ''} onChange={ev => setHotBi(b, h.id, 'title', 'fa', ev.target.value)} /></div>
                                    <div><label className={lbl}>{t.hTitleEn}</label><input className={fld + ' dir-ltr'} value={h.title?.en || ''} onChange={ev => setHotBi(b, h.id, 'title', 'en', ev.target.value)} /></div>
                                    <div className="flex items-end justify-end gap-2">
                                      {!readonly && <button onClick={() => delHotspot(b, h.id)} className="text-xs px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-50"><IconTrash className="w-3.5 h-3.5" /></button>}
                                    </div>
                                    {['video', 'pdf', 'image', 'url'].includes(h.type) && <div className="md:col-span-2 lg:col-span-2"><label className={lbl}>{t.hUrl}</label><input className={fld + ' dir-ltr'} value={h.url || ''} onChange={ev => updHotspot(b, h.id, { url: ev.target.value })} /></div>}
                                    {['company', 'order', 'page', 'product'].includes(h.type) && <div><label className={lbl}>{t.shop}</label><select className={fld + ' bg-white'} value={h.shopSlug || ''} onChange={ev => updHotspot(b, h.id, { shopSlug: ev.target.value || undefined })}><option value="">{t.noShop}</option>{shops.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}</select></div>}
                                    {h.type === 'product' && <div><label className={lbl}>{t.hProduct}</label><select className={fld + ' bg-white'} value={h.productRef || ''} onChange={ev => updHotspot(b, h.id, { productRef: ev.target.value || undefined })}><option value="">—</option>{shopProducts(h.shopSlug).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>}
                                    {h.type === 'whatsapp' && <div><label className={lbl}>{t.hWa}</label><input className={fld + ' dir-ltr'} value={h.whatsapp || ''} onChange={ev => updHotspot(b, h.id, { whatsapp: ev.target.value })} placeholder="+98…" /></div>}
                                    {h.type === 'contact' && <>
                                      <div><label className={lbl}>{t.hPhone}</label><input className={fld + ' dir-ltr'} value={h.phone || ''} onChange={ev => updHotspot(b, h.id, { phone: ev.target.value })} /></div>
                                      <div><label className={lbl}>{t.hEmail}</label><input className={fld + ' dir-ltr'} value={h.email || ''} onChange={ev => updHotspot(b, h.id, { email: ev.target.value })} /></div>
                                    </>}
                                    {['info', 'contact', 'company', 'whatsapp'].includes(h.type) && <div className="md:col-span-2"><label className={lbl}>{t.hBodyFa}</label><input className={fld} value={h.body?.fa || ''} onChange={ev => setHotBi(b, h.id, 'body', 'fa', ev.target.value)} /></div>}
                                    <div className="md:col-span-2 lg:col-span-4 grid grid-cols-3 gap-2">
                                      <div><label className={lbl}>{t.hPos} X</label><input type="number" step="0.25" className={fld} value={h.x ?? 0} onChange={ev => updHotspot(b, h.id, { x: +ev.target.value })} /></div>
                                      <div><label className={lbl}>Y</label><input type="number" step="0.25" className={fld} value={h.y ?? 1.6} onChange={ev => updHotspot(b, h.id, { y: +ev.target.value })} /></div>
                                      <div><label className={lbl}>Z</label><input type="number" step="0.25" className={fld} value={h.z ?? 2} onChange={ev => updHotspot(b, h.id, { z: +ev.target.value })} /></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
