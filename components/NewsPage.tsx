
import React, { useState } from 'react';
import { NewsArticle } from '../types';
import { IconSearch, IconArrowRight, IconNewspaper } from './Icons';
import { Language } from '../App';

interface Props {
  articles: NewsArticle[];
  lang: Language;
  onBack: () => void;
}

const CATEGORIES_FA = ['همه', 'اخبار صادرات', 'بازارهای هدف', 'قوانین و مقررات', 'موفقیت‌های مشتریان', 'راهنما و آموزش', 'سایر'];

function formatDateFa(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return iso; }
}

export const NewsPage: React.FC<Props> = ({ articles, lang, onBack }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('همه');
  const [search, setSearch] = useState('');

  const published = articles.filter(a => a.isPublished);

  const filtered = published.filter(a => {
    const matchCat = activeCategory === 'همه' || a.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const selectedArticle = selectedId ? articles.find(a => a.id === selectedId) : null;

  if (selectedArticle) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in py-4">
        <button onClick={() => setSelectedId(null)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <IconArrowRight className="w-3.5 h-3.5 rotate-180" />
          {lang === 'fa' ? 'بازگشت به اخبار' : 'Back to News'}
        </button>

        {selectedArticle.coverImage && (
          <div className="w-full h-52 md:h-72 rounded-xl overflow-hidden mb-6 bg-gray-100">
            <img src={selectedArticle.coverImage} alt={selectedArticle.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 border border-gray-200 px-2 py-0.5 rounded">
            {selectedArticle.category}
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-3">
          {lang === 'en' && selectedArticle.titleEn ? selectedArticle.titleEn : selectedArticle.title}
        </h1>

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-6 pb-6 border-b border-gray-100">
          <span>{selectedArticle.author}</span>
          <span>·</span>
          <span dir="ltr">{formatDateFa(selectedArticle.publishedAt)}</span>
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
      </div>
    );
  }

  return (
    <div className="animate-fade-in py-2">
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
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'fa' ? 'جستجو در اخبار...' : 'Search news...'}
            className="w-full ps-9 pe-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-gray-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES_FA.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${activeCategory === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <IconNewspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{lang === 'fa' ? 'مقاله‌ای یافت نشد.' : 'No articles found.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(article => (
            <button
              key={article.id}
              onClick={() => setSelectedId(article.id)}
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
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{article.category}</span>
                <h3 className="text-sm font-semibold text-gray-900 mt-1 mb-2 leading-snug line-clamp-2 group-hover:text-gray-700">
                  {lang === 'en' && article.titleEn ? article.titleEn : article.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                  {lang === 'en' && article.summaryEn ? article.summaryEn : article.summary}
                </p>
                <div className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>{article.author}</span>
                  <span dir="ltr">{formatDateFa(article.publishedAt)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
