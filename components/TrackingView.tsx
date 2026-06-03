
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

  // Translations
  const t = {
    fa: {
      title: 'پیگیری وضعیت درخواست صادراتی',
      placeholder: 'شماره پیگیری (مثال: EXP-4829)',
      notFound: 'درخواستی با این شماره یافت نشد.',
      statusTitle: 'وضعیت پرونده',
      number: 'شماره:',
      applicant: 'متقاضی',
      service: 'سرویس انتخابی',
      date: 'تاریخ ثبت',
      priority: 'اولویت سیستمی',
      files: 'فایل‌های پیوست شده:',
      steps: [
        'ثبت درخواست و مدارک',
        'ارزیابی اولیه و تحلیل',
        'ارجاع به کارشناس / اجرا',
        'تکمیل و تحویل خدمت'
      ],
      currentStep: 'پرونده شما در این مرحله قرار دارد.',
      completedStep: 'این مرحله انجام شده است.',
      pendingStep: 'در انتظار اقدام...',
      historyTitle: 'جزئیات عملیات و مکاتبات پرونده',
      historyEmpty: 'هنوز جزئیاتی ثبت نشده است.'
    },
    en: {
      title: 'Track Export Application Status',
      placeholder: 'Tracking ID (e.g., EXP-4829)',
      notFound: 'No application found with this ID.',
      statusTitle: 'Case Status',
      number: 'ID:',
      applicant: 'Applicant',
      service: 'Service',
      date: 'Date',
      priority: 'Priority',
      files: 'Attached Files:',
      steps: [
        'Request & Docs Submitted',
        'Initial Analysis',
        'Expert Assignment / Processing',
        'Completed & Delivered'
      ],
      currentStep: 'Your case is currently at this stage.',
      completedStep: 'This stage is completed.',
      pendingStep: 'Pending action...',
      historyTitle: 'Case History & Correspondence',
      historyEmpty: 'No details recorded yet.'
    }
  }[lang];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSearch = searchId.trim();
    // Case insensitive search
    const ticket = tickets.find(t => 
        t.id.toLowerCase() === cleanSearch.toLowerCase() || 
        t.id.toLowerCase() === `exp-${cleanSearch.toLowerCase()}`
    );
    
    if (ticket) {
      setFoundTicket(ticket);
      setError('');
    } else {
      setFoundTicket(null);
      setError(t.notFound);
    }
  };

  const getStepStatus = (step: TicketStatus, current: TicketStatus) => {
    const order = [TicketStatus.SUBMITTED, TicketStatus.PROCESSING, TicketStatus.IN_PROGRESS, TicketStatus.COMPLETED];
    const currentIndex = order.indexOf(current);
    const stepIndex = order.indexOf(step);

    if (current === TicketStatus.CANCELLED) return 'cancelled';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.title}</h2>
        <form onSubmit={handleSearch} className="max-w-md mx-auto relative">
          <input 
            type="text" 
            placeholder={t.placeholder}
            className="w-full ltr:pr-4 ltr:pl-12 rtl:pl-12 rtl:pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-0 text-lg outline-none transition-colors dir-ltr text-center font-mono"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button type="submit" className="absolute rtl:left-2 ltr:right-2 top-2 bottom-2 bg-indigo-600 text-white px-6 rounded-lg hover:bg-indigo-700 transition-colors flex items-center">
            <IconSearch className="w-5 h-5" />
          </button>
        </form>
        {error && <p className="text-red-500 mt-4 bg-red-50 py-2 px-4 rounded-lg inline-block">{error}</p>}
      </div>

      {foundTicket && (
        <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold">{t.statusTitle}</h3>
                        <p className="opacity-90 mt-1 font-mono">{t.number} {foundTicket.id}</p>
                    </div>
                    <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-medium border border-white/30">
                    {foundTicket.status}
                    </span>
                </div>
                
                <div className="p-8">
                    <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500 block">{t.applicant}</span>
                            <span className="font-semibold text-gray-800">{foundTicket.customerName}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">{t.service}</span>
                            <span className="font-semibold text-gray-800">
                                {lang === 'en' && services.find(s => s.id === foundTicket.serviceId)?.titleEn 
                                ? services.find(s => s.id === foundTicket.serviceId)?.titleEn 
                                : services.find(s => s.id === foundTicket.serviceId)?.title}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">{t.date}</span>
                            <span className="font-semibold text-gray-800 dir-ltr">
                                {new Date(foundTicket.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-500 block">{t.priority}</span>
                            <span className={`font-semibold ${foundTicket.priority === 'High' ? 'text-red-600' : 'text-gray-800'}`}>
                                {foundTicket.priority || 'Normal'}
                            </span>
                        </div>
                    </div>
                    
                    {/* File Attachments */}
                    {foundTicket.files && foundTicket.files.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <span className="text-gray-500 block text-sm mb-2">{t.files}</span>
                            <div className="flex flex-wrap gap-2">
                            {foundTicket.files.map((file, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm">
                                    <IconFile className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xs font-medium text-gray-700 max-w-[150px] truncate">{file.name}</span>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                    </div>

                    {/* Progress Bar Steps */}
                    <div className="relative mb-8">
                        <div className="space-y-8">
                            {[
                                { s: TicketStatus.SUBMITTED },
                                { s: TicketStatus.PROCESSING },
                                { s: TicketStatus.IN_PROGRESS },
                                { s: TicketStatus.COMPLETED }
                            ].map((step, idx, arr) => {
                                const status = getStepStatus(step.s, foundTicket.status);
                                const isCompleted = status === 'completed';
                                const isCurrent = status === 'current';
                                const isPending = status === 'pending';

                                return (
                                <div key={idx} className="flex items-start gap-4 relative">
                                    {idx !== arr.length - 1 && (
                                        <div className={`absolute top-8 rtl:right-4 ltr:left-4 w-0.5 h-full -z-10 ${isCompleted ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                                    )}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 z-10 
                                        ${isCompleted || isCurrent ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-300'}`}>
                                        {isCompleted ? <IconCheck className="w-4 h-4" /> : (isCurrent ? <IconClock className="w-4 h-4 animate-pulse" /> : <div className="w-2 h-2 bg-gray-200 rounded-full" />)}
                                    </div>
                                    <div className={`pt-1 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                                        <h4 className={`font-bold ${isCurrent ? 'text-indigo-600' : 'text-gray-800'}`}>{t.steps[idx]}</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {isCurrent && t.currentStep}
                                            {isCompleted && t.completedStep}
                                            {isPending && t.pendingStep}
                                        </p>
                                    </div>
                                </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed History Timeline */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                 <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                     <IconActivity className="w-5 h-5 text-indigo-600" />
                     <h3 className="font-bold text-gray-800">{t.historyTitle}</h3>
                 </div>
                 <div className="p-6">
                    {/* Hide Internal Notes from Customer */}
                    {(!foundTicket.timeline || foundTicket.timeline.filter(e => e.visibility !== 'internal').length === 0) && (
                        <p className="text-center text-gray-400 py-4">{t.historyEmpty}</p>
                    )}
                    <div className="space-y-6">
                        {foundTicket.timeline?.filter(e => e.visibility !== 'internal').map((entry, idx) => (
                            <div key={idx} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className={`w-3 h-3 rounded-full mt-1.5 ring-4 ring-gray-50 ${
                                        entry.type === 'creation' ? 'bg-green-500' : 'bg-indigo-500'
                                    }`}></div>
                                    {idx !== (foundTicket.timeline?.length || 0) - 1 && (
                                        <div className="w-0.5 flex-grow bg-gray-200 my-1"></div>
                                    )}
                                </div>
                                <div className="pb-2">
                                    <div className="text-xs text-gray-400 mb-1 dir-ltr text-right">
                                        {new Date(entry.timestamp).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-sm">
                                        <div className="font-bold text-gray-800 mb-1">{entry.title}</div>
                                        {entry.description && (
                                            <div className="text-gray-600 leading-relaxed">{entry.description}</div>
                                        )}
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
