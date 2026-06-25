import type { MetaShopDirCat, MetaShopLang, MetaverseExpo, MetaverseBooth, MetaShop, BoothEntranceFacing, BoothFace, BoothProductSlideshow, MetaShopProduct } from '../../types';

export type ExpoLangCode = string;

export const DEFAULT_EXPO_LANGS: MetaShopLang[] = [
  { code: 'en', name: 'English' },
  { code: 'fa', name: 'فارسی', rtl: true },
];

/** English is always available; merge configured languages without duplicates. */
export const resolveExpoLanguages = (expo?: MetaverseExpo | null): MetaShopLang[] => {
  const map = new Map<string, MetaShopLang>();
  map.set('en', { code: 'en', name: 'English' });
  (expo?.languages || []).forEach(l => {
    const code = (l.code || '').trim().toLowerCase();
    if (!code) return;
    map.set(code, { code, name: (l.name || code).trim(), rtl: l.rtl });
  });
  if (map.size === 1) map.set('fa', { code: 'fa', name: 'فارسی', rtl: true });
  return Array.from(map.values());
};

export const isRtlExpoLang = (code: string, langs?: MetaShopLang[]) =>
  langs?.find(l => l.code === code)?.rtl ?? (code === 'fa' || code === 'ar');

// ── Bilingual / multilingual label resolver ──
export const bi = (v: MetaShopDirCat | undefined | null, lang: ExpoLangCode, fallback = ''): string => {
  if (!v) return fallback;
  const code = (lang || 'en').toLowerCase();
  const direct = v[code];
  if (direct?.trim()) return direct;
  if (code !== 'en' && v.en?.trim()) return v.en;
  if (code !== 'fa' && v.fa?.trim()) return v.fa;
  const any = Object.values(v).find(s => typeof s === 'string' && s.trim());
  return (any as string | undefined) || fallback;
};

const EXPO_PHRASES: Record<string, Partial<Record<string, string>>> = {
  booth: { fa: 'غرفه', en: 'Booth', ar: 'جناح' },
  enterShop: { fa: 'ورود به فروشگاه', en: 'Enter shop', ar: 'دخول المتجر' },
  reserveBooth: { fa: 'رزرو غرفه', en: 'Reserve', ar: 'حجز الجناح' },
  reservedPending: { fa: 'رزرو موقت', en: 'Held', ar: 'محجوز مؤقتًا' },
  reservedConfirmed: { fa: 'رزرو قطعی', en: 'Booked', ar: 'محجوز نهائيًا' },
  glassDefault: { fa: 'خدمات و محصولات ویژه', en: 'Services & special offers', ar: 'خدمات وعروض خاصة' },
  department: { fa: 'بخش فروشگاهی', en: 'Department', ar: 'قسم المتجر' },
  brandProducts: { fa: 'محصولات برند', en: 'Brand products', ar: 'منتجات العلامة' },
  organizer: { fa: 'برگزارکننده نمایشگاه', en: 'Exhibition Organizer', ar: 'منظم المعرض' },
  enterExpo: { fa: 'ورود به نمایشگاه', en: 'Enter Exhibition', ar: 'دخول المعرض' },
  register: { fa: 'ثبت اطلاعات', en: 'Register', ar: 'تسجيل' },
  entranceAd: { fa: 'تبلیغات ورودی', en: 'Entrance ad', ar: 'إعلان المدخل' },
  category: { fa: 'دسته‌بندی', en: 'Department', ar: 'قسم' },
  deptGuide: { fa: 'راهنمای بخش‌های فروشگاه', en: 'Store Department Guide', ar: 'دليل أقسام المتجر' },
  visitorReg: { fa: 'ثبت اطلاعات بازدیدکننده', en: 'Visitor registration', ar: 'تسجيل الزائر' },
  aisle: { fa: 'راهرو', en: 'Aisle', ar: 'ممر' },
};

export const expoPhrase = (lang: ExpoLangCode, key: keyof typeof EXPO_PHRASES, fallback = ''): string => {
  const pack = EXPO_PHRASES[key];
  if (!pack) return fallback;
  const code = (lang || 'en').toLowerCase();
  return pack[code] || pack.en || pack.fa || fallback;
};

const EXPO_UI: Record<string, Record<string, string>> = {
  fa: {
    exit: 'خروج', fp: 'اول‌شخص', orbit: 'نمای کلی', lock: 'حالت غوطه‌ور', vr: 'ورود به VR',
    seated: 'نشسته', standing: 'ایستاده', gotIt: 'متوجه شدم',
    helpDesktop: 'WASD حرکت · Space پرش · F پرواز · در پرواز: Space بالا / Ctrl پایین · دوبار کلیک کف = جابه‌جایی',
    helpTouch: 'اهرم چپ حرکت · راست نگاه · دکمه پرش/بالا-پایین سمت راست · دکمه پرواز بالا',
    helpVr: 'VR: استیک چپ حرکت · استیک راست چرخش · در پرواز: استیک راست بالا/پایین · A/X بالا · B پایین · دکمه Y چپ = تعویض پرواز/پیاده',
    fly: 'پرواز', walk: 'پیاده', flyOn: 'حالت پرواز', flyOff: 'حالت پیاده',
    heightHint: 'ارتفاع دید برای عینک VR',
  },
  en: {
    exit: 'Exit', fp: 'First-person', orbit: 'Overview', lock: 'Immersive', vr: 'Enter VR',
    seated: 'Seated', standing: 'Standing', gotIt: 'Got it',
    helpDesktop: 'WASD move · Space jump · F fly · in fly: Space up / Ctrl down · double-click floor to teleport',
    helpTouch: 'Left stick move · right look · jump/fly buttons on the right · Fly toggle in top bar',
    helpVr: 'VR: left stick move · right stick turn · fly: right stick up/down · A/X up · B down · left Y = toggle fly/walk',
    fly: 'Fly', walk: 'Walk', flyOn: 'Fly mode', flyOff: 'Walk mode',
    heightHint: 'VR viewing height',
  },
  ar: {
    exit: 'خروج', fp: 'منظور أول', orbit: 'نظرة عامة', lock: 'غامر', vr: 'دخول VR',
    seated: 'جالس', standing: 'واقف', gotIt: 'حسنًا',
    helpDesktop: 'WASD / الأسهم · Space قفز · F طيران · نقرتان على الأرض للانتقال',
    helpTouch: 'العصا اليسرى حركة · اليمنى نظر · أزرار القفز/الطيران',
    helpVr: 'VR: العصا اليسرى حركة · اليمنى دوران · الطيران: اليمنى أعلى/أسفل · Y اليسرى تبديل الطيران',
    fly: 'طيران', walk: 'مشي', flyOn: 'وضع الطيران', flyOff: 'وضع المشي',
    heightHint: 'ارتفاع الرؤية لنظارات VR',
  },
};

