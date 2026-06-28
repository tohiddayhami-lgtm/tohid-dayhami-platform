import React, { useCallback, useRef, useState } from 'react';
import type { MetaShop, MetaShopFloatingAnimation, MetaShopFloatingLinkType, MetaShopFloatingPositionAnchor, MetaShopFloatingSticker } from '../types';
import { IconPlus, IconTrash, IconUpload } from './Icons';
import {
  MAX_FLOATING_STICKERS,
  clampSticker,
  newFloatingSticker,
  prepareStickerForDisplay,
  resolveStickerAnchor,
  stickerCanvasPositionStyle,
} from '../utils/metaShopFloatingStickers';
import { normalizeShopCategories } from '../utils/metaShopCategories';

interface Props {
  shop?: MetaShop;
  /** When set (bazaar editor), product/category/page links pick from these shops. */
  linkedShops?: MetaShop[];
  stickers: MetaShopFloatingSticker[];
  onChange: (stickers: MetaShopFloatingSticker[]) => void;
  uploadImage: (file: File, onUrl: (url: string) => void) => void;
  T: boolean;
  fld: string;
  lbl: string;
}

const BASE_LINK_TYPES: { id: MetaShopFloatingLinkType; fa: string; en: string }[] = [
  { id: 'product', fa: 'محصول', en: 'Product' },
  { id: 'category', fa: 'دسته', en: 'Category' },
  { id: 'page', fa: 'صفحه داخلی', en: 'Internal page' },
  { id: 'external', fa: 'لینک خارجی', en: 'External URL' },
];

const SHOP_LINK_TYPE: { id: MetaShopFloatingLinkType; fa: string; en: string } = {
  id: 'shop', fa: 'ورود به فروشگاه', en: 'Enter shop',
};

const ANIMATIONS: { id: MetaShopFloatingAnimation; fa: string; en: string }[] = [
  { id: 'none', fa: 'بدون انیمیشن', en: 'None' },
  { id: 'productSpin360', fa: 'چرخش ۳۶۰° محصول (3D)', en: '360° Product Spin (3D)' },
  { id: 'float', fa: 'شناور (بالا/پایین)', en: 'Float' },
  { id: 'bounce', fa: 'پرش', en: 'Bounce' },
  { id: 'pulse', fa: 'ضربان', en: 'Pulse' },
  { id: 'shake', fa: 'لرزش', en: 'Shake' },
  { id: 'spin', fa: 'چرخش مسطح (2D)', en: 'Flat spin (2D)' },
];

const ANCHORS: { id: MetaShopFloatingPositionAnchor; fa: string; en: string }[] = [
  { id: 'bottom-right', fa: 'گوشه پایین راست', en: 'Bottom right' },
  { id: 'bottom-left', fa: 'گوشه پایین چپ', en: 'Bottom left' },
  { id: 'top-right', fa: 'گوشه بالا راست', en: 'Top right' },
  { id: 'top-left', fa: 'گوشه بالا چپ', en: 'Top left' },
  { id: 'free', fa: 'موقعیت آزاد (وسط صفحه)', en: 'Free placement' },
];

const shopForSticker = (s: MetaShopFloatingSticker, shop?: MetaShop, linkedShops?: MetaShop[]): MetaShop | null => {
  if (linkedShops?.length) {
    const slug = s.linkShopSlug || linkedShops[0]?.slug;
    return linkedShops.find(x => x.slug === slug) || linkedShops[0] || null;
  }
  return shop || null;
};

const speedDur = (baseSec: number, speed?: number) => {
  const s = Math.min(2, Math.max(0.5, speed ?? 1));
  return `${(baseSec / s).toFixed(2)}s`;
};

