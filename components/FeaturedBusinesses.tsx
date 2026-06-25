
import React from 'react';
import { FeaturedBusiness } from '../types';
import { IconBriefcase, IconStar } from './Icons';

interface Props {
  businesses: FeaturedBusiness[];
  lang: 'fa' | 'en';
}

export const FeaturedBusinesses: React.FC<Props> = ({ businesses, lang }) => {
  if (!businesses || businesses.length === 0) return null;

  const t = {
    fa: { title: 'کسب‌وکارهای برتر', subtitle: 'شبکه‌ای از معتبرترین برندها و تولیدکنندگان منتخب', visit: 'بازدید از وب‌سایت', contact: 'تماس', premium: 'ویژه' },
    en: { title: 'Featured Businesses', subtitle: 'A network of top-tier brands and manufacturers', visit: 'Visit Website', contact: 'Contact', premium: 'Premium' }
  }[lang];

  const sorted = [...businesses].sort((a, b) => (a.isGold === b.isGold ? 0 : a.isGold ? -1 : 1));

  return (
    <section className="py-16 border-t border-gray-100">
      <div className="mb-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {lang === 'fa' ? 'حامیان و شرکا' : 'Partners & Sponsors'}
        </p>
        <h2 className="text-2xl font-semibold text-gray-900">{t.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((biz) => (
          <div key={biz.id}
            className={`group rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5
              ${biz.isGold ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'}`}
          >
            {/* Image */}
            <div className={`h-36 w-full overflow-hidden relative ${biz.isGold ? 'bg-amber-50' : 'bg-gray-100'}`}>
              {biz.imageUrl
                ? <img src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                : <div className="w-full h-full flex items-center justify-center"><IconBriefcase className="w-10 h-10 text-gray-300" /></div>
              }
              {biz.isGold && (
                <div className="absolute top-2.5 end-2.5 bg-amber-400 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <IconStar className="w-2.5 h-2.5 fill-current" /> {t.premium}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{biz.category}</span>
              <h3 className="text-sm font-semibold text-gray-900 mt-2 mb-1 group-hover:text-gray-600 transition-colors">{biz.name}</h3>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">{biz.description}</p>

              <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
                {biz.websiteUrl && (
                  <a href={biz.websiteUrl} target="_blank" rel="noreferrer"
                    className={`w-full py-2 rounded-full text-xs font-medium text-center transition-colors
                      ${biz.isGold ? 'bg-amber-400 hover:bg-amber-500 text-white' : 'bg-gray-900 hover:bg-black text-white'}`}>
                    {t.visit}
                  </a>
                )}
                {biz.contactNumber && (
                  <a href={`tel:${biz.contactNumber}`}
                    className="w-full py-2 border border-gray-200 text-gray-600 rounded-full text-xs font-medium text-center hover:bg-gray-50 transition-colors">
                    {t.contact}: <span className="dir-ltr">{biz.contactNumber}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
