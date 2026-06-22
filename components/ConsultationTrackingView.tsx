import React, { useMemo, useState } from 'react';
import type { Meeting, Personnel } from '../types';
import { Language } from '../App';
import { IconSearch } from './Icons';
import {
  getMeetingConsultantName,
  getMeetingDisplayStatus,
  getMeetingSessionLabel,
  MEETING_STATUS_STYLE,
} from '../utils/meetingBookingUtils';
import {
  canShowFollowUp,
  categoryLabel,
  findGuestByTrackingCode,
  isSessionPast,
  normalizeTrackingCodeInput,
  sortCategories,
} from '../utils/consultationTracking';
import type { ConsultantCategory } from '../types';
import { findConsultant } from '../utils/meetingBookingUtils';
import { formatMeetingDateShamsi, formatMeetingTimeRange } from '../utils/persianDate';

interface Props {
  meetings: Meeting[];
  personnel: Personnel[];
  categories: ConsultantCategory[];
  lang: Language;
  initialCode?: string;
  onExit?: () => void;
  onBook?: () => void;
}

export const ConsultationTrackingView: React.FC<Props> = ({
  meetings, personnel, categories, lang, initialCode = '', onExit, onBook,
}) => {
  const fa = lang === 'fa';
  const [code, setCode] = useState(initialCode);
  const [searched, setSearched] = useState(!!initialCode.trim());

  const sortedCategories = useMemo(() => sortCategories(categories), [categories]);

  const lookup = useMemo(() => {
    if (!searched || !code.trim()) return null;
    return findGuestByTrackingCode(meetings, code);
  }, [meetings, code, searched]);

  const t = {
    title: fa ? 'پیگیری رزرو مشاوره' : 'Consultation booking tracking',
    subtitle: fa ? 'کد پیگیری را وارد کنید' : 'Enter your tracking code',
    placeholder: fa ? 'مثلاً CON-1234-ABCD' : 'e.g. CON-1234-ABCD',
    search: fa ? 'جستجو' : 'Search',
    notFound: fa ? 'کد پیگیری یافت نشد.' : 'Tracking code not found.',
    back: fa ? 'بازگشت' : 'Back',
    book: fa ? 'رزرو جلسه جدید' : 'Book a session',
    session: fa ? 'جلسه' : 'Session',
    consultant: fa ? 'مشاور' : 'Consultant',
    category: fa ? 'موضوع' : 'Topic',
    date: fa ? 'تاریخ و ساعت' : 'Date & time',
    status: fa ? 'وضعیت' : 'Status',
    guest: fa ? 'مهمان' : 'Guest',
    followUpTitle: fa ? 'پیشنهادات مشاور پس از جلسه' : 'Consultant recommendations',
    followUpPending: fa ? 'پس از برگزاری جلسه، مشاور پیشنهادات را اینجا منتشر می‌کند.' : 'After the session, your consultant will publish recommendations here.',
    notConfirmed: fa ? 'رزرو شما هنوز قطعی نشده — پس از تأیید مستر اطلاع‌رسانی می‌شود.' : 'Your booking is not confirmed yet — you will be notified after approval.',
    attachments: fa ? 'فایل‌های ضمیمه' : 'Attachments',
    download: fa ? 'دانلود' : 'Download',
    confirmed: fa ? 'رزرو قطعی ✓' : 'Confirmed ✓',
    pending: fa ? 'رزرو موقت' : 'Temporary booking',
    waiting: fa ? 'در انتظار تأیید' : 'Awaiting confirmation',
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCode(normalizeTrackingCodeInput(code));
    setSearched(true);
  };

  const formatDate = (ds: string) => formatMeetingDateShamsi(ds, fa);

  const renderResult = () => {
    if (!lookup) return <p className="text-center text-sm text-red-500 py-6">{t.notFound}</p>;

    const { meeting, guest } = lookup;
    const st = getMeetingDisplayStatus(meeting);
    const statusStyle = st !== 'internal' ? MEETING_STATUS_STYLE[st as 'open' | 'pending' | 'confirmed'] : null;
    const isConfirmed = meeting.confirmedGuestId === guest.id;
    const consultant = findConsultant(personnel, meeting.consultantId);
    const cat = sortedCategories.find(c => c.id === meeting.consultantCategoryId);
    const showFollowUp = canShowFollowUp(meeting, guest);
    const past = isSessionPast(meeting);

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded" dir="ltr">{guest.trackingCode}</span>
            {statusStyle && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${statusStyle.bg}`}>
                {isConfirmed ? t.confirmed : (fa ? statusStyle.labelFa : statusStyle.labelEn)}
              </span>
            )}
          </div>
          <div className="grid gap-2 text-sm">
            <div><span className="text-gray-500">{t.session}: </span><strong>{getMeetingSessionLabel(meeting, fa ? 'fa' : 'en')}</strong></div>
            <div><span className="text-gray-500">{t.consultant}: </span><strong>{getMeetingConsultantName(meeting, consultant)}</strong></div>
            {cat && <div><span className="text-gray-500">{t.category}: </span><strong>{categoryLabel(cat, fa)}</strong></div>}
            <div><span className="text-gray-500">{t.date}: </span><strong>{formatDate(meeting.date)} · {formatMeetingTimeRange(meeting.startTime, meeting.endTime, fa)}</strong></div>
            <div><span className="text-gray-500">{t.guest}: </span><strong>{guest.name}</strong> <span dir="ltr" className="text-gray-600">({guest.phone})</span></div>
          </div>
          {!isConfirmed && st === 'pending' && (
            <p className="text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">{t.notConfirmed}</p>
          )}
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
          <h3 className="text-sm font-black text-violet-900 mb-3">{t.followUpTitle}</h3>
          {showFollowUp && meeting.followUp ? (
            <div className="space-y-3">
              {meeting.followUp.recommendations && (
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-white rounded-xl p-4 border border-violet-100">
                  {meeting.followUp.recommendations}
                </div>
              )}
              {(meeting.followUp.attachments?.length || 0) > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-600 mb-2">{t.attachments}</p>
                  <div className="space-y-2">
                    {meeting.followUp.attachments!.map(f => (
                      <a
                        key={f.id}
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 text-sm text-violet-700 hover:bg-violet-50"
                      >
                        📎 {f.name || t.download}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {!past && isConfirmed ? t.followUpPending : (!isConfirmed ? t.waiting : t.followUpPending)}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white" dir={fa ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto mb-3">
            <IconSearch className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-gray-900">{t.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            dir="ltr"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-violet-400"
            placeholder={t.placeholder}
            value={code}
            onChange={e => { setCode(e.target.value); setSearched(false); }}
          />
          <button type="submit" className="px-5 py-3 rounded-xl bg-violet-600 text-white font-bold text-sm shrink-0">{t.search}</button>
        </form>

        {searched && renderResult()}

        <div className="flex justify-center gap-3 pt-4">
          {onBook && (
            <button type="button" onClick={onBook} className="text-sm text-violet-600 font-semibold hover:underline">{t.book}</button>
          )}
          {onExit && (
            <button type="button" onClick={onExit} className="text-sm text-gray-500 hover:underline">{t.back}</button>
          )}
        </div>
      </div>
    </div>
  );
};