export const expoUi = (lang: ExpoLangCode, key: string): string => {
  const code = (lang || 'en').toLowerCase();
  return EXPO_UI[code]?.[key] || EXPO_UI.en?.[key] || EXPO_UI.fa?.[key] || key;
};

// Sensible hall defaults so a freshly-enabled expo already looks like a room.
export const EXPO_DEFAULTS = {
  width: 30,
  depth: 30,
  height: 9,            // taller, proper exhibition-hall ceiling
  groundColor: '#cfd4dc',
  wallColor: '#e9edf3',
  preset: 'warehouse' as const,
  eyeHeight: 1.6,
};

export const hallDims = (expo: MetaverseExpo) => ({
  width: Math.max(8, expo.width || EXPO_DEFAULTS.width),
  depth: Math.max(8, expo.depth || EXPO_DEFAULTS.depth),
  // Keep a sane minimum, but let admins intentionally choose lower/taller ceilings.
  height: Math.max(4, expo.height || EXPO_DEFAULTS.height),
});

export const boothPos = (b: MetaverseBooth): [number, number, number] => [b.x || 0, b.y || 0, b.z || 0];

// Standard exhibition banner sizes (meters) the admin picks from — no manual sizing needed.
export const BANNER_SIZES: { key: string; fa: string; en: string; w: number; h: number }[] = [
  { key: 'billboard', fa: 'بیلبورد افقی', en: 'Billboard', w: 6, h: 3 },
  { key: 'wide',      fa: 'بنر عریض',      en: 'Wide banner', w: 4.5, h: 2 },
  { key: 'standard',  fa: 'بنر استاندارد', en: 'Standard banner', w: 3, h: 2 },
  { key: 'square',    fa: 'مربع',          en: 'Square', w: 2.5, h: 2.5 },
  { key: 'portrait',  fa: 'رول‌آپ عمودی',  en: 'Roll-up (portrait)', w: 2, h: 3.5 },
  { key: 'small',     fa: 'کوچک',          en: 'Small', w: 2, h: 1.2 },
];
export const bannerSize = (key?: string) => BANNER_SIZES.find(s => s.key === key) || BANNER_SIZES[2]; // default: standard

// Place something flat on a hall perimeter wall. u = 0..1 along the wall, v = 0..1 up the wall.
// Returns a world position (just inside the wall) + a rotation so it faces into the hall.
export const wallTransform = (
  wall: 'back' | 'left' | 'right' | 'front',
  u: number, v: number,
  dims: { width: number; depth: number; height: number },
): { position: [number, number, number]; rotation: [number, number, number] } => {
  const { width, depth, height } = dims;
  // The perimeter walls are 0.2m-thick boxes centred on the edge, so their inner face is 0.1m in.
  // Mount banners clearly IN FRONT of that face (else they sink into the wall and the white face hides them).
  const off = 0.22;
  const y = Math.max(0.4, v * height);
  switch (wall) {
    case 'left':  return { position: [-width / 2 + off, y, (u - 0.5) * depth], rotation: [0, Math.PI / 2, 0] };
    case 'right': return { position: [width / 2 - off, y, (0.5 - u) * depth], rotation: [0, -Math.PI / 2, 0] };
    case 'front': return { position: [(0.5 - u) * width, y, depth / 2 - off], rotation: [0, Math.PI, 0] };
    case 'back':
    default:      return { position: [(u - 0.5) * width, y, -depth / 2 + off], rotation: [0, 0, 0] };
  }
};

// Robustly pull the 11-char video id out of ANY YouTube URL shape: watch?v= (with the v=
// param anywhere in the query, even after app=/si=/feature=), youtu.be/, /embed/, /shorts/,
// /live/. Returns null if it isn't a recognizable YouTube link.
export const ytId = (url: string): string | null => {
  const u = (url || '').trim();
  if (!/youtu/i.test(u)) return null;
  // youtu.be/ID  |  /embed/ID  |  /shorts/ID  |  /live/ID  |  /v/ID
  const path = u.match(/(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|live|v)\/)([\w-]{11})/);
  if (path) return path[1];
  // ...watch?...v=ID...  (v= may sit anywhere in the query string)
  const q = u.match(/[?&]v=([\w-]{11})/);
  if (q) return q[1];
  return null;
};

// Pull the numeric Vimeo id out of common Vimeo URL shapes.
export const vimeoId = (url: string): string | null => {
  const m = (url || '').match(/vimeo\.com\/(?:video\/|channels\/[\w]+\/|groups\/[\w]+\/videos\/)?(\d+)/i);
  return m ? m[1] : null;
};

