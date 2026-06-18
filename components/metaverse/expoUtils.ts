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

export type ExpoBoothLayout = 'grid' | 'facing' | 'perimeter' | 'storefront' | 'supermarket' | 'business_center';

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
 * Carpet runners — clean + junction (E–W spine × N–S spine) + stair lane + lobby.
 */
export const businessCenterCarpetRects = (floor: BusinessCenterFloorId = 0): BusinessCenterCarpetRect[] => {
  const carpets: BusinessCenterCarpetRect[] = [
    { x: 3, z: 0, w: 18, d: 2.4 },
    { x: 4, z: 0, w: 2.2, d: 16 },
    { x: BUSINESS_CENTER.stairX, z: 0, w: 2.2, d: 14 },
    { x: -5.5, z: 0, w: 2.4, d: 2.4 },
  ];
  if (floor === 0) {
    carpets.push({ x: 0, z: 6.5, w: 2.4, d: 5 });
    carpets.push({ x: 0, z: 3.2, w: 2.4, d: 3.4 });
  }
  return carpets;
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

// Auto-arrange `count` booths and size the hall to fit. `facing` creates paired booths across
// walking aisles; `perimeter` uses the outside walls; `grid` keeps the older compact rows.
export const autoArrangeBooths = (count: number, layout: ExpoBoothLayout = 'facing'): { width: number; depth: number; spawn: { x: number; y: number; z: number; ry: number }; cells: { x: number; z: number; ry: number; floor?: number }[] } => {
  const n = Math.max(1, Math.min(60, Math.floor(count) || 1));
  const cells: { x: number; z: number; ry: number; floor?: number }[] = [];
  const booth = 4;

  if (layout === 'business_center') {
    const width = 28;
    const depth = 24;
    const slotsPerFloor = BUSINESS_CENTER_OFFICE_SLOTS;
    for (let i = 0; i < n; i++) {
      const floor = Math.floor(i / slotsPerFloor.length) % BUSINESS_CENTER.floors;
      const slot = slotsPerFloor[i % slotsPerFloor.length];
      cells.push({ x: slot.x, z: slot.z, ry: slot.ry, floor });
    }
    const spawn = { x: 0, y: 0, z: 7, ry: Math.PI };
    return { width, depth, spawn, cells };
  }

  if (layout === 'storefront') {
    const cols = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(n * 1.4))));
    const rows = Math.ceil(n / cols);
    const width = Math.max(24, cols * 5.8 + 8);
    const depth = Math.max(24, rows * 8.2 + 12);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const colsThisRow = Math.min(cols, n - r * cols);
      const x = (c - (colsThisRow - 1) / 2) * 5.8;
      const z = depth / 2 - 7.2 - r * 8.2;
      cells.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: Math.PI });
    }
    const spawn = { x: 0, y: 0, z: +(depth / 2 - 3).toFixed(2), ry: Math.PI };
    return { width, depth, spawn, cells };
  }

  if (layout === 'supermarket') {
    const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))));
    const rows = Math.ceil(n / cols);
    const width = Math.max(28, cols * 7 + 12);
    const depth = Math.max(30, rows * 9 + 14);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const colsThisRow = Math.min(cols, n - r * cols);
      const x = (c - (colsThisRow - 1) / 2) * 7;
      const z = depth / 2 - 8.5 - r * 9;
      cells.push({ x: +x.toFixed(2), z: +z.toFixed(2), ry: Math.PI });
    }
    const spawn = { x: 0, y: 0, z: +(depth / 2 - 3).toFixed(2), ry: Math.PI };
    return { width, depth, spawn, cells };
  }

  if (layout === 'facing') {
    const pairCount = Math.ceil(n / 2);
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(pairCount))));
    const rows = Math.ceil(pairCount / cols);
    const sideAisle = 4;
    const frontAisle = 4.8;
    const crossAisle = 5;
    const cellW = booth + sideAisle;
    const rowPitch = booth * 2 + frontAisle + crossAisle;
    const halfPairGap = booth / 2 + frontAisle / 2;
    const width = Math.max(20, cols * cellW + 10);
    const depth = Math.max(22, rows * rowPitch + 10);
    for (let i = 0; i < n; i++) {
      const pair = Math.floor(i / 2);
      const r = Math.floor(pair / cols), c = pair % cols;
      const colsThisRow = Math.min(cols, pairCount - r * cols);
      const x = (c - (colsThisRow - 1) / 2) * cellW;
      const zCenter = ((rows - 1) / 2 - r) * rowPitch;
      const side = i % 2;
      cells.push({ x: +x.toFixed(2), z: +(zCenter + (side === 0 ? -halfPairGap : halfPairGap)).toFixed(2), ry: side === 0 ? 0 : Math.PI });
    }
    const spawn = { x: 0, y: 0, z: +(depth / 2 - 3).toFixed(2), ry: Math.PI };
    return { width, depth, spawn, cells };
  }

  if (layout === 'perimeter') {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) counts[i % 4]++;
    const maxSide = Math.max(...counts, 1);
    const slot = 7.2;
    const wallClearance = booth / 2 + 1.7;
    const width = Math.max(24, maxSide * slot + 14);
    const depth = Math.max(24, maxSide * slot + 14);
    const placeAlong = (idx: number, total: number, span: number) => total <= 1 ? 0 : (idx - (total - 1) / 2) * Math.min(slot, span / Math.max(1, total - 1));
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
    const spawn = { x: 0, y: 0, z: +(depth / 2 - 3).toFixed(2), ry: Math.PI };
    return { width, depth, spawn, cells };
  }

  const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  const cellW = 8; // booth (4m) + generous side aisle
  const cellD = 9; // booth (4m) + walking aisle in front
  const width = Math.max(18, cols * cellW + 8);
  const depth = Math.max(20, rows * cellD + 10);
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