const previewAnimStyle = (sticker: MetaShopFloatingSticker): React.CSSProperties => {
  const anim = sticker.animation || 'none';
  const speed = sticker.animationSpeed ?? 1;
  const rot = sticker.rotation ?? 0;
  const base: React.CSSProperties = {
    willChange: 'transform',
    ['--ms-fps-rot' as string]: `${rot}deg`,
  };
  switch (anim) {
    case 'float':
      return { ...base, animation: `ms-fps-float ${speedDur(4, speed)} ease-in-out infinite` };
    case 'bounce':
      return { ...base, animation: `ms-fps-bounce ${speedDur(1.8, speed)} ease-in-out infinite` };
    case 'pulse':
      return { ...base, animation: `ms-fps-pulse ${speedDur(2, speed)} ease-in-out infinite` };
    case 'shake':
      return { ...base, animation: `ms-fps-shake ${speedDur(0.6, speed)} ease-in-out infinite` };
    case 'spin':
      return { ...base, animation: `ms-fps-spin ${speedDur(6, speed)} linear infinite` };
    case 'productSpin360':
      return {
        ...base,
        perspective: '900px',
        perspectiveOrigin: 'center center',
      };
    default:
      return rot ? { ...base, transform: `rotate(${rot}deg)` } : base;
  }
};

