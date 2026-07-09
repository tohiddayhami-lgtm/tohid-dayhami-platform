import React from 'react';
import type { SupplierListFilters } from '../../types/supplier';
import { SUPPLIER_CATEGORIES, SUPPLIER_STATUSES, COUNTRIES, DEFAULT_SUPPLIER_TAGS } from '../../utils/supplierConstants';
import { IconSearch, IconStar, IconAward } from '../Icons';

interface Props {
  filters: SupplierListFilters;
  onChange: (f: SupplierListFilters) => void;
  lang: 'fa' | 'en';
  serviceOptions: string[];
}

const emptyFilters = (): SupplierListFilters => ({
  search: '',
  countries: [],
  categories: [],
  serviceTypes: [],
  statuses: [],
  tags: [],
});

export const SupplierFilterBar: React.FC<Props> = ({ filters, onChange, lang, serviceOptions }) => {
  const toggleArr = <T extends string>(key: keyof SupplierListFilters, val: T) => {
    const cur = (filters[key] as T[]) || [];
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
    onChange({ ...filters, [key]: next });
  };

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <IconSearch className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pr-10 pl-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400"
            placeholder={lang === 'fa' ? 'جستجوی فوری...' : 'Instant search...'}
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
          />
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...filters, favoriteOnly: !filters.favoriteOnly })}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1 ${filters.favoriteOnly ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          <IconStar className="w-3.5 h-3.5" />
          {lang === 'fa' ? 'مورد علاقه' : 'Favorite'}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...filters, topOnly: !filters.topOnly })}
          className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1 ${filters.topOnly ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          <IconAward className="w-3.5 h-3.5" />
          {lang === 'fa' ? 'برتر' : 'Top'}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...filters, recentlyAdded: !filters.recentlyAdded })}
          className={`px-3 py-2 rounded-xl text-xs font-bold border ${filters.recentlyAdded ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          {lang === 'fa' ? 'اخیراً اضافه شده' : 'Recently Added'}
        </button>
        <button type="button" onClick={() => onChange(emptyFilters())} className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50">
          {lang === 'fa' ? 'پاک کردن فیلترها' : 'Clear filters'}
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase">{lang === 'fa' ? 'کشور' : 'Country'}</label>
          <select
            multiple
            className="w-full mt-1 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs h-24"
            value={filters.countries}
            onChange={e => onChange({ ...filters, countries: Array.from(e.target.selectedOptions, o => o.value) })}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase">{lang === 'fa' ? 'دسته محصول' : 'Category'}</label>
          <select
            multiple
            className="w-full mt-1 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs h-24"
            value={filters.categories}
            onChange={e => onChange({ ...filters, categories: Array.from(e.target.selectedOptions, o => o.value) })}
          >
            {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase">{lang === 'fa' ? 'نوع خدمت' : 'Service Type'}</label>
          <select
            multiple
            className="w-full mt-1 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs h-24"
            value={filters.serviceTypes}
            onChange={e => onChange({ ...filters, serviceTypes: Array.from(e.target.selectedOptions, o => o.value) })}
          >
            {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">{lang === 'fa' ? 'وضعیت' : 'Status'}</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {SUPPLIER_STATUSES.map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => toggleArr('statuses', st)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${filters.statuses.includes(st) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400">{lang === 'fa' ? 'حداقل امتیاز' : 'Min Rating'}</label>
              <input type="number" min={0} max={5} step={0.5} className="w-full mt-1 px-2 py-1.5 border rounded-lg text-xs"
                value={filters.minRating ?? ''} onChange={e => onChange({ ...filters, minRating: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400">{lang === 'fa' ? 'حداقل نمره' : 'Min Score'}</label>
              <input type="number" min={0} max={5} step={0.1} className="w-full mt-1 px-2 py-1.5 border rounded-lg text-xs"
                value={filters.minScore ?? ''} onChange={e => onChange({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-bold text-gray-400 uppercase">{lang === 'fa' ? 'برچسب‌ها' : 'Tags'}</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {DEFAULT_SUPPLIER_TAGS.map(t => (
            <button
              key={t.label}
              type="button"
              onClick={() => toggleArr('tags', t.label)}
              className="px-2 py-1 rounded-full text-[10px] font-bold border"
              style={{
                backgroundColor: filters.tags.includes(t.label) ? t.color : '#fff',
                borderColor: t.color,
                color: filters.tags.includes(t.label) ? '#fff' : t.color,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-gray-400">{lang === 'fa' ? 'آخرین تماس از' : 'Last contact after'}</label>
          <input type="date" className="w-full mt-1 px-2 py-1.5 border rounded-lg text-xs"
            value={filters.lastContactAfter?.slice(0, 10) || ''}
            onChange={e => onChange({ ...filters, lastContactAfter: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400">{lang === 'fa' ? 'آخرین تماس تا' : 'Last contact before'}</label>
          <input type="date" className="w-full mt-1 px-2 py-1.5 border rounded-lg text-xs"
            value={filters.lastContactBefore?.slice(0, 10) || ''}
            onChange={e => onChange({ ...filters, lastContactBefore: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
        </div>
      </div>
    </div>
  );
};