// Convert a YouTube / Vimeo / direct-mp4 URL into an embeddable form for the video popup.
export const videoEmbed = (url: string): { kind: 'iframe' | 'video'; src: string } | null => {
  if (!url) return null;
  const u = url.trim();
  const yt = ytId(u);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt}` };
  const vm = vimeoId(u);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: 'video', src: u };
  // Unknown host → try as an iframe (lets generic embeds / pages through)
  return { kind: 'iframe', src: u };
};

// Same as videoEmbed but for an always-on, muted, looping in-world LCD screen (autoplay params added).
export const screenEmbed = (url: string): { kind: 'iframe' | 'video'; src: string } | null => {
  if (!url) return null;
  const u = url.trim();
  const yt = ytId(u);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&modestbranding=1&playsinline=1&rel=0&enablejsapi=1` };
  const vm = vimeoId(u);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm}?autoplay=1&muted=1&loop=1&background=1` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: 'video', src: u };
  return { kind: 'iframe', src: u };
};

// Is this URL a playable video (vs. an image)? Used to decide between an LCD screen and a panel.
export const isVideoUrl = (url?: string): boolean =>
  !!url && (!!ytId(url) || !!vimeoId(url) || /\.(mp4|webm|ogg)(\?.*)?$/i.test(url));

// Is this a direct video FILE we can texture onto a 3D plane (true in-world playback)?
// YouTube/Vimeo are NOT files — they can only be shown through an iframe transformed onto the wall.
export const isVideoFile = (url?: string): boolean => !!url && /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);

// Animated GIF → drawn frame-by-frame onto a CanvasTexture so it actually animates on the wall
// (a plain image texture would freeze on the first frame).
export const isGif = (url?: string): boolean => !!url && /\.gif(\?.*)?$/i.test(url);

// PDF files render as page-turnable in-world panels.
export const isPdfFile = (url?: string): boolean => !!url && /\.pdf(\?.*)?$/i.test(url);

// An uploaded HTML page → embedded through an iframe transformed onto the wall surface.
export const isHtmlFile = (url?: string): boolean => !!url && /\.html?(\?.*)?$/i.test(url);

export const boothSlideshowFaces = (booth: MetaverseBooth): BoothFace[] =>
  (Object.entries(booth.productSlideshows || {}) as [BoothFace, BoothProductSlideshow | undefined][])
    .filter(([, cfg]) => cfg?.enabled)
    .map(([face]) => face);

export const boothNeedsSlideshowProducts = (booth: MetaverseBooth): boolean =>
  boothSlideshowFaces(booth).length > 0 && !!booth.shopSlug;

/** Products per slideshow page — images load lazily per page only. */
export const SLIDESHOW_PAGE_SIZE = 32;

/** Product ids explicitly referenced on booth slideshow configs for a shop slug. */
export const collectSlideshowProductIdsForShop = (
  booths: MetaverseBooth[] | undefined,
  shopSlug: string,
): { explicitIds: string[]; hasOpenList: boolean } => {
  const explicitIds = new Set<string>();
  let hasOpenList = false;
  for (const b of booths || []) {
    if (b.shopSlug !== shopSlug) continue;
    for (const cfg of Object.values(b.productSlideshows || {})) {
      if (!cfg?.enabled) continue;
      if (cfg.productIds?.length) cfg.productIds.forEach(id => explicitIds.add(id));
      else hasOpenList = true;
    }
  }
  return { explicitIds: [...explicitIds], hasOpenList };
};

const trimProductForSlideshow = (p: MetaShopProduct): MetaShopProduct | null => {
  const img = (p.images || []).find(u => !!String(u || '').trim());
  if (!img) return null;
  return { ...p, images: [String(img)] };
};

export const filterProductsForSlideshowHydrate = (
  products: MetaShopProduct[],
  booths: MetaverseBooth[] | undefined,
  shopSlug: string,
): MetaShopProduct[] => {
  const active = products.filter(p => p.active !== false);
  const { explicitIds, hasOpenList } = collectSlideshowProductIdsForShop(booths, shopSlug);
  let list: MetaShopProduct[];
  if (explicitIds.length) {
    const pick = new Set(explicitIds);
    list = active.filter(p => pick.has(p.id));
  } else if (!hasOpenList) {
    return [];
  } else {
    list = active;
  }
  return list.map(trimProductForSlideshow).filter((p): p is MetaShopProduct => !!p);
};

export const resolveSlideshowProducts = (
  products: MetaShopProduct[] | undefined,
  config?: BoothProductSlideshow,
): MetaShopProduct[] => {
  let list = (products || []).filter(p => p.active !== false);
  const ids = config?.productIds;
  if (ids?.length) {
    const pick = new Set(ids);
    list = list.filter(p => pick.has(p.id));
  }
  return list.filter(p => (p.images || []).some(u => !!String(u || '').trim()));
};

export const slideshowPageCount = (total: number, pageSize = SLIDESHOW_PAGE_SIZE) =>
  Math.max(1, Math.ceil(Math.max(0, total) / pageSize));

export const slideshowPageSlice = (
  products: MetaShopProduct[],
  page: number,
  pageSize = SLIDESHOW_PAGE_SIZE,
) => {
  const start = Math.max(0, page) * pageSize;
  return products.slice(start, start + pageSize);
};

/** Default + available language codes for booth product slideshow text. */
export const resolveSlideshowLangConfig = (
  expo: MetaverseExpo | null | undefined,
  shop?: MetaShop | null,
): { defaultLang: string; langOptions: string[] } => {
  const codes = new Set<string>();
  resolveExpoLanguages(expo).forEach(l => codes.add(l.code.toLowerCase()));
  (shop?.languages || []).forEach(l => {
    const c = (l.code || '').trim().toLowerCase();
    if (c) codes.add(c);
  });
  const defaultLang = (shop?.defaultLang || expo?.defaultLang || 'fa').trim().toLowerCase() || 'fa';
  codes.add(defaultLang);
  codes.add('fa');
  codes.add('en');
  const langOptions = Array.from(codes);
  return {
    defaultLang: langOptions.includes(defaultLang) ? defaultLang : (langOptions[0] || 'fa'),
    langOptions,
  };
};

export const collectExpoSlideshowShopSlugs = (booths: MetaverseBooth[] | undefined): string[] => {
  const slugs = new Set<string>();
  for (const b of booths || []) {
    if (b.shopSlug && boothNeedsSlideshowProducts(b)) slugs.add(b.shopSlug);
  }
  return [...slugs];
};

// Pull a booth's visuals from a linked MetaShop ("make the booth this shop"): bilingual name,
// accent color, logo, and panels (cover image inside-back, first product video for the LCD).
export const shopToBoothFields = (shop: MetaShop, lang: ExpoLangCode): Partial<MetaverseBooth> => {
  const fa = (shop.i18n?.fa?.title) || shop.title || shop.name;
  const en = shop.title || shop.name; // shop titles are single-language; reuse name for EN
  const firstVideo = (shop.products || []).find(p => p.videoUrl)?.videoUrl;
  const panels: Partial<Record<import('../../types').BoothFace, string>> = {};
  if (firstVideo) panels.innerBack = firstVideo;          // LCD inside the booth
  else if (shop.coverImage) panels.innerBack = shop.coverImage;
  if (shop.coverImage) panels.outerBack = shop.coverImage; // storefront banner facing the aisle
  return {
    shopSlug: shop.slug,
    name: { fa, en },
    color: shop.storefrontColor || shop.theme?.primary || '#2d4a1a',
    logo: shop.logo || undefined,
    screenUrl: undefined,        // migrate to panels
    bannerImage: undefined,
    panels,
  };
};

export type ExpoBoothLayout =
  | 'cross' | 'boulevard' | 'avenue' | 'gallery' | 'alley' | 'pavilion'
  | 'symmetric' | 'perimeter' | 'grand' | 'storefront' | 'supermarket'
  | 'facing' | 'grid' | 'business_center';

export interface ExpoCarpetRect {
  x: number;
  z: number;
  w: number;
  d: number;
  color?: string;
  border?: string;
  entrance?: boolean;
}

export const EXPO_CARPET = {
  main: '#9f1239',
  border: '#d4a574',
  accent: '#1e40af',
  plaza: '#7f1d1d',
  entrance: '#b91c1c',
  entranceBorder: '#fca5a5',
  entranceStripe: '#fbbf24',
} as const;

export const EXPO_LAYOUT_OPTIONS: { id: ExpoBoothLayout; labelFa: string; labelEn: string }[] = [
  { id: 'cross', labelFa: '۱. راهرو متقاطع', labelEn: '1. Cross aisles' },
  { id: 'boulevard', labelFa: '۲. بلوار مرکزی VIP', labelEn: '2. Central boulevard' },
  { id: 'avenue', labelFa: '۳. شبلون‌های موازی', labelEn: '3. Parallel avenues' },
  { id: 'gallery', labelFa: '۴. گالری دوطرفه', labelEn: '4. Twin gallery' },
  { id: 'alley', labelFa: '۵. کوچه بازار', labelEn: '5. Bazaar alley' },
  { id: 'pavilion', labelFa: '۶. جزیره‌های نمایشگاهی', labelEn: '6. Pavilion islands' },
  { id: 'symmetric', labelFa: '۷. قرینه رسمی', labelEn: '7. Symmetric wings' },
  { id: 'perimeter', labelFa: '۸. دور سالن', labelEn: '8. Perimeter ring' },
  { id: 'grand', labelFa: '۹. سالن بزرگ', labelEn: '9. Grand hall' },
  { id: 'storefront', labelFa: '۱۰. دفاتر تجاری', labelEn: '10. Commercial offices' },
  { id: 'supermarket', labelFa: '۱۱. فروشگاه زنجیره‌ای', labelEn: '11. Supermarket' },
];

export const normalizeBoothLayout = (layout?: ExpoBoothLayout | string | null): ExpoBoothLayout => {
  if (layout === 'facing' || layout === 'grid') return 'cross';
  if (layout === 'business_center') return 'storefront';
  const ids = EXPO_LAYOUT_OPTIONS.map(o => o.id);
  if (layout && ids.includes(layout as ExpoBoothLayout)) return layout as ExpoBoothLayout;
  return 'cross';
};

type ArrangeCell = { x: number; z: number; ry: number };
type ArrangeResult = {
  width: number;
  depth: number;
  spawn: { x: number; y: number; z: number; ry: number };
  cells: ArrangeCell[];
};

const BOOTH = 4;
const spawnFor = (depth: number) => ({ x: 0, y: 0, z: +(depth / 2 - 3).toFixed(2), ry: Math.PI });
const aw = (span: number) => Math.min(2.5, Math.max(1.8, span * 0.09));
const carpet = (x: number, z: number, w: number, d: number, color = EXPO_CARPET.main, border = EXPO_CARPET.border): ExpoCarpetRect =>
  ({ x, z, w, d, color, border });

/** Red carpet at the hall doorway (+ optional exterior strip coordinates). */
export const entranceCarpetRects = (width: number, depth: number): ExpoCarpetRect[] => [
  { x: 0, z: depth / 2 - 2.2, w: Math.min(3.4, width * 0.28), d: 4.2, color: EXPO_CARPET.entrance, border: EXPO_CARPET.entranceBorder, entrance: true },
  { x: 0, z: depth / 2 + 1.2, w: Math.min(4.6, width * 0.34), d: Math.min(6.5, depth * 0.14), color: EXPO_CARPET.entrance, border: EXPO_CARPET.entranceStripe, entrance: true },
];

/** Organized aisle carpets per layout (+ red entrance carpets). */
export const layoutCarpetRects = (layout: ExpoBoothLayout | string | undefined, width: number, depth: number): ExpoCarpetRect[] => {
  const L = normalizeBoothLayout(layout);
  const w = Math.max(16, width);
  const d = Math.max(18, depth);
  const cw = aw(w);
  const cd = aw(d);
  const entrance = entranceCarpetRects(w, d);
  const innerD = d * 0.72;
  const innerW = w * 0.68;

  const byLayout: Record<ExpoBoothLayout, ExpoCarpetRect[]> = {
    cross: [
      carpet(0, 0, cw, innerD),
      carpet(0, d / 2 - 6, innerW, cd),
    ],
    boulevard: [
      carpet(0, 0, cw, innerD * 0.95),
      carpet(0, d / 2 - 5, Math.min(3, w * 0.22), cd),
    ],
    avenue: (() => {
      const cols = Math.max(2, Math.ceil(Math.sqrt(Math.ceil(12 / 2))));
      const out: ExpoCarpetRect[] = [carpet(0, d / 2 - 6, innerW, cd)];
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * (BOOTH * 2 + 8);
        out.push(carpet(x, 0, cw, innerD * 0.82));
      }
      return out;
    })(),
    gallery: [
      carpet(0, 0, cw, innerD),
      carpet(-w * 0.22, 0, cw * 0.75, innerD * 0.9, EXPO_CARPET.accent, '#93c5fd'),
      carpet(w * 0.22, 0, cw * 0.75, innerD * 0.9, EXPO_CARPET.accent, '#93c5fd'),
    ],
    alley: (() => {
      const streetPitch = BOOTH * 2 + 3.4 + 6;
      const streets = Math.max(1, Math.round((w - 10) / streetPitch));
      const narrowW = Math.min(2.1, cw * 0.78);
      const out: ExpoCarpetRect[] = [
        carpet(0, d / 2 - 6, innerW, cd),
        carpet(0, d * 0.12, innerW * 0.62, cd * 0.7, EXPO_CARPET.main, EXPO_CARPET.border),
      ];
      for (let s = 0; s < streets; s++) {
        const x = (s - (streets - 1) / 2) * streetPitch;
        out.push(carpet(x, -d * 0.04, narrowW, innerD * 0.92, '#78350f', '#d97706'));
      }
      return out;
    })(),
    pavilion: (() => {
      const step = BOOTH * 2 + 10;
      const out: ExpoCarpetRect[] = [carpet(0, d / 2 - 6, innerW, cd)];
      for (let gx = -1; gx <= 1; gx++) {
        for (let gz = -1; gz <= 1; gz++) {
          if (gx === 0 && gz === 0) continue;
          out.push(carpet(gx * step, gz * step * 0.85, cw * 0.9, cd * 0.9, EXPO_CARPET.plaza, EXPO_CARPET.border));
        }
      }
      return out;
    })(),
    symmetric: [
      carpet(0, 0, cw, innerD),
      carpet(-w * 0.18, 0, cw * 0.7, innerD * 0.88),
      carpet(w * 0.18, 0, cw * 0.7, innerD * 0.88),
    ],
    perimeter: [
      carpet(0, 0, cw, innerD * 0.55),
      carpet(0, -d * 0.28, innerW * 0.85, cd * 0.8),
      carpet(0, d * 0.22, innerW * 0.75, cd * 0.75),
    ],
    grand: [
      carpet(0, 0, Math.min(6, w * 0.35), Math.min(10, d * 0.38), EXPO_CARPET.plaza, EXPO_CARPET.entranceStripe),
      carpet(0, d / 2 - 6, innerW, cd),
      carpet(0, -d * 0.22, innerW * 0.7, cd * 0.7),
    ],
    storefront: [
      carpet(0, 0, cw, innerD),
      carpet(0, d / 2 - 6, innerW, cd, '#0f766e', '#5eead4'),
    ],
    supermarket: (() => {
      const out: ExpoCarpetRect[] = [carpet(0, d / 2 - 7, innerW, cd)];
      for (let lane = 0; lane < 3; lane++) {
        const x = (lane - 1) * (w / 4);
        out.push(carpet(x, -d * 0.08, cw * 0.85, innerD * 0.55, EXPO_CARPET.accent, '#93c5fd'));
      }
      return out;
    })(),
    facing: [],
    grid: [],
    business_center: [],
  };

  return [...entrance, ...(byLayout[L] || byLayout.cross)];
};

/** @deprecated use layoutCarpetRects */
export const crossFacingCarpetRects = (width: number, depth: number) =>
  layoutCarpetRects('cross', width, depth);

/**
 * Cross-facing grid — booths face each other across horizontal AND vertical aisles.
 */
const arrangeCrossFacing = (n: number, spacing = 1): ArrangeResult => {
  const aisle = 4.8 * spacing;
  const cross = 5 * spacing;
  const halfGap = BOOTH / 2 + aisle / 2;
  const blockPitch = BOOTH * 2 + aisle + cross;
  const cells: ArrangeCell[] = [];

  const units: ('cross' | 'h' | 'v' | 'single')[] = [];
  let remaining = n;
  while (remaining > 0) {
    if (remaining >= 4) { units.push('cross'); remaining -= 4; }
    else if (remaining >= 2) {
      units.push(units.filter(u => u === 'h').length <= units.filter(u => u === 'v').length ? 'h' : 'v');
      remaining -= 2;
    } else { units.push('single'); remaining -= 1; }
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(units.length)));
  const rows = Math.ceil(units.length / cols);
  const width = Math.max(24, cols * blockPitch + 10);
  const depth = Math.max(26, rows * blockPitch + 10);

  units.forEach((unit, idx) => {
    const r = Math.floor(idx / cols), c = idx % cols;
    const colsThisRow = Math.min(cols, units.length - r * cols);
    const xCenter = (c - (colsThisRow - 1) / 2) * blockPitch;
    const zCenter = ((rows - 1) / 2 - r) * blockPitch;
    if (unit === 'cross') {
      cells.push(
        { x: +xCenter.toFixed(2), z: +(zCenter - halfGap).toFixed(2), ry: 0 },
        { x: +xCenter.toFixed(2), z: +(zCenter + halfGap).toFixed(2), ry: Math.PI },
        { x: +(xCenter - halfGap).toFixed(2), z: +zCenter.toFixed(2), ry: Math.PI / 2 },
        { x: +(xCenter + halfGap).toFixed(2), z: +zCenter.toFixed(2), ry: -Math.PI / 2 },
      );
    } else if (unit === 'h') {
      cells.push(
        { x: +xCenter.toFixed(2), z: +(zCenter - halfGap).toFixed(2), ry: 0 },
        { x: +xCenter.toFixed(2), z: +(zCenter + halfGap).toFixed(2), ry: Math.PI },
      );
    } else if (unit === 'v') {
      cells.push(
        { x: +(xCenter - halfGap).toFixed(2), z: +zCenter.toFixed(2), ry: Math.PI / 2 },
        { x: +(xCenter + halfGap).toFixed(2), z: +zCenter.toFixed(2), ry: -Math.PI / 2 },
      );
    } else {
      cells.push({ x: +xCenter.toFixed(2), z: +(zCenter - halfGap).toFixed(2), ry: 0 });
    }
  });

  return { width, depth, spawn: spawnFor(depth), cells: cells.slice(0, n) };
};

const arrangeBoulevard = (n: number): ArrangeResult => {
  const aisle = 5.2;
  const halfGap = BOOTH / 2 + aisle / 2;
  const rowPitch = BOOTH + 5.5;
  const pairs = Math.ceil(n / 2);
  const depth = Math.max(28, pairs * rowPitch + 14);
  const width = 18;
  const cells: ArrangeCell[] = [];
  for (let i = 0; i < n; i++) {
    const pair = Math.floor(i / 2);
    const side = i % 2;
    const z = depth / 2 - 8 - pair * rowPitch;
    const x = side === 0 ? -halfGap : halfGap;
    cells.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: side === 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  return { width, depth, spawn: spawnFor(depth), cells };
};

const arrangeAvenue = (n: number): ArrangeResult => {
  const aisle = 4.8;
  const halfGap = BOOTH / 2 + aisle / 2;
  const colPitch = BOOTH * 2 + aisle + 4;
  const rowPitch = BOOTH * 2 + aisle + 5;
  const pairCount = Math.ceil(n / 2);
  const cols = Math.max(1, Math.ceil(Math.sqrt(pairCount)));
  const rows = Math.ceil(pairCount / cols);
  const width = Math.max(26, cols * colPitch + 10);
  const depth = Math.max(28, rows * rowPitch + 12);
  const cells: ArrangeCell[] = [];
  for (let i = 0; i < n; i++) {
    const pair = Math.floor(i / 2);
    const r = Math.floor(pair / cols), c = pair % cols;
    const colsThisRow = Math.min(cols, pairCount - r * cols);
    const x = (c - (colsThisRow - 1) / 2) * colPitch;
    const zCenter = depth / 2 - 8 - r * rowPitch;
    const side = i % 2;
    cells.push({
      x: +x.toFixed(2),
      z: +(zCenter + (side === 0 ? -halfGap : halfGap)).toFixed(2),
      ry: side === 0 ? 0 : Math.PI,
    });
  }
  return { width, depth, spawn: spawnFor(depth), cells };
};

const arrangeGallery = (n: number): ArrangeResult => {
  const slotZ = 7.2;
  const pairs = Math.ceil(n / 2);
  const depth = Math.max(28, pairs * slotZ + 14);
  const width = 26;
  const wallX = width / 2 - 3.2;
  const cells: ArrangeCell[] = [];
  for (let i = 0; i < n; i++) {
    const pair = Math.floor(i / 2);
    const side = i % 2;
    const z = depth / 2 - 8 - pair * slotZ;
    cells.push({ x: side === 0 ? -wallX : wallX, z: +z.toFixed(2), ry: side === 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  return { width, depth, spawn: spawnFor(depth), cells };
};

/** Narrow parallel bazaar alleys — booths face each other across each کوچه. */
const arrangeAlley = (n: number): ArrangeResult => {
  const alleyW = 3.4;
  const halfGap = BOOTH / 2 + alleyW / 2;
  const alongPitch = BOOTH + 4.4;
  const streetPitch = BOOTH * 2 + alleyW + 6;

  const pairCount = Math.ceil(n / 2);
  const streets = Math.max(1, Math.ceil(Math.sqrt(pairCount / 1.5)));
  const rows = Math.ceil(pairCount / streets);
  const width = Math.max(24, streets * streetPitch + 10);
  const depth = Math.max(28, rows * alongPitch + 14);
  const cells: ArrangeCell[] = [];

  for (let i = 0; i < n; i++) {
    const pair = Math.floor(i / 2);
    const street = pair % streets;
    const row = Math.floor(pair / streets);
    const side = i % 2;
    const xCenter = (street - (streets - 1) / 2) * streetPitch;
    const x = xCenter + (side === 0 ? -halfGap : halfGap);
    const z = depth / 2 - 8 - row * alongPitch;
    cells.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: side === 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  return { width, depth, spawn: spawnFor(depth), cells };
};

const arrangeSymmetric = (n: number): ArrangeResult => {
  const aisle = 5;
  const halfGap = BOOTH / 2 + aisle / 2;
  const rowPitch = BOOTH + 5.2;
  const left = Math.ceil(n / 2);
  const right = n - left;
  const rows = Math.max(left, right);
  const depth = Math.max(28, rows * rowPitch + 14);
  const width = 28;
  const cells: ArrangeCell[] = [];
  for (let i = 0; i < n; i++) {
    const wing = i < left ? -1 : 1;
    const local = wing < 0 ? i : i - left;
    const z = depth / 2 - 8 - local * rowPitch;
    cells.push({ x: +(wing * halfGap).toFixed(2), z: +z.toFixed(2), ry: wing < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  return { width, depth, spawn: spawnFor(depth), cells };
};

const arrangeGrand = (n: number): ArrangeResult => {
  const inset = 7;
  const slot = 7.4;
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) counts[i % 4]++;
  const maxSide = Math.max(...counts, 1);
  const width = Math.max(32, maxSide * slot + inset * 2 + 8);
  const depth = Math.max(34, maxSide * slot + inset * 2 + 10);
  const placeAlong = (idx: number, total: number, span: number) =>
    total <= 1 ? 0 : (idx - (total - 1) / 2) * Math.min(slot, span / Math.max(1, total - 1));
  const cells: ArrangeCell[] = [];
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < counts[side]; k++) {
      const xAlong = placeAlong(k, counts[side], width - inset * 2);
      const zAlong = placeAlong(k, counts[side], depth - inset * 2);
      if (side === 0) cells.push({ x: +xAlong.toFixed(2), z: +(-depth / 2 + inset).toFixed(2), ry: 0 });
      else if (side === 1) cells.push({ x: +(width / 2 - inset).toFixed(2), z: +zAlong.toFixed(2), ry: -Math.PI / 2 });
      else if (side === 2) cells.push({ x: +(-xAlong).toFixed(2), z: +(depth / 2 - inset).toFixed(2), ry: Math.PI });
      else cells.push({ x: +(-width / 2 + inset).toFixed(2), z: +(-zAlong).toFixed(2), ry: Math.PI / 2 });
    }
  }
  return { width, depth, spawn: spawnFor(depth), cells: cells.slice(0, n) };
};

const arrangePerimeter = (n: number): ArrangeResult => {
  const cells: ArrangeCell[] = [];
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) counts[i % 4]++;
  const maxSide = Math.max(...counts, 1);
  const slot = 7.2;
  const wallClearance = BOOTH / 2 + 1.7;
  const width = Math.max(24, maxSide * slot + 14);
  const depth = Math.max(24, maxSide * slot + 14);
  const placeAlong = (idx: number, total: number, span: number) =>
    total <= 1 ? 0 : (idx - (total - 1) / 2) * Math.min(slot, span / Math.max(1, total - 1));
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < counts[side]; k++) {
      const xAlong = placeAlong(k, counts[side], width - 12);
      const zAlong = placeAlong(k, counts[side], depth - 12);
      if (side === 0) cells.push({ x: +xAlong.toFixed(2), z: +(-depth / 2 + wallClearance).toFixed(2), ry: 0 });
      else if (side === 1) cells.push({ x: +(width / 2 - wallClearance).toFixed(2), z: +zAlong.toFixed(2), ry: -Math.PI / 2 });
      else if (side === 2) cells.push({ x: +(-xAlong).toFixed(2), z: +(depth / 2 - wallClearance).toFixed(2), ry: Math.PI });
      else cells.push({ x: +(-width / 2 + wallClearance).toFixed(2), z: +(-zAlong).toFixed(2), ry: Math.PI / 2 });
    }
  }
  return { width, depth, spawn: spawnFor(depth), cells: cells.slice(0, n) };
};

const arrangeSupermarket = (n: number): ArrangeResult => {
  const cols = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  const width = Math.max(28, cols * 7 + 12);
  const depth = Math.max(30, rows * 9 + 14);
  const cells: ArrangeCell[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const colsThisRow = Math.min(cols, n - r * cols);
    const x = (c - (colsThisRow - 1) / 2) * 7;
    const z = depth / 2 - 8.5 - r * 9;
    cells.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: Math.PI });
  }
  return { width, depth, spawn: spawnFor(depth), cells };
};

/** Next free slot when adding a booth. */
export const findNextLayoutSlot = (boothCount: number, layout: ExpoBoothLayout | string = 'cross') => {
  const { cells } = autoArrangeBooths(boothCount + 1, normalizeBoothLayout(layout));
  return cells[boothCount] ?? cells[cells.length - 1];
};

/** @deprecated */
export const findNextCrossFacingSlot = (boothCount: number) => findNextLayoutSlot(boothCount, 'cross');

/** World yaw so the chosen booth side faces the entrance wall (+Z), perpendicular — not toward the door point. */
const ENTRANCE_WALL_YAW: Record<BoothEntranceFacing, number> = {
  front: 0,
  back: Math.PI,
  left: Math.PI / 2,
  right: -Math.PI / 2,
};

/** In-place Y rotation; keeps layout `ry`, aligns the selected side square to the south entrance wall. */
export const boothEntranceFacingYaw = (ry = 0, facing: BoothEntranceFacing = 'front'): number => {
  let offset = ENTRANCE_WALL_YAW[facing] - ry;
  while (offset > Math.PI) offset -= Math.PI * 2;
  while (offset < -Math.PI) offset += Math.PI * 2;
  return +offset.toFixed(4);
};

/** Meta Business Center — 3 walkable floors with a central stairwell. */
export const BUSINESS_CENTER = {
  floors: 3,
  floorHeight: 4,
  /** Eye height above each floor slab (m). */
  eyeOffset: 1.6,
  stairX: -8,
  stairHalfW: 2.4,
  stairZMin: -8.5,
  stairZMax: 8.5,
  /** South entrance (world metres, hall 28×24). */
  entranceX: 0,
  entranceZ: 10.2,
  spawnX: 0,
  spawnZ: 8.6,
  /** Uniform corridor width (m). */
  corridorW: 2,
  /** Center of the + junction. */
  hubX: 3,
  hubZ: 0,
} as const;

export type BusinessCenterFloorId = 0 | 1 | 2;

export interface BusinessCenterFloorTheme {
  id: BusinessCenterFloorId;
  labelFa: string;
  labelEn: string;
  floorColor: string;
  wallColor: string;
  ceilingColor: string;
  carpetColor: string;
  carpetBorder: string;
  accent: string;
  signBg: string;
  boothZone: string;
  boothColor: string;
  planBg: string;
}

/** Distinct palette per floor — used in 3D building + 2D floor-plan editor. */
export const BUSINESS_CENTER_FLOOR_THEMES: BusinessCenterFloorTheme[] = [
  {
    id: 0,
    labelFa: 'همکف · لابی',
    labelEn: 'Ground · Lobby',
    floorColor: '#e8ddd0',
    wallColor: '#faf6f1',
    ceilingColor: '#fff9f0',
    carpetColor: '#9f1239',
    carpetBorder: '#d4a574',
    accent: '#0d9488',
    signBg: '#0f766e',
    boothZone: '#d6cec4',
    boothColor: '#0f766e',
    planBg: '#f5ebe0',
  },
  {
    id: 1,
    labelFa: 'طبقه اول',
    labelEn: '1st Floor',
    floorColor: '#dbeafe',
    wallColor: '#eff6ff',
    ceilingColor: '#f0f9ff',
    carpetColor: '#1e3a8a',
    carpetBorder: '#60a5fa',
    accent: '#2563eb',
    signBg: '#1d4ed8',
    boothZone: '#bfdbfe',
    boothColor: '#1d4ed8',
    planBg: '#e0f2fe',
  },
  {
    id: 2,
    labelFa: 'طبقه دوم',
    labelEn: '2nd Floor',
    floorColor: '#fef3c7',
    wallColor: '#fffbeb',
    ceilingColor: '#fff7ed',
    carpetColor: '#92400e',
    carpetBorder: '#fbbf24',
    accent: '#ea580c',
    signBg: '#c2410c',
    boothZone: '#fde68a',
    boothColor: '#c2410c',
    planBg: '#fef9c3',
  },
];

export interface BusinessCenterCarpetRect {
  x: number;
  z: number;
  w: number;
  d: number;
  entranceOnly?: boolean;
}

/** Fixed office slots per floor — aligned to walls, doors face the corridor. */
export const BUSINESS_CENTER_OFFICE_SLOTS: { x: number; z: number; ry: number }[] = [
  // East wing — storefront faces west toward main corridor
  { x: 10.5, z: -6, ry: Math.PI / 2 },
  { x: 10.5, z: -2, ry: Math.PI / 2 },
  { x: 10.5, z: 2, ry: Math.PI / 2 },
  { x: 10.5, z: 6, ry: Math.PI / 2 },
  // North wing — faces south
  { x: 2, z: -9.5, ry: 0 },
  { x: 6.5, z: -9.5, ry: 0 },
  // South wing — faces north
  { x: 2, z: 9.5, ry: Math.PI },
  { x: 6.5, z: 9.5, ry: Math.PI },
  // West wing (clear of stairwell) — faces east
  { x: -3.5, z: -4.5, ry: -Math.PI / 2 },
  { x: -3.5, z: 4.5, ry: -Math.PI / 2 },
];

/** Tinted zones behind each office row (world metres). */
export const BUSINESS_CENTER_OFFICE_ZONES = [
  { x: 10.5, z: 0, w: 4.2, d: 16 },
  { x: 4.25, z: -9.5, w: 11, d: 4.2 },
  { x: 4.25, z: 9.5, w: 11, d: 4.2 },
  { x: -3.5, z: 0, w: 4.2, d: 11 },
] as const;

const slotTaken = (booths: { x?: number; z?: number }[], slot: { x: number; z: number }, minDist = 2.2) =>
  booths.some(b => Math.hypot((b.x ?? 0) - slot.x, (b.z ?? 0) - slot.z) < minDist);

/** Next free slot on a floor, or cyclic fallback. */
export const findNextBusinessCenterSlot = (
  booths: { x?: number; z?: number; floorId?: number }[],
  floor: BusinessCenterFloorId,
) => {
  const onFloor = booths.filter(b => (b.floorId ?? 0) === floor);
  const free = BUSINESS_CENTER_OFFICE_SLOTS.find(s => !slotTaken(onFloor, s));
  if (free) return free;
  const i = onFloor.length % BUSINESS_CENTER_OFFICE_SLOTS.length;
  return BUSINESS_CENTER_OFFICE_SLOTS[i];
};

/** Snap drag position to nearest office slot (with rotation) or 0.5 m grid. */
export const snapBusinessCenterPosition = (x: number, z: number) => {
  let best = { x, z, d: Infinity };
  for (const s of BUSINESS_CENTER_OFFICE_SLOTS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best.d) best = { x: s.x, z: s.z, d };
  }
  if (best.d < 3.2) return { x: best.x, z: best.z };
  return { x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2 };
};

export const snapBusinessCenterBooth = (x: number, z: number, fallbackRy = 0) => {
  let best = { x, z, ry: fallbackRy, d: Infinity };
  for (const s of BUSINESS_CENTER_OFFICE_SLOTS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < best.d) best = { x: s.x, z: s.z, ry: s.ry, d };
  }
  if (best.d < 3.2) return { x: best.x, z: best.z, ry: best.ry };
  const g = snapBusinessCenterPosition(x, z);
  return { x: g.x, z: g.z, ry: fallbackRy };
};

/**
 * Carpet runners — non-overlapping segments forming a clear + lobby path.
 * Hub at (hubX, hubZ); entrance path on ground floor only (south).
 */
export const businessCenterCarpetRects = (floor: BusinessCenterFloorId = 0): BusinessCenterCarpetRect[] => {
  const { corridorW: W, hubX: HX, stairX } = BUSINESS_CENTER;
  const segments: BusinessCenterCarpetRect[] = [
    { x: -2.5, z: 0, w: 7, d: W },
    { x: 8.5, z: 0, w: 7, d: W },
    { x: HX, z: -5.5, w: W, d: 9 },
    { x: HX, z: 4.2, w: W, d: 5.6 },
    { x: stairX, z: 0, w: W, d: 12 },
    { x: -6.5, z: 0, w: 2.8, d: W },
  ];
  if (floor === 0) {
    segments.unshift(
      { x: 0, z: 9.6, w: 4, d: 2.6, entranceOnly: true },
      { x: 0, z: 5.5, w: W, d: 6.6, entranceOnly: true },
      { x: 2, z: 1.1, w: 4.4, d: W, entranceOnly: true },
    );
  }
  return segments;
};

export const planRectPct = (rect: BusinessCenterCarpetRect, W: number, D: number) => {
  const cx = ((rect.x + W / 2) / W) * 100;
  const cz = ((rect.z + D / 2) / D) * 100;
  return {
    x: cx - (rect.w / W) * 50,
    y: cz - (rect.d / D) * 50,
    w: (rect.w / W) * 100,
    h: (rect.d / D) * 100,
  };
};

export const businessCenterFloorY = (floor: number) =>
  Math.max(0, Math.min(BUSINESS_CENTER.floors - 1, floor)) * BUSINESS_CENTER.floorHeight;

export const businessCenterEyeY = (floor: number) =>
  businessCenterFloorY(floor) + BUSINESS_CENTER.eyeOffset;

export const businessCenterFloorFromEyeY = (eyeY: number) =>
  Math.max(0, Math.min(BUSINESS_CENTER.floors - 1,
    Math.round((eyeY - BUSINESS_CENTER.eyeOffset) / BUSINESS_CENTER.floorHeight)));

export const isOnBusinessCenterStairs = (x: number, z: number) =>
  Math.abs(x - BUSINESS_CENTER.stairX) < BUSINESS_CENTER.stairHalfW
  && z >= BUSINESS_CENTER.stairZMin && z <= BUSINESS_CENTER.stairZMax;

/** Continuous eye Y while walking the central staircase (ground → 2nd floor). */
export const businessCenterStairEyeY = (z: number) => {
  const { stairZMin, stairZMax, eyeOffset, floorHeight, floors } = BUSINESS_CENTER;
  const t = (stairZMax - z) / (stairZMax - stairZMin);
  const clamped = Math.max(0, Math.min(1, t));
  return eyeOffset + clamped * floorHeight * (floors - 1);
};

/** Resolve player eye height for business_center (floor slabs + stairs). */
export const resolveBusinessCenterPlayerY = (x: number, z: number, prevEyeY: number): number => {
  if (isOnBusinessCenterStairs(x, z)) return businessCenterStairEyeY(z);
  const floor = businessCenterFloorFromEyeY(prevEyeY);
  return businessCenterEyeY(floor);
};

// Auto-arrange booths — 11 professional layout styles, each with matching aisle carpets.
export const autoArrangeBooths = (
  count: number,
  layout: ExpoBoothLayout = 'cross',
): ArrangeResult => {
  const n = Math.max(1, Math.floor(count) || 1);
  const L = normalizeBoothLayout(layout);
  switch (L) {
    case 'boulevard': return arrangeBoulevard(n);
    case 'avenue': return arrangeAvenue(n);
    case 'gallery': return arrangeGallery(n);
    case 'alley': return arrangeAlley(n);
    case 'pavilion': return arrangeCrossFacing(n, 1.28);
    case 'symmetric': return arrangeSymmetric(n);
    case 'perimeter': return arrangePerimeter(n);
    case 'grand': return arrangeGrand(n);
    case 'storefront': return arrangeCrossFacing(n);
    case 'supermarket': return arrangeSupermarket(n);
    case 'cross':
    default: return arrangeCrossFacing(n);
  }
};

// Normalize a phone number for a wa.me link (digits only, drop leading +/00).
export const waLink = (phone: string) => {
  const digits = (phone || '').replace(/[^\d]/g, '').replace(/^00/, '');
  return `https://wa.me/${digits}`;
};

// Default glyph per hotspot type (used when a hotspot has no custom icon).
export const HOTSPOT_ICON: Record<string, string> = {
  product: '🛍️', company: '🏢', video: '▶️', pdf: '📄', image: '🖼️',
  url: '🔗', page: '📑', whatsapp: '💬', contact: '📞', order: '🧾',
};
