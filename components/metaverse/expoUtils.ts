import type { MetaShopDirCat, MetaverseExpo, MetaverseBooth, MetaShop } from '../../types';
import { Language } from '../../App';

// ── Bilingual label resolver (mirrors the {fa,en} pattern used across MetaShop/MetaBazaar) ──
export const bi = (v: MetaShopDirCat | undefined | null, lang: Language, fallback = ''): string => {
  if (!v) return fallback;
  if (lang === 'fa') return (v.fa || v.en || fallback);
  return (v.en || v.fa || fallback);
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
  // Clamp to a tall minimum so halls feel like real exhibition spaces, not low rooms.
  height: Math.max(8, expo.height || EXPO_DEFAULTS.height),
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
  const off = 0.08;
  const y = Math.max(0.4, v * height);
  switch (wall) {
    case 'left':  return { position: [-width / 2 + off, y, (u - 0.5) * depth], rotation: [0, Math.PI / 2, 0] };
    case 'right': return { position: [width / 2 - off, y, (0.5 - u) * depth], rotation: [0, -Math.PI / 2, 0] };
    case 'front': return { position: [(0.5 - u) * width, y, depth / 2 - off], rotation: [0, Math.PI, 0] };
    case 'back':
    default:      return { position: [(u - 0.5) * width, y, -depth / 2 + off], rotation: [0, 0, 0] };
  }
};

// Convert a YouTube / Vimeo / direct-mp4 URL into an embeddable form for the video popup.
export const videoEmbed = (url: string): { kind: 'iframe' | 'video'; src: string } | null => {
  if (!url) return null;
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: 'video', src: u };
  // Unknown host → try as an iframe (lets generic embeds / pages through)
  return { kind: 'iframe', src: u };
};

// Same as videoEmbed but for an always-on, muted, looping in-world LCD screen (autoplay params added).
export const screenEmbed = (url: string): { kind: 'iframe' | 'video'; src: string } | null => {
  if (!url) return null;
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&modestbranding=1&playsinline=1&rel=0` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1&loop=1&background=1` };
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: 'video', src: u };
  return { kind: 'iframe', src: u };
};

// Is this URL a playable video (vs. an image)? Used to decide between an LCD screen and a panel.
export const isVideoUrl = (url?: string): boolean =>
  !!url && (/(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url) || /\.(mp4|webm|ogg)(\?.*)?$/i.test(url));

// Pull a booth's visuals from a linked MetaShop ("make the booth this shop"): bilingual name,
// accent color, logo, and panels (cover image inside-back, first product video for the LCD).
export const shopToBoothFields = (shop: MetaShop, lang: Language): Partial<MetaverseBooth> => {
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

// Auto-arrange `count` booths into tidy exhibition aisles and size the hall to fit.
// Booths face +Z (toward the entrance/spawn) in a cols×rows grid with walking aisles between.
export const autoArrangeBooths = (count: number): { width: number; depth: number; spawn: { x: number; y: number; z: number; ry: number }; cells: { x: number; z: number; ry: number }[] } => {
  const n = Math.max(1, Math.min(60, Math.floor(count) || 1));
  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  const cellW = 7;   // booth (4m) + side aisle
  const cellD = 8;   // booth (4m) + walking aisle in front
  const width = Math.max(14, cols * cellW + 6);
  const depth = Math.max(16, rows * cellD + 10);
  const cells: { x: number; z: number; ry: number }[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const colsThisRow = Math.min(cols, n - r * cols);
    const x = (c - (colsThisRow - 1) / 2) * cellW;
    const z = ((rows - 1) / 2 - r) * cellD; // row 0 nearest the entrance (+Z), facing the visitor
    cells.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: 0 });
  }
  const spawn = { x: 0, y: 0, z: +(depth / 2 - 3).toFixed(2), ry: Math.PI };
  return { width, depth, spawn, cells };
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
