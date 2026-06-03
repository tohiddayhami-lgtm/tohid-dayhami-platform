
import React, { useState } from 'react';
import { AnalyticsEvent } from '../types';
import { Language } from '../App';

interface Props {
  events: AnalyticsEvent[];
  lang: Language;
}

const FLAG = (code: string) => {
  try {
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
  } catch { return '🌐'; }
};

const VIEW_LABELS: Record<string, { fa: string; en: string; icon: string }> = {
  'landing':    { fa: 'صفحه اصلی',       en: 'Home',            icon: '🏠' },
  'new-ticket': { fa: 'فرم درخواست',     en: 'Request Form',    icon: '📝' },
  'tracking':   { fa: 'پیگیری درخواست',  en: 'Tracking',        icon: '🔍' },
  'news':       { fa: 'اخبار و مقالات',  en: 'News',            icon: '📰' },
  'admin':      { fa: 'پنل مدیریت',      en: 'Admin Panel',     icon: '⚙️' },
};

const getSectionLabel = (view: string, lang: Language) => {
  const entry = VIEW_LABELS[view];
  if (entry) return `${entry.icon} ${lang === 'fa' ? entry.fa : entry.en}`;
  return view || '—';
};

const BAR_COLORS = ['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500'];

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const AnalyticsDashboard: React.FC<Props> = ({ events, lang }) => {
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  const now = Date.now();
  const rangeMs: Record<string, number> = {
    today: 24 * 60 * 60 * 1000,
    week:  7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all:   Infinity,
  };
  const cutoff = now - rangeMs[range];
  const rangeEvents = events.filter(e => new Date(e.timestamp).getTime() >= cutoff);

  // Unique sessions
  const sessions = new Set(rangeEvents.map(e => e.sessionId)).size;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = events.filter(e => e.timestamp.startsWith(todayStr)).length;

  // Countries
  const countryMap = new Map<string, { count: number; code: string }>();
  for (const e of rangeEvents) {
    if (!e.country || e.country === 'Unknown') continue;
    const ex = countryMap.get(e.country) || { count: 0, code: e.countryCode };
    countryMap.set(e.country, { count: ex.count + 1, code: e.countryCode });
  }
  const topCountries = [...countryMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  const maxCountry = topCountries[0]?.[1].count || 1;

  // Sections
  const sectionMap = new Map<string, number>();
  for (const e of rangeEvents) sectionMap.set(e.view, (sectionMap.get(e.view) || 0) + 1);
  const topSections = [...sectionMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxSection = topSections[0]?.[1] || 1;

  // Devices
  const devices = { mobile: 0, tablet: 0, desktop: 0 };
  for (const e of rangeEvents) devices[e.device] = (devices[e.device] || 0) + 1;
  const totalDev = rangeEvents.length || 1;

  // Hourly chart (today)
  const hourly = Array(24).fill(0);
  events.filter(e => e.timestamp.startsWith(todayStr)).forEach(e => {
    hourly[new Date(e.timestamp).getHours()]++;
  });
  const maxHourly = Math.max(...hourly, 1);

  // Referrers
  const refMap = new Map<string, number>();
  for (const e of rangeEvents) {
    const r = e.referrer || 'direct';
    refMap.set(r, (refMap.get(r) || 0) + 1);
  }
  const topRef = [...refMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const RANGES = [
    { key: 'today', fa: 'امروز', en: 'Today' },
    { key: 'week',  fa: 'هفت روز',  en: '7 Days' },
    { key: 'month', fa: 'سی روز', en: '30 Days' },
    { key: 'all',   fa: 'همه',   en: 'All Time' },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header + Range Filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{lang === 'fa' ? 'آمار بازدید وبسایت' : 'Website Analytics'}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{lang === 'fa' ? 'داده‌های واقعی بازدیدکنندگان' : 'Real visitor data'}</p>
        </div>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${range === r.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {lang === 'fa' ? r.fa : r.en}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: lang === 'fa' ? 'بازدید امروز' : "Today's Views",   value: todayCount,          color: 'text-indigo-600' },
          { label: lang === 'fa' ? 'کل بازدید' : 'Total Views',         value: rangeEvents.length,  color: 'text-gray-900' },
          { label: lang === 'fa' ? 'نشست یکتا' : 'Unique Sessions',     value: sessions,            color: 'text-emerald-600' },
          { label: lang === 'fa' ? 'کشور' : 'Countries',                value: countryMap.size,     color: 'text-blue-600' },
        ].map((m, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-[11px] text-gray-400 mb-1">{m.label}</p>
            <p className={`text-2xl font-bold ${m.color}`}>{m.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Hourly Chart */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">{lang === 'fa' ? 'نمودار ساعتی امروز' : 'Hourly Chart (Today)'}</p>
        <div className="flex items-end gap-0.5 h-20">
          {hourly.map((v, h) => (
            <div key={h} className="flex-1 flex flex-col items-center gap-0.5 group">
              <div
                className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                style={{ height: `${Math.max(2, (v / maxHourly) * 72)}px` }}
                title={`${h}:00 — ${v} بازدید`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-gray-300 mt-1">
          {[0,6,12,18,23].map(h => <span key={h}>{String(h).padStart(2,'0')}:00</span>)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Top Countries */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">{lang === 'fa' ? 'کشورهای بازدیدکننده' : 'Top Countries'}</p>
          {topCountries.length === 0
            ? <p className="text-xs text-gray-400">{lang === 'fa' ? 'داده‌ای موجود نیست' : 'No data yet'}</p>
            : <div className="space-y-2.5">
                {topCountries.map(([country, { count, code }], i) => (
                  <div key={country}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm flex items-center gap-1.5">
                        <span className="text-base">{FLAG(code)}</span>
                        <span className="text-gray-700">{country}</span>
                      </span>
                      <span className="text-xs font-semibold text-gray-500">{count}</span>
                    </div>
                    <Bar value={count} max={maxCountry} color={BAR_COLORS[i % BAR_COLORS.length]} />
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Top Sections */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">{lang === 'fa' ? 'پربازدیدترین بخش‌ها' : 'Most Visited Sections'}</p>
          {topSections.length === 0
            ? <p className="text-xs text-gray-400">{lang === 'fa' ? 'داده‌ای موجود نیست' : 'No data yet'}</p>
            : <div className="space-y-3">
                {topSections.map(([view, count], i) => (
                  <div key={view || i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800">{getSectionLabel(view, lang)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{Math.round((count / rangeEvents.length) * 100)}%</span>
                        <span className="text-sm font-bold text-gray-700">{count}</span>
                      </div>
                    </div>
                    <Bar value={count} max={maxSection} color={BAR_COLORS[i % BAR_COLORS.length]} />
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Devices */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">{lang === 'fa' ? 'نوع دستگاه' : 'Device Types'}</p>
          <div className="space-y-2.5">
            {([['mobile','موبایل','📱'],['desktop','دسکتاپ','🖥'],['tablet','تبلت','📲']] as const).map(([key, fa, icon]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{icon} {lang === 'fa' ? fa : key}</span>
                  <span className="text-xs font-semibold text-gray-500">
                    {devices[key]} ({Math.round((devices[key] / totalDev) * 100)}%)
                  </span>
                </div>
                <Bar value={devices[key]} max={totalDev} color={key === 'mobile' ? 'bg-indigo-500' : key === 'desktop' ? 'bg-emerald-500' : 'bg-amber-500'} />
              </div>
            ))}
          </div>
        </div>

        {/* Referrers */}
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">{lang === 'fa' ? 'منبع ورود' : 'Traffic Sources'}</p>
          {topRef.length === 0
            ? <p className="text-xs text-gray-400">{lang === 'fa' ? 'داده‌ای موجود نیست' : 'No data yet'}</p>
            : <div className="space-y-2">
                {topRef.map(([ref, count]) => (
                  <div key={ref} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-700 truncate max-w-[60%]">{ref === 'direct' ? (lang === 'fa' ? 'مستقیم' : 'Direct') : ref}</span>
                    <span className="text-xs font-semibold text-gray-500">{count}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* Recent Visits */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 mb-3">{lang === 'fa' ? 'آخرین بازدیدها' : 'Recent Visits'}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-start pb-2 font-medium">{lang === 'fa' ? 'زمان' : 'Time'}</th>
                <th className="text-start pb-2 font-medium">{lang === 'fa' ? 'کشور' : 'Country'}</th>
                <th className="text-start pb-2 font-medium">{lang === 'fa' ? 'بخش' : 'Section'}</th>
                <th className="text-start pb-2 font-medium">{lang === 'fa' ? 'دستگاه' : 'Device'}</th>
                <th className="text-start pb-2 font-medium">{lang === 'fa' ? 'منبع' : 'Source'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rangeEvents.slice(0, 20).map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="py-1.5 text-gray-500 whitespace-nowrap" dir="ltr">
                    {new Date(e.timestamp).toLocaleString('fa-IR', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-1.5"><span className="me-1">{FLAG(e.countryCode)}</span>{e.country}</td>
                  <td className="py-1.5 text-gray-700">{getSectionLabel(e.view, lang)}{e.articleSlug ? ` — ${e.articleSlug.slice(0, 20)}` : ''}</td>
                  <td className="py-1.5 text-gray-500">{e.device}</td>
                  <td className="py-1.5 text-gray-500">{e.referrer === 'direct' ? (lang === 'fa' ? 'مستقیم' : 'Direct') : e.referrer}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rangeEvents.length === 0 && (
            <p className="text-center py-8 text-xs text-gray-400">{lang === 'fa' ? 'هنوز داده‌ای ثبت نشده' : 'No data recorded yet'}</p>
          )}
        </div>
      </div>
    </div>
  );
};
