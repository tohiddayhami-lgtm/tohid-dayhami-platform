import React from 'react';
import { Language } from '../App';

/** Inline skeleton for export / bazaar pages — keeps site chrome visible (not fullscreen). */
export const ExportPageSkeleton: React.FC<{ lang?: Language }> = ({ lang = 'fa' }) => {
  const fa = lang === 'fa';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label={fa ? 'در حال بارگذاری' : 'Loading'}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border border-gray-100 rounded-xl overflow-hidden bg-white">
          <div className="h-40 bg-gray-100 animate-pulse" />
          <div className="p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Full-page skeleton for standalone bazaar / expo-map routes (no app header). */
export const ExportStandaloneSkeleton: React.FC<{ lang?: Language; title?: string }> = ({ lang = 'fa', title }) => {
  const fa = lang === 'fa';
  return (
    <div className="min-h-screen bg-gray-50" dir={fa ? 'rtl' : 'ltr'}>
      <header className="relative overflow-hidden rounded-b-2xl text-white text-center bg-gradient-to-br from-gray-700 to-gray-900" style={{ minHeight: '180px' }}>
        <div className="relative z-[1] px-5 pt-14 pb-16 max-w-2xl mx-auto">
          {title ? (
            <h1 className="text-2xl font-bold">{title}</h1>
          ) : (
            <>
              <div className="h-8 w-48 mx-auto bg-white/20 rounded animate-pulse mb-4" />
              <div className="h-5 w-56 mx-auto bg-white/15 rounded animate-pulse" />
            </>
          )}
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-5 py-6">
        <div className="h-11 bg-gray-200 rounded-xl animate-pulse mb-6 -mt-5 relative z-10" />
        <ExportPageSkeleton lang={lang} />
      </div>
    </div>
  );
};
