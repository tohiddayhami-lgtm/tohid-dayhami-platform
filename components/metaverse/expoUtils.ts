import type { MetaShopDirCat, MetaverseExpo, MetaverseBooth } from '../../types';
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
  height: 6,
  groundColor: '#cfd4dc',
  wallColor: '#e9edf3',
  preset: 'warehouse' as const,
  eyeHeight: 1.6,
};

export const hallDims = (expo: MetaverseExpo) => ({
  width: Math.max(8, expo.width || EXPO_DEFAULTS.width),
  depth: Math.max(8, expo.depth || EXPO_DEFAULTS.depth),
  height: Math.max(3, expo.height || EXPO_DEFAULTS.height),
});

export const boothPos = (b: MetaverseBooth): [number, number, number] => [b.x || 0, b.y || 0, b.z || 0];

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
