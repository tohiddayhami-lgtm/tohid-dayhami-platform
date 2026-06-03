
import React, { useState } from 'react';
import { Ticket, TicketStatus, ServiceOption } from '../types';
import { IconSearch, IconCheck, IconClock, IconFile, IconActivity } from './Icons';
import { Language } from '../App';

interface Props {
  tickets: Ticket[];
  services: ServiceOption[];
  lang: Language;
}

export const TrackingView: React.FC<Props> = ({ tickets, services, lang }) => {
  const [searchId, setSearchId] = useState('');
  const [foundTicket, setFoundTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState('');

  const t = {
    fa: {
      title: 'پیگیری وضعیت درخواست',
      placeholder: 'کد رهگیری — مثال: EXP-4829',
      search: 'جستجو',
      notFound: 'درخواستی با این کد یافت نشد.',
      statusTitle: 'وضعیت پرونده',
      number: 'شماره پرونده',
      applicant: 'متقاضی',
      service: 'سرویس',
      date: 'تاریخ ثبت',
      priority: 'اولویت',
      files: 'فایل‌های پیوست',
      steps: ['ثبت درخواست', 'ارزیابی اولیه', 'در دست اقدام', 'تکمیل شد'],
      currentStep: 'پرونده در این مرحله است.',
      completedStep: 'انجام شد.',
      pendingStep: 'در انتظار...',
      historyTitle: 'تاریخچه پرونده',
      historyEmpty: 'هنوز رویدادی ثبت نشده است.'
    },
    en: {
      title: 'Track Your Request',
      placeholder: 'Tracking ID — e.g. EXP-4829',
      search: 'Search',
      notFound: 'No application found with this ID.',
      statusTitle: 'Case Status',
      number: 'Case ID',
      applicant: 'Applicant',
      service: 'Service',
      date: 'Date',
      priority: 'Priority',
      files: 'Attachments',
      steps: ['Submitted', 'Under Review', 'In Progress', 'Completed'],
      currentStep: 'Your case is at this stage.',
      completedStep: 'Done.',
      pendingStep: 'Pending...',
      historyTitle: 'Case History',
      historyEmpty: 'No events recorded yet.'
    }
  }[lang];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchId.trim();
    const ticket = tickets.find(t =>
      t.id.toLowerCase() === clean.toLowerCase() ||
      t.id.toLowerCase() === `exp-${clean.toLowerCase()}`
    );
    if (ticket) { setFoundTicket(ticket); setError(''); }
    else { setFoundTicket(null); setError(t.notFound); }
  };

  const getStepStatus = (step: TicketStatus, current: TicketStatus) => {
    const order = [TicketStatus.SUBMITTED, TicketStatus.PROCESSING, TicketStatus.IN_PROGRESS, TicketStatus.COMPLETED];
    const ci = order.indexOf(current), si = order.indexOf(step);
    if (current === TicketStatus.CANCELLED) return 'cancelled';
    if (si < ci) return 'completed';
    if (si === ci) return 'current';
    return 'pending';
  };

  const serviceTitle = (id: string) => {
    const s = services.find(s => s.id === id);
    return lang === 'en' && s?.titleEn ? s.titleEn : (s?.title || id);
  };

  return (
    <div className="max-w-2xl mx-auto pb-16 animate-fade-in">

      {/* Search */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">{t.title}</h2>
        <p className="text-sm text-gray-400 mb-5">{lang === 'fa' ? 'کد رهگیری را که هنگام ثبت دریافت کردید وارد کنید.' : 'Enter the tracking ID you received when submitting your request.'}</p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder={t.placeholder}
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-colors dir-ltr"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black transition-colors flex items-center gap-1.5">
            <IconSearch className="w-4 h-4" />
            {t.search}
          </button>
        </form>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      </div>

      {foundTicket && (
        <div className="space-y-4 animate-fade-in">

          {/* Info Card */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{t.number}</p>
                <p className="font-mono text-sm font-semibold text-gray-900">{foundTicket.id}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border
                ${foundTicket.status === TicketStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-200' :
                  foundTicket.status === TicketStatus.CANCELLED ? 'bg-red-50 text-red-600 border-red-200' :
                  'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {foundTicket.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-100 rtl:divide-x-reverse">
              {[
                { label: t.applicant, value: foundTicket.customerName },
                { label: t.service,   value: serviceTitle(foundTicket.serviceId) },
                { label: t.date,      value: new Date(foundTicket.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') },
                { label: t.priority,  value: foundTicket.priority || 'Normal' },
              ].map((item, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="text-[11px] text-gray-400 mb-0.5">{item.label}</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Files */}
            {foundTicket.files && foundTicket.files.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100">
                <p className="text-[11px] text-gray-400 mb-2">{t.files}</p>
                <div className="flex flex-wrap gap-2">
                  {foundTicket.files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg">
                      <IconFile className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-xs text-gray-600 max-w-[140px] truncate">{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Progress Steps */}
          <div className="border border-gray-200 rounded-2xl px-5 py-5">
            <div className="space-y-5">
              {[TicketStatus.SUBMITTED, TicketStatus.PROCESSING, TicketStatus.IN_PROGRESS, TicketStatus.COMPLETED].map((step, idx, arr) => {
                const status = getStepStatus(step, foundTicket.status);
                const isCompleted = status === 'completed';
                const isCurrent = status === 'current';
                const isPending = status === 'pending';

                return (
                  <div key={idx} className="flex items-start gap-3 relative">
                    {idx !== arr.length - 1 && (
                      <div className={`absolute top-6 rtl:right-3 ltr:left-3 w-px h-full ${isCompleted ? 'bg-gray-800' : 'bg-gray-200'}`} />
                    )}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border z-10 mt-0.5
                      ${isCompleted ? 'bg-gray-900 border-gray-900' : isCurrent ? 'bg-white border-gray-900' : 'bg-white border-gray-200'}`}>
                      {isCompleted
                        ? <IconCheck className="w-3 h-3 text-white" />
                        : isCurrent
                          ? <div className="w-2 h-2 bg-gray-900 rounded-full animate-pulse" />
                          : <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />}
                    </div>
                    <div className={`pt-0.5 ${isPending ? 'opacity-40' : ''}`}>
                      <p className={`text-sm font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-700'}`}>{t.steps[idx]}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {isCurrent && t.currentStep}{isCompleted && t.completedStep}{isPending && t.pendingStep}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
              <IconActivity className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{t.historyTitle}</span>
            </div>
            <div className="px-5 py-4">
              {(!foundTicket.timeline || foundTicket.timeline.filter(e => e.visibility !== 'internal').length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">{t.historyEmpty}</p>
              )}
              <div className="space-y-4">
                {foundTicket.timeline?.filter(e => e.visibility !== 'internal').map((entry, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${entry.type === 'creation' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {idx !== (foundTicket.timeline?.length || 0) - 1 && <div className="w-px flex-grow bg-gray-100 my-1" />}
                    </div>
                    <div className="pb-2 flex-1">
                      <div className="text-[11px] text-gray-400 mb-1 dir-ltr">
                        {new Date(entry.timestamp).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                      </div>
                      <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                        <p className="text-xs font-semibold text-gray-700 mb-0.5">{entry.title}</p>
                        {entry.description && <p className="text-xs text-gray-500 leading-relaxed">{entry.description}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
