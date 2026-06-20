import type { AppConfig, CustomForm, MetaBazaar, MetaShop, NewsArticle } from '../types';

export interface PageMeta {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
}

const truncate = (s: string, max: number) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
};

const absUrl = (origin: string, url?: string) => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${origin.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
};

export const defaultSiteMeta = (config: AppConfig, origin = ''): PageMeta => ({
  title: config.seoTitle || config.ogTitle || config.appTitle || 'پلتفرم توحید دیهمی',
  description: config.seoDescription || config.ogDescription || config.appSubtitle,
  image: absUrl(origin, config.ogImage),
  siteName: config.appTitle || 'پلتفرم توحید دیهمی',
  type: 'website',
});

export const metaFromMetaShop = (shop: MetaShop, origin = ''): PageMeta => {
  const title = shop.title?.trim() || shop.name?.trim() || shop.slug;
  const description = shop.subtitle?.trim()
    || shop.collectionText?.trim()
    || (shop.type === 'services' ? `خدمات ${shop.name}` : `فروشگاه ${shop.name}`);
  return {
    title,
    description: truncate(description, 160),
    image: absUrl(origin, shop.coverImage || shop.logo),
    type: 'website',
    siteName: shop.name,
  };
};

export const metaFromForm = (form: CustomForm): PageMeta => ({
  title: form.title?.trim() || 'فرم آنلاین',
  description: truncate(form.description?.trim() || form.titleEn?.trim() || form.category || 'ثبت درخواست آنلاین', 160),
  type: 'website',
});

export const metaFromNews = (article: NewsArticle, lang: 'fa' | 'en' = 'fa'): PageMeta => {
  const title = lang === 'en' && article.titleEn ? article.titleEn : article.title;
  const description = lang === 'en' && article.summaryEn ? article.summaryEn : (article.metaDescription || article.summary);
  return {
    title,
    description: truncate(description, 160),
    image: article.coverImage,
    type: 'article',
  };
};

export const metaFromBazaar = (bazaar: MetaBazaar, origin = ''): PageMeta => {
  const expo = bazaar.expo;
  const title = (expo?.enabled && (expo.title?.fa || expo.title?.en))
    ? (expo.title?.fa || expo.title?.en || bazaar.name)
    : bazaar.name;
  const description = expo?.subtitle?.fa || expo?.subtitle?.en || bazaar.subtitle?.fa || bazaar.subtitle?.en || `بازارچه ${bazaar.name}`;
  return {
    title: String(title),
    description: truncate(String(description), 160),
    image: absUrl(origin, expo?.entranceArchMedia || bazaar.coverImage),
    type: 'website',
    siteName: bazaar.name,
  };
};

export function applyPageMeta(meta: PageMeta, fallback?: PageMeta) {
  const title = meta.title || fallback?.title || document.title;
  const description = meta.description || fallback?.description;
  const image = meta.image || fallback?.image;
  const url = meta.url || fallback?.url || (typeof window !== 'undefined' ? window.location.href : undefined);
  const type = meta.type || fallback?.type || 'website';
  const siteName = meta.siteName || fallback?.siteName;

  document.title = title;

  const setMeta = (name: string, content: string) => {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
    el.content = content;
  };
  const setOg = (prop: string, content: string) => {
    if (!content) return;
    let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
    if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
    el.content = content;
  };

  if (description) {
    setMeta('description', description);
    setOg('og:description', description);
    setMeta('twitter:description', description);
  }
  setOg('og:title', title);
  setMeta('twitter:title', title);
  if (image) {
    setOg('og:image', image);
    setMeta('twitter:image', image);
    setMeta('twitter:card', 'summary_large_image');
  }
  if (url) setOg('og:url', url);
  setOg('og:type', type);
  if (siteName) setOg('og:site_name', siteName);
}
