
import React, { useState, useEffect } from 'react';
import { NewsArticle } from '../types';
import { IconSearch, IconArrowRight, IconNewspaper } from './Icons';
import { Language } from '../App';

interface Props {
  articles: NewsArticle[];
  lang: Language;
  onBack: () => void;
  isLoading?: boolean;
  initialArticleId?: string;
}

const CATEGORIES_FA = ['همه', 'اخبار صادرات', 'بازارهای هدف', 'قوانین و مقررات', 'موفقیت‌های مشتریان', 'راهنما و آموزش', 'سایر'];

function formatDateFa(iso: string): string {
  try {
    const d = new Date(iso);
    const dateParts = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).formatToParts(d);
    const get = (type: string) => dateParts.find(p => p.type === type)?.value ?? '';
    const timeParts = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const getT = (type: string) => timeParts.find(p => p.type === type)?.value ?? '';
    return `${get('day')} ${get('month')} ${get('year')} — ${getT('hour')}:${getT('minute')}`;
  } catch { return iso; }
}

const PAGE_SIZE = 9;

export const NewsPage: React.FC<Props> = ({ articles, lang, onBack, isLoading = false, initialArticleId }) => {
  const [selectedId, setSelectedId] = useState<string | null>(initialArticleId ?? null);
  const [activeCategory, setActiveCategory] = useState('همه');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // If articles arrive after mount and we have an initialArticleId pending, confirm it exists
  useEffect(() => {
    if (initialArticleId && articles.length > 0) {
      const found = articles.find(a => a.id === initialArticleId);
      // Also support legacy hash-based #/news/{slug} links
      if (!found) {
        const hash = window.location.hash;
        if (hash.startsWith('#/news/')) {
          const slug = decodeURIComponent(hash.replace('#/news/', ''));
          const bySlug = articles.find(a => a.slug === slug || a.id === slug);
          if (bySlug) setSelectedId(bySlug.id);
        }
      }
    }
  }, [articles, initialArticleId]);

  // Browser back/forward: read ?id= from query params
  useEffect(() => {
    const handlePop = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      setSelectedId(id || null);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Use article ID (short) — NOT the Persian slug — to keep URLs concise & social-media safe
  const selectArticle = (id: string) => {
    setSelectedId(id);
    history.pushState(null, '', `?page=news&id=${id}`);
  };

  const goBackToList = () => {
    setSelectedId(null);
    history.pushState(null, '', '?page=news');
  };

  const now = Date.now();

  // isPublished AND publishedAt has passed (scheduled publishing)
  const published = articles
    .filter(a => a.isPublished && new Date(a.publishedAt).getTime() <= now)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const getCategories = (a: NewsArticle): string[] =>
    a.categories && a.categories.length > 0 ? a.categories : [a.category];

  const filtered = published.filter(a => {
    const matchCat = activeCategory === 'همه' || getCategories(a).includes(activeCategory);
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      a.title.toLowerCase().includes(q) ||
      (a.titleEn || '').toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      (a.content || '').toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedArticle = selectedId ? articles.find(a => a.id === selectedId) : null;

  // JSON-LD for search engines that render JavaScript
  useEffect(() => {
    const elId = 'news-jsonld';
    document.getElementById(elId)?.remove();
    if (!selectedArticle) return;
    const script = document.createElement('script');
    script.id = elId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: selectedArticle.title,
      description: selectedArticle.metaDescription || selectedArticle.summary,
      image: selectedArticle.coverImage ? [selectedArticle.coverImage] : undefined,
      datePublished: selectedArticle.publishedAt,
      author: { '@type': 'Person', name: selectedArticle.author || 'توحید دیهمی' },
      keywords: (selectedArticle.tags || []).join(', ') || undefined,
    });
    document.head.appendChild(script);
    return () => { document.getElementById(elId)?.remove(); };
  }, [selectedArticle]);

  if (selectedArticle) {
    return (
      <article className="max-w-3xl mx-auto animate-fade-in py-4">
        <button onClick={goBackToList}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <IconArrowRight className="w-3.5 h-3.5 rotate-180" />
          {lang === 'fa' ? 'بازگشت به اخبار' : 'Back to News'}
        </button>

        {selectedArticle.coverImage && (
          <div className="w-full h-52 md:h-72 rounded-xl overflow-hidden mb-6 bg-gray-100">
            <img src={selectedArticle.coverImage} alt={selectedArticle.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap mb-4">
          {getCategories(selectedArticle).map(cat => (
            <span key={cat} className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 border border-gray-200 px-2 py-0.5 rounded">
              {cat}
            </span>
          ))}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-3">
          {lang === 'en' && selectedArticle.titleEn ? selectedArticle.titleEn : selectedArticle.title}
        </h1>

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-6 pb-6 border-b border-gray-100">
          <span>{selectedArticle.author}</span>
          <span>·</span>
          <span>{formatDateFa(selectedArticle.publishedAt)}</span>
          {selectedArticle.tags.length > 0 && (
            <>
              <span>·</span>
              <div className="flex gap-1 flex-wrap">
                {selectedArticle.tags.map(tag => (
                  <span key={tag} className="bg-gray-100 px-2 py-0.5 rounded text-gray-500">#{tag}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div
          className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap"
          style={{ lineHeight: '2', fontSize: '0.9rem' }}
        >
          {lang === 'en' && selectedArticle.contentEn ? selectedArticle.contentEn : selectedArticle.content}
        </div>
      </article>
    );
  }

  return (
    <main className="animate-fade-in py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {lang === 'fa' ? 'اخبار و مقالات' : 'News & Articles'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {lang === 'fa' ? 'آخرین اخبار حوزه صادرات و بازرگانی' : 'Latest export and trade news'}
          </p>
        </div>
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
          {lang === 'fa' ? 'بازگشت' : 'Back'}
        </button>
      </div>

      {/* Search + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <IconSearch className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={lang === 'fa' ? 'جستجو در اخبار...' : 'Search news...'}
            className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES_FA.map(cat => (
            <button key={cat} onClick={() => { setActiveCategory(cat); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${activeCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden bg-white animate-pulse">
              <div className="w-full h-40 bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-4/5" />
                <div className="h-4 bg-gray-100 rounded w-3/5" />
                <div className="h-3 bg-gray-100 rounded w-full mt-3" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <IconNewspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{lang === 'fa' ? 'مقاله‌ای یافت نشد.' : 'No articles found.'}</p>
        </div>
      ) : (
        <>
        {filtered.length > 0 && (
          <p className="text-xs text-gray-400 mb-3">
            {lang === 'fa'
              ? `${filtered.length} مقاله — صفحه ${safePage} از ${totalPages}`
              : `${filtered.length} articles — page ${safePage} of ${totalPages}`}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map(article => (
            <button
              key={article.id}
              onClick={() => selectArticle(article.id)}
              className="text-start border border-gray-100 rounded-xl overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all group bg-white"
            >
              {article.coverImage ? (
                <div className="w-full h-40 bg-gray-100 overflow-hidden">
                  <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className="w-full h-40 bg-gray-50 flex items-center justify-center">
                  <IconNewspaper className="w-8 h-8 text-gray-200" />
                </div>
              )}
              <div className="p-4">
                <div className="flex gap-1 flex-wrap">
                  {getCategories(article).map(cat => (
                    <span key={cat} className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{cat}</span>
                  ))}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mt-1 mb-2 leading-snug line-clamp-2 group-hover:text-gray-700">
                  {lang === 'en' && article.titleEn ? article.titleEn : article.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                  {lang === 'en' && article.summaryEn ? article.summaryEn : article.summary}
                </p>
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{article.author}</span>
                  <span>{formatDateFa(article.publishedAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-8">
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
              disabled={safePage === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {lang === 'fa' ? '← قبلی' : '← Prev'}
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => { setPage(p); window.scrollTo(0, 0); }}
                className={`w-8 h-8 text-xs rounded-lg transition-colors ${p === safePage ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo(0, 0); }}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {lang === 'fa' ? 'بعدی →' : 'Next →'}
            </button>
          </div>
        )}
        </>
      )}
    </main>
  );
};
