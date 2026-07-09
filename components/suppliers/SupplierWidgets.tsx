import React from 'react';
import type { GlobalSupplier } from '../../types/supplier';
import { supplierDisplayScore } from '../../utils/supplierAccess';
import { IconStar, IconGlobe, IconAward, IconClock, IconFileText, IconFlag } from '../Icons';

interface Props {
  suppliers: GlobalSupplier[];
  lang: 'fa' | 'en';
}

export const SupplierWidgets: React.FC<Props> = ({ suppliers, lang }) => {
  const active = suppliers.filter(s => !s.deletedAt);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const countries = new Set(active.map(s => s.general.countryCode || s.general.country).filter(Boolean));
  const topRated = [...active].sort((a, b) => supplierDisplayScore(b) - supplierDisplayScore(a)).slice(0, 5);
  const addedThisMonth = active.filter(s => s.createdAt >= monthStart).length;
  const pendingEval = active.filter(s => !s.evaluations?.length).length;
  const pendingFollow = active.filter(s =>
    s.reminders?.some(r => !r.completed && r.dueDate && r.dueDate <= now.toISOString()),
  ).length;
  const latestProposals = active
    .flatMap(s => (s.proposals || []).map(p => ({ ...p, companyName: s.companyName })))
    .sort((a, b) => new Date(b.proposalDate).getTime() - new Date(a.proposalDate).getTime())
    .slice(0, 5);
  const favorites = active.filter(s => s.flags.favorite || s.flags.pinned);

  const cards = [
    { label: lang === 'fa' ? 'کل تأمین‌کنندگان' : 'Total Suppliers', value: active.length, icon: IconGlobe, color: 'bg-slate-900 text-white' },
    { label: lang === 'fa' ? 'کشورها' : 'Countries', value: countries.size, icon: IconFlag, color: 'bg-blue-600 text-white' },
    { label: lang === 'fa' ? 'افزوده این ماه' : 'Added This Month', value: addedThisMonth, icon: IconClock, color: 'bg-emerald-600 text-white' },
    { label: lang === 'fa' ? 'در انتظار ارزیابی' : 'Pending Evaluations', value: pendingEval, icon: IconAward, color: 'bg-amber-500 text-white' },
    { label: lang === 'fa' ? 'پیگیری معوق' : 'Pending Follow-ups', value: pendingFollow, icon: IconClock, color: 'bg-rose-500 text-white' },
    { label: lang === 'fa' ? 'مورد علاقه' : 'Favorites', value: favorites.length, icon: IconStar, color: 'bg-violet-600 text-white' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>
              <c.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-gray-900">{c.value}</div>
            <div className="text-[11px] font-bold text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
            <IconAward className="w-4 h-4 text-amber-500" />
            {lang === 'fa' ? 'برترین تأمین‌کنندگان' : 'Top Rated Suppliers'}
          </h3>
          <div className="space-y-2">
            {topRated.length === 0 && <p className="text-xs text-gray-400">{lang === 'fa' ? 'هنوز ثبت نشده' : 'No suppliers yet'}</p>}
            {topRated.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="font-bold text-gray-700 truncate">{s.companyName || '—'}</span>
                <span className="text-amber-600 font-black text-xs">{supplierDisplayScore(s)}/5</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <h3 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
            <IconFileText className="w-4 h-4 text-indigo-500" />
            {lang === 'fa' ? 'آخرین پیشنهادها' : 'Latest Proposals'}
          </h3>
          <div className="space-y-2">
            {latestProposals.length === 0 && <p className="text-xs text-gray-400">{lang === 'fa' ? 'پیشنهادی ثبت نشده' : 'No proposals yet'}</p>}
            {latestProposals.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm gap-2">
                <span className="font-bold text-gray-700 truncate">{p.title}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{p.companyName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
