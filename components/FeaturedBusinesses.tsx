
import React from 'react';
import { FeaturedBusiness } from '../types';
import { IconBriefcase, IconCheck, IconStar, IconUsers, IconMapPin } from './Icons';

interface Props {
  businesses: FeaturedBusiness[];
  lang: 'fa' | 'en';
}

export const FeaturedBusinesses: React.FC<Props> = ({ businesses, lang }) => {
  if (!businesses || businesses.length === 0) return null;

  const t = {
    fa: {
      title: 'معرفی کسب‌وکارهای برتر ایرانی',
      subtitle: 'شبکه‌ای از معتبرترین برندها و تولیدکنندگان منتخب کشور',
      visit: 'بازدید از وب‌سایت',
      contact: 'تماس',
      premium: 'ویژه',
      category: 'دسته‌بندی'
    },
    en: {
      title: 'Featured Iranian Businesses',
      subtitle: 'A network of top-tier selected brands and manufacturers',
      visit: 'Visit Website',
      contact: 'Contact',
      premium: 'Premium',
      category: 'Category'
    }
  }[lang];

  // Sort: Gold first, then others
  const sortedBusinesses = [...businesses].sort((a, b) => (a.isGold === b.isGold ? 0 : a.isGold ? -1 : 1));

  return (
    <div className="py-20 bg-gray-50 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 -left-10 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-10 -right-10 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-32 left-20 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-2 bg-indigo-50 rounded-2xl mb-4">
             <span className="bg-white px-4 py-1 rounded-xl text-xs font-bold text-indigo-700 shadow-sm border border-indigo-100 flex items-center gap-2">
                <IconStar className="w-4 h-4 text-amber-500 fill-current" /> 
                {lang === 'fa' ? 'حامیان و شرکای تجاری' : 'Partners & Sponsors'}
             </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 tracking-tight">{t.title}</h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sortedBusinesses.map((biz) => (
            <div 
              key={biz.id} 
              className={`group relative bg-white rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-2
                ${biz.isGold 
                  ? 'border-2 border-amber-300 shadow-[0_20px_50px_rgba(251,191,36,0.2)] hover:shadow-[0_20px_60px_rgba(251,191,36,0.3)]' 
                  : 'border border-gray-100 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-gray-200/80'
                }
              `}
            >
              {/* Gold Ribbon */}
              {biz.isGold && (
                <div className="absolute top-0 right-0 z-20">
                   <div className="bg-gradient-to-l from-amber-400 to-yellow-500 text-white text-[10px] font-bold px-4 py-1 rounded-bl-xl shadow-md flex items-center gap-1">
                      <IconStar className="w-3 h-3 fill-current" /> {t.premium}
                   </div>
                </div>
              )}

              {/* Image Section */}
              <div className={`h-48 w-full overflow-hidden relative ${biz.isGold ? 'bg-gradient-to-br from-amber-50 to-orange-50' : 'bg-gray-100'}`}>
                 {biz.imageUrl ? (
                    <img src={biz.imageUrl} alt={biz.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                 ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <IconBriefcase className="w-16 h-16 opacity-20" />
                    </div>
                 )}
                 <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-white via-white/80 to-transparent"></div>
              </div>

              {/* Content Section */}
              <div className="p-6 relative -mt-8">
                 <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 w-fit mb-4">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex items-center gap-1">
                       {biz.category}
                    </span>
                 </div>

                 <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{biz.name}</h3>
                 <p className="text-sm text-gray-500 leading-relaxed mb-6 line-clamp-3 h-16">{biz.description}</p>

                 <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                    {biz.websiteUrl && (
                        <a href={biz.websiteUrl} target="_blank" rel="noreferrer" className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors ${biz.isGold ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-200 hover:shadow-xl' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'}`}>
                           {t.visit}
                           <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                        </a>
                    )}
                    {biz.contactNumber && (
                        <a href={`tel:${biz.contactNumber}`} className="w-full py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                           {t.contact}: <span className="dir-ltr">{biz.contactNumber}</span>
                        </a>
                    )}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