export const MetaShopFloatingPromosEditor: React.FC<Props> = ({
  shop,
  linkedShops,
  stickers,
  onChange,
  uploadImage,
  T,
  fld,
  lbl,
}) => {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(stickers[0]?.id || null);
  const [uploading, setUploading] = useState<string | null>(null);

  const linkTypes = linkedShops?.length
    ? [SHOP_LINK_TYPE, ...BASE_LINK_TYPES]
    : BASE_LINK_TYPES;

  const upd = (idx: number, patch: Partial<MetaShopFloatingSticker>) => {
    const next = [...stickers];
    next[idx] = clampSticker({ ...next[idx], ...patch });
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(stickers.filter((_, i) => i !== idx));
  };

  const add = () => {
    if (stickers.length >= MAX_FLOATING_STICKERS) return;
    const s = newFloatingSticker();
    onChange([...stickers, s]);
    setExpanded(s.id);
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (!canvasRef.current) return;
    const s = stickers.find(x => x.id === id);
    if (!s) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: s.positionX, origY: s.positionY };
  };

  const pointerToPosition = (clientX: number, clientY: number, anchor: MetaShopFloatingPositionAnchor) => {
    if (!canvasRef.current) return { x: 4, y: 4 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clamp = (v: number, max = 45) => Math.min(max, Math.max(0, v));
    switch (anchor) {
      case 'bottom-left':
        return {
          x: clamp(((clientX - rect.left) / rect.width) * 100),
          y: clamp(((rect.bottom - clientY) / rect.height) * 100),
        };
      case 'top-right':
        return {
          x: clamp(((rect.right - clientX) / rect.width) * 100),
          y: clamp(((clientY - rect.top) / rect.height) * 100),
        };
      case 'top-left':
        return {
          x: clamp(((clientX - rect.left) / rect.width) * 100),
          y: clamp(((clientY - rect.top) / rect.height) * 100),
        };
      case 'free':
        return {
          x: clamp(((clientX - rect.left) / rect.width) * 100, 100),
          y: clamp(((clientY - rect.top) / rect.height) * 100, 100),
        };
      case 'bottom-right':
      default:
        return {
          x: clamp(((rect.right - clientX) / rect.width) * 100),
          y: clamp(((rect.bottom - clientY) / rect.height) * 100),
        };
    }
  };

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !canvasRef.current) return;
    const idx = stickers.findIndex(x => x.id === d.id);
    if (idx < 0) return;
    const s = stickers[idx];
    const anchor = resolveStickerAnchor(s);
    if (anchor === 'free') {
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;
      upd(idx, {
        positionX: Math.min(100, Math.max(0, d.origX + dx)),
        positionY: Math.min(100, Math.max(0, d.origY + dy)),
      });
      return;
    }
    const pos = pointerToPosition(e.clientX, e.clientY, anchor);
    upd(idx, { positionX: pos.x, positionY: pos.y });
  }, [stickers]);

  const onPointerUp = () => { dragRef.current = null; };

  const togglePageId = (idx: number, pageId: string) => {
    const cur = stickers[idx].pageIds || [];
    const next = cur.includes(pageId) ? cur.filter(x => x !== pageId) : [...cur, pageId];
    upd(idx, { pageIds: next });
  };

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes ms-fps-float { 0%,100%{transform:translateY(0) rotate(var(--ms-fps-rot,0deg))} 50%{transform:translateY(-12px) rotate(var(--ms-fps-rot,0deg))} }
        @keyframes ms-fps-bounce { 0%,100%{transform:translateY(0) rotate(var(--ms-fps-rot,0deg))} 50%{transform:translateY(-18px) rotate(var(--ms-fps-rot,0deg))} }
        @keyframes ms-fps-pulse { 0%,100%{transform:scale(1) rotate(var(--ms-fps-rot,0deg))} 50%{transform:scale(1.06) rotate(var(--ms-fps-rot,0deg))} }
        @keyframes ms-fps-shake { 0%,100%{transform:translateX(0) rotate(var(--ms-fps-rot,0deg))} 25%{transform:translateX(-4px) rotate(var(--ms-fps-rot,0deg))} 75%{transform:translateX(4px) rotate(var(--ms-fps-rot,0deg))} }
        @keyframes ms-fps-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes ms-fps-product-spin { from{transform:rotateY(0deg)} to{transform:rotateY(360deg)} }
      `}</style>

      <div
        ref={canvasRef}
        className="relative w-full rounded-xl border-2 border-dashed border-indigo-200 bg-gradient-to-br from-slate-50 to-indigo-50/30 overflow-hidden select-none touch-none"
        style={{ aspectRatio: '16/10', minHeight: 200 }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="grid grid-cols-3 gap-2 p-4 h-full">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="rounded-lg bg-white/80 border border-gray-200" />
            ))}
          </div>
        </div>
        <p className="absolute top-2 inset-x-0 text-center text-[10px] text-indigo-500/80 font-medium pointer-events-none">
          {T ? 'پیش‌نمایش — استیکر را به گوشه پایین بکشید' : 'Preview — drag sticker to bottom corner'}
        </p>
        <div className="absolute bottom-1 end-1 w-8 h-8 border-b-2 border-e-2 border-indigo-300/60 rounded-br-lg pointer-events-none" title="" />
        {stickers.filter(s => s.imageUrl).map(s => {
          const disp = prepareStickerForDisplay(s);
          const is3d = (s.animation || 'none') === 'productSpin360';
          return (
          <div
            key={s.id}
            className="cursor-grab active:cursor-grabbing touch-none"
            style={{
              ...stickerCanvasPositionStyle(disp),
              width: Math.min(s.width, 160),
              height: Math.min(s.height, 200),
              zIndex: s.zIndex ?? 9000,
              opacity: s.enabled === false ? 0.35 : 1,
            }}
            onPointerDown={e => onPointerDown(e, s.id)}
          >
            <div className="w-full h-full" style={previewAnimStyle(s)}>
              {is3d ? (
                <div style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', animation: `ms-fps-product-spin ${speedDur(8, s.animationSpeed ?? 1)} linear infinite` }}>
                  <img src={s.imageUrl} alt="" className="w-full h-full object-contain pointer-events-none drop-shadow-md" draggable={false} />
                </div>
              ) : (
                <img src={s.imageUrl} alt="" className="w-full h-full object-contain pointer-events-none drop-shadow-md" draggable={false} />
              )}
            </div>
          </div>
        );})}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {T ? `حداکثر ${MAX_FLOATING_STICKERS} استیکر` : `Up to ${MAX_FLOATING_STICKERS} stickers`}
          {' '}({stickers.length}/{MAX_FLOATING_STICKERS})
        </span>
        <button
          type="button"
          onClick={add}
          disabled={stickers.length >= MAX_FLOATING_STICKERS}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1"
        >
          <IconPlus className="w-3.5 h-3.5" />
          {T ? 'افزودن استیکر' : 'Add sticker'}
        </button>
      </div>

      {stickers.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          {T ? 'هنوز استیکر تبلیغاتی تعریف نشده است.' : 'No floating stickers yet.'}
        </p>
      )}

      {stickers.map((s, idx) => {
        const open = expanded === s.id;
        const ctx = shopForSticker(s, shop, linkedShops);
        const products = (ctx?.products || []).filter(p => p.active !== false);
        const categories = normalizeShopCategories(ctx?.categories, ctx?.products || []);
        const pages = ctx?.pages || [];
        return (
          <div key={s.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-start"
              onClick={() => setExpanded(open ? null : s.id)}
            >
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" className="w-8 h-8 object-contain rounded bg-white border" />
              ) : (
                <span className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">PNG</span>
              )}
              <span className="flex-1 text-sm font-bold text-gray-700 truncate">
                {s.label || (T ? `استیکر ${idx + 1}` : `Sticker ${idx + 1}`)}
              </span>
              <label className="flex items-center gap-1 text-xs text-gray-600" onClick={e => e.stopPropagation()}>
                <input type="checkbox" className="accent-indigo-600" checked={s.enabled !== false} onChange={e => upd(idx, { enabled: e.target.checked })} />
                {T ? 'فعال' : 'On'}
              </label>
              <button type="button" onClick={e => { e.stopPropagation(); remove(idx); }} className="text-red-400 hover:text-red-600 p-1">
                <IconTrash className="w-4 h-4" />
              </button>
            </button>

            {open && (
              <div className="p-3 space-y-3 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>{T ? 'برچسب داخلی (اختیاری)' : 'Internal label (optional)'}</label>
                    <input className={fld} value={s.label || ''} onChange={e => upd(idx, { label: e.target.value })} />
                  </div>
                  <div>
                    <label className={lbl}>{T ? 'تصویر PNG' : 'PNG image'}</label>
                    <div className="flex items-center gap-2">
                      {s.imageUrl && <img src={s.imageUrl} className="w-12 h-12 object-contain rounded border bg-white" alt="" />}
                      <button
                        type="button"
                        onClick={() => fileRefs.current[s.id]?.click()}
                        disabled={uploading === s.id}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm flex items-center gap-1"
                      >
                        <IconUpload className="w-4 h-4" />
                        {uploading === s.id ? (T ? 'آپلود…' : 'Upload…') : (T ? 'آپلود PNG' : 'Upload PNG')}
                      </button>
                      <input
                        type="file"
                        ref={el => { fileRefs.current[s.id] = el; }}
                        className="hidden"
                        accept="image/png,image/webp,image/gif,image/*"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setUploading(s.id);
                          uploadImage(f, url => { upd(idx, { imageUrl: url }); setUploading(null); });
                          e.target.value = '';
                        }}
                      />
                    </div>
                    <input className={fld + ' dir-ltr text-xs mt-1'} placeholder="https://…" value={s.imageUrl} onChange={e => upd(idx, { imageUrl: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={lbl}>{T ? 'نوع لینک' : 'Link type'}</label>
                    <select className={fld + ' bg-white'} value={s.linkType} onChange={e => {
                      const linkType = e.target.value as MetaShopFloatingLinkType;
                      const patch: Partial<MetaShopFloatingSticker> = { linkType, linkTarget: '' };
                      if (linkedShops?.length && linkType !== 'external' && linkType !== 'shop' && !s.linkShopSlug) {
                        patch.linkShopSlug = linkedShops[0]?.slug;
                      }
                      upd(idx, patch);
                    }}>
                      {linkTypes.map(lt => <option key={lt.id} value={lt.id}>{T ? lt.fa : lt.en}</option>)}
                    </select>
                  </div>
                  {linkedShops && linkedShops.length > 0 && (s.linkType === 'product' || s.linkType === 'category' || s.linkType === 'page') && (
                    <div className="md:col-span-4">
                      <label className={lbl}>{T ? 'فروشگاه مقصد' : 'Target shop'}</label>
                      <select
                        className={fld + ' bg-white'}
                        value={s.linkShopSlug || linkedShops[0]?.slug || ''}
                        onChange={e => upd(idx, { linkShopSlug: e.target.value, linkTarget: '' })}
                      >
                        {linkedShops.map(sh => (
                          <option key={sh.slug} value={sh.slug}>{sh.name || sh.slug}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className={linkedShops?.length && (s.linkType === 'product' || s.linkType === 'category' || s.linkType === 'page') ? 'md:col-span-4' : 'col-span-2'}>
                    <label className={lbl}>{T ? 'مقصد لینک' : 'Link target'}</label>
                    {s.linkType === 'shop' && linkedShops && (
                      <select className={fld + ' bg-white'} value={s.linkTarget || ''} onChange={e => upd(idx, { linkTarget: e.target.value })}>
                        <option value="">{T ? '— انتخاب فروشگاه —' : '— Select shop —'}</option>
                        {linkedShops.map(sh => (
                          <option key={sh.slug} value={sh.slug}>{sh.name || sh.slug}</option>
                        ))}
                      </select>
                    )}
                    {s.linkType === 'product' && (
                      <select className={fld + ' bg-white'} value={s.linkTarget || ''} onChange={e => upd(idx, { linkTarget: e.target.value })}>
                        <option value="">{T ? '— انتخاب محصول —' : '— Select product —'}</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                      </select>
                    )}
                    {s.linkType === 'category' && (
                      <select className={fld + ' bg-white'} value={s.linkTarget || ''} onChange={e => upd(idx, { linkTarget: e.target.value })}>
                        <option value="">{T ? '— انتخاب دسته —' : '— Select category —'}</option>
                        {categories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                    {s.linkType === 'page' && (
                      <select className={fld + ' bg-white'} value={s.linkTarget || ''} onChange={e => upd(idx, { linkTarget: e.target.value })}>
                        <option value="">{T ? '— انتخاب صفحه —' : '— Select page —'}</option>
                        {pages.map(p => <option key={p.id} value={p.id}>{p.label || p.labelEn || p.id}</option>)}
                      </select>
                    )}
                    {s.linkType === 'external' && (
                      <input className={fld + ' dir-ltr'} placeholder="https://…" value={s.linkTarget || ''} onChange={e => upd(idx, { linkTarget: e.target.value })} />
                    )}
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs text-gray-600 pb-2">
                      <input type="checkbox" className="accent-indigo-600" checked={!!s.openInNewTab} onChange={e => upd(idx, { openInNewTab: e.target.checked })} />
                      {T ? 'تب جدید' : 'New tab'}
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="md:col-span-2">
                    <label className={lbl}>{T ? 'محل قرارگیری' : 'Position anchor'}</label>
                    <select
                      className={fld + ' bg-white'}
                      value={s.positionAnchor || resolveStickerAnchor(s)}
                      onChange={e => {
                        const anchor = e.target.value as MetaShopFloatingPositionAnchor;
                        const patch: Partial<MetaShopFloatingSticker> = { positionAnchor: anchor };
                        if (anchor !== 'free' && (s.positionX > 12 || s.positionY > 12)) {
                          patch.positionX = 4;
                          patch.positionY = 4;
                        }
                        upd(idx, patch);
                      }}
                    >
                      {ANCHORS.map(a => <option key={a.id} value={a.id}>{T ? a.fa : a.en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>
                      {(s.positionAnchor || resolveStickerAnchor(s)) === 'free'
                        ? 'X %'
                        : (T ? 'فاصله افقی %' : 'Inset X %')}
                    </label>
                    <input className={fld} type="number" min={0} max={(s.positionAnchor || resolveStickerAnchor(s)) === 'free' ? 100 : 45} value={Math.round(s.positionX)} onChange={e => upd(idx, { positionX: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className={lbl}>
                      {(s.positionAnchor || resolveStickerAnchor(s)) === 'free'
                        ? 'Y %'
                        : (T ? 'فاصله عمودی %' : 'Inset Y %')}
                    </label>
                    <input className={fld} type="number" min={0} max={(s.positionAnchor || resolveStickerAnchor(s)) === 'free' ? 100 : 45} value={Math.round(s.positionY)} onChange={e => upd(idx, { positionY: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className={lbl}>{T ? 'عرض (px)' : 'Width (px)'}</label>
                    <input className={fld} type="number" min={40} max={480} value={s.width} onChange={e => upd(idx, { width: parseInt(e.target.value, 10) || 120 })} />
                  </div>
                  <div>
                    <label className={lbl}>{T ? 'ارتفاع (px)' : 'Height (px)'}</label>
                    <input className={fld} type="number" min={40} max={480} value={s.height} onChange={e => upd(idx, { height: parseInt(e.target.value, 10) || 160 })} />
                  </div>
                  <div>
                    <label className={lbl}>{T ? 'چرخش (°)' : 'Rotation (°)'}</label>
                    <input className={fld} type="number" min={0} max={360} value={s.rotation ?? 0} onChange={e => upd(idx, { rotation: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className={lbl}>{T ? 'انیمیشن' : 'Animation'}</label>
                    <select className={fld + ' bg-white'} value={s.animation || 'none'} onChange={e => upd(idx, { animation: e.target.value as MetaShopFloatingAnimation })}>
                      {ANIMATIONS.map(a => <option key={a.id} value={a.id}>{T ? a.fa : a.en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>{T ? 'سرعت انیمیشن' : 'Animation speed'}</label>
                    <input className={fld} type="number" min={0.5} max={2} step={0.1} value={s.animationSpeed ?? 1} onChange={e => upd(idx, { animationSpeed: parseFloat(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <label className={lbl}>z-index</label>
                    <input className={fld} type="number" min={1} max={99999} value={s.zIndex ?? 9000} onChange={e => upd(idx, { zIndex: parseInt(e.target.value, 10) || 9000 })} />
                  </div>
                  <div className="flex flex-col gap-1 justify-end pb-1">
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" className="accent-indigo-600" checked={!!s.desktopOnly} onChange={e => upd(idx, { desktopOnly: e.target.checked, mobileOnly: e.target.checked ? false : s.mobileOnly })} />
                      {T ? 'فقط دسکتاپ' : 'Desktop only'}
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      <input type="checkbox" className="accent-indigo-600" checked={!!s.mobileOnly} onChange={e => upd(idx, { mobileOnly: e.target.checked, desktopOnly: e.target.checked ? false : s.desktopOnly })} />
                      {T ? 'فقط موبایل' : 'Mobile only'}
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>{T ? 'نمایش در صفحات' : 'Page visibility'}</label>
                    <select className={fld + ' bg-white'} value={s.pageScope || 'all'} onChange={e => upd(idx, { pageScope: e.target.value as 'all' | 'products' | 'custom' })}>
                      <option value="all">{T ? 'کل سایت' : 'Site-wide'}</option>
                      <option value="products">{T ? 'فقط لیست محصولات' : 'Products list only'}</option>
                      <option value="custom">{T ? 'صفحات انتخابی' : 'Selected pages'}</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>{T ? 'شروع کمپین' : 'Start date'}</label>
                    <input className={fld + ' dir-ltr'} type="date" value={s.startDate?.slice(0, 10) || ''} onChange={e => upd(idx, { startDate: e.target.value || undefined })} />
                  </div>
                  <div>
                    <label className={lbl}>{T ? 'پایان کمپین' : 'End date'}</label>
                    <input className={fld + ' dir-ltr'} type="date" value={s.endDate?.slice(0, 10) || ''} onChange={e => upd(idx, { endDate: e.target.value || undefined })} />
                  </div>
                </div>

                {s.pageScope === 'custom' && pages.length > 0 && (
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">{T ? 'صفحات نمایش:' : 'Show on pages:'}</p>
                    <div className="flex flex-wrap gap-2">
                      {pages.map(p => (
                        <label key={p.id} className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 cursor-pointer">
                          <input type="checkbox" className="accent-indigo-600" checked={(s.pageIds || []).includes(p.id)} onChange={() => togglePageId(idx, p.id)} />
                          {p.label || p.labelEn || p.id}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MetaShopFloatingPromosEditor;
