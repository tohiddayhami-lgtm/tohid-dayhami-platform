import React, { useMemo, useState } from 'react';
import type { ConsultantCategory, Meeting, Personnel } from '../types';
import { Language } from '../App';
import { IconCalendarClock, IconCopy, IconSearch } from './Icons';
import { MeetingBookingModal } from './MeetingBookingModal';
import { ConsultantAvatar } from './ConsultantAvatar';
import { ConsultantPublicCard } from './ConsultantPublicCard';
import {
  MEETING_STATUS_STYLE,
  canPublicBookMeeting,
  collectMeetingConsultantProfiles,
  countOpenSlotsForProfile,
  filterPublicBookableMeetingsByCategory,
  findConsultant,
  getMeetingConsultantName,
  getMeetingConsultantPhoto,
  getMeetingDisplayStatus,
  getMeetingSessionAgenda,
  getMeetingSessionLabel,
  groupMeetingsByCategory,
  meetingPrices,
} from '../utils/meetingBookingUtils';
import { formatPriceAmount } from '../utils/servicePriceList';
import { categoryLabel, sortCategories } from '../utils/consultationTracking';
import { formatMeetingDateShamsi, formatMeetingTimeRange, toPersianDigits } from '../utils/persianDate';

interface Props {
  meetings: Meeting[];
  personnel: Personnel[];
  categories: ConsultantCategory[];
  lang: Language;
  consultantId?: string | null;
  onConsultantChange?: (id: string | null) => void;
  onOpenTracking?: (code?: string) => void;
  onExit?: () => void;
}

export const PublicMeetingBookingView: React.FC<Props> = ({
  meetings, personnel, categories, lang, consultantId, onConsultantChange, onOpenTracking, onExit,
}) => {
  const fa = lang === 'fa';
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [bookingMeeting, setBookingMeeting] = useState<Meeting | null>(null);
  const [copied, setCopied] = useState(false);

  const sortedCategories = useMemo(() => sortCategories(categories), [categories]);
  const todayStr = new Date().toISOString().slice(0, 10);

  const visibleMeetings = useMemo(
    () => filterPublicBookableMeetingsByCategory(meetings, categoryFilter, consultantId)
      .filter(m => m.date >= todayStr),
    [meetings, categoryFilter, consultantId, todayStr],
  );

  const grouped = useMemo(
    () => groupMeetingsByCategory(visibleMeetings, sortedCategories),
    [visibleMeetings, sortedCategories],
  );

  const bookableMeetings = useMemo(
    () => meetings.filter(m => m.kind === 'bookable'),
    [meetings],
  );

  const consultantProfiles = useMemo(
    () => collectMeetingConsultantProfiles(
      filterPublicBookableMeetingsByCategory(meetings, categoryFilter),
      personnel,
      meetings,
    ),
    [meetings, categoryFilter, personnel],
  );

  const profilesWithSlots = useMemo(
    () => consultantProfiles.map(p => ({
      ...p,
      openSlots: countOpenSlotsForProfile(bookableMeetings, p, todayStr),
    })),
    [consultantProfiles, bookableMeetings, todayStr],
  );

  const selectedProfile = useMemo(
    () => profilesWithSlots.find(p => p.id === consultantId) || null,
    [profilesWithSlots, consultantId],
  );

  const consultantSessions = useMemo(() => {
    if (!consultantId) return [];
    return filterPublicBookableMeetingsByCategory(meetings, categoryFilter, consultantId)
      .filter(m => m.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
  }, [meetings, categoryFilter, consultantId, todayStr]);

  const slotStats = useMemo(() => {
    let open = 0, pending = 0, confirmed = 0, totalRequests = 0;
    for (const m of visibleMeetings) {
      const st = getMeetingDisplayStatus(m);
      if (st === 'open') open += 1;
      else if (st === 'pending') { pending += 1; totalRequests += m.guests?.length || 0; }
      else if (st === 'confirmed') confirmed += 1;
    }
    return { open, pending, confirmed, totalRequests, total: visibleMeetings.length };
  }, [visibleMeetings]);

  const t = {
    title: fa ? 'رزرو جلسه مشاوره' : 'Book a consultation',
    subtitle: fa ? 'زمان‌های باز را انتخاب کنید — لیست خطی بر اساس موضوع' : 'Pick an open slot — linear list by topic',
    consultant: fa ? 'مشاور' : 'Consultant',
    allConsultants: fa ? 'همه مشاوران' : 'All consultants',
    allCategories: fa ? 'همه موضوعات' : 'All topics',
    copyLink: fa ? 'کپی لینک' : 'Copy link',
    copied: fa ? 'کپی شد ✓' : 'Copied ✓',
    back: fa ? 'بازگشت' : 'Back',
    track: fa ? 'پیگیری رزرو' : 'Track booking',
    noSlots: fa ? 'زمان قابل رزروی ثبت نشده است.' : 'No bookable slots available.',
    guests: fa ? 'رزرو موقت' : 'temp. bookings',
    statsOpen: fa ? 'زمان باز' : 'Open',
    statsPending: fa ? 'رزرو موقت' : 'Temporary',
    statsConfirmed: fa ? 'رزرو قطعی' : 'Confirmed',
    bookNow: fa ? 'رزرو' : 'Book',
    full: fa ? 'پر شده' : 'Full',
    consultantsTitle: fa ? 'مشاوران' : 'Consultants',
    pickConsultant: fa ? 'یک مشاور را انتخاب کنید' : 'Choose a consultant',
    openSlots: (n: number) => fa ? `${toPersianDigits(n)} زمان باز` : `${n} open`,
    uncategorized: fa ? 'سایر مشاوره‌ها' : 'Other consultations',
    sessionsTitle: fa ? 'جلسات قابل رزرو' : 'Available sessions',
    sessionAgendaTitle: fa ? 'سرفصل جلسات' : 'Session topics',
    sessionAgendaLabel: fa ? 'سرفصل' : 'Agenda',
    pendingCount: (n: number) => fa ? `${toPersianDigits(n)} رزرو موقت` : `${n} temporary booking${n === 1 ? '' : 's'}`,
    selectConsultant: fa ? 'انتخاب' : 'Select',
  };

  const copyPageLink = async () => {
    try {
      const url = new URL(window.location.href);
      if (consultantId) url.searchParams.set('consultant', consultantId);
      else url.searchParams.delete('consultant');
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const renderSessionRow = (meeting: Meeting) => {
    const status = getMeetingDisplayStatus(meeting) as 'open' | 'pending' | 'confirmed';
    const style = MEETING_STATUS_STYLE[status];
    const bookable = canPublicBookMeeting(meeting);
    const guestCount = meeting.guests?.length || 0;
    const sessionLabel = getMeetingSessionLabel(meeting, fa ? 'fa' : 'en');
    const consultantPerson = findConsultant(personnel, meeting.consultantId);
    const consultantName = getMeetingConsultantName(meeting, consultantPerson);
    const consultantPhoto = getMeetingConsultantPhoto(meeting, consultantPerson);
    const sessionAgenda = getMeetingSessionAgenda(meeting);
    const prices = meetingPrices(meeting);

    return (
      <div
        key={meeting.id}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border-2 transition-shadow ${
          status === 'open' ? 'border-emerald-200 bg-emerald-50/40'
            : status === 'pending' ? 'border-orange-200 bg-orange-50/40'
            : 'border-red-200 bg-red-50/30'
        }`}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <ConsultantAvatar name={consultantName} avatarUrl={consultantPhoto} size="md" ring />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${style.bg}`}>
                {fa ? style.labelFa : style.labelEn}
              </span>
              {guestCount > 0 && status !== 'confirmed' && (
                <span className="text-[11px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                  👥 {t.pendingCount(guestCount)}
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-sm">{sessionLabel}</h3>
            {consultantName && !consultantId && <p className="text-xs text-gray-600 mt-0.5">{consultantName}</p>}
            <p className="text-xs text-gray-700 mt-1 leading-relaxed">
              {formatMeetingDateShamsi(meeting.date, fa)}
            </p>
            <p className="text-xs text-violet-800 font-semibold mt-0.5">
              {formatMeetingTimeRange(meeting.startTime, meeting.endTime, fa)}
            </p>
            {sessionAgenda && (
              <div className="mt-2 text-[11px] text-gray-600 bg-white/80 rounded-lg px-2.5 py-2 border border-violet-100">
                <span className="font-bold text-violet-700">{t.sessionAgendaLabel}: </span>
                <span className="whitespace-pre-wrap">{sessionAgenda}</span>
              </div>
            )}
            {prices.length > 0 && (
              <p className="text-xs text-emerald-700 font-semibold mt-1">
                {prices.map(p => formatPriceAmount(p.amount, p.currency, lang)).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 sm:w-28">
          {bookable ? (
            <button
              type="button"
              onClick={() => setBookingMeeting(meeting)}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-md"
            >
              {t.bookNow}
            </button>
          ) : (
            <div className="w-full py-2.5 rounded-xl bg-gray-100 text-red-600 text-sm font-bold text-center">{t.full}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white" dir={fa ? 'rtl' : 'ltr'}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl">
              <IconCalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">{t.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{t.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenTracking?.()} className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 flex items-center gap-1.5 shadow-sm">
              <IconSearch className="w-4 h-4" />{t.track}
            </button>
            <button type="button" onClick={copyPageLink} className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm">
              {copied ? t.copied : <><IconCopy className="w-4 h-4" />{t.copyLink}</>}
            </button>
            {onExit && (
              <button type="button" onClick={onExit} className="px-3 py-2 rounded-lg text-sm font-medium text-violet-700 hover:bg-violet-50">{t.back}</button>
            )}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              !categoryFilter ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
            }`}
          >
            {t.allCategories}
          </button>
          {sortedCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
                categoryFilter === cat.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
              }`}
            >
              {cat.icon ? `${cat.icon} ` : ''}{categoryLabel(cat, fa)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
          <label className="text-sm font-semibold text-gray-600">{t.consultant}:</label>
          <select
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm min-w-[160px] outline-none focus:ring-2 focus:ring-violet-400"
            value={consultantId || ''}
            onChange={e => onConsultantChange?.(e.target.value || null)}
          >
            <option value="">{t.allConsultants}</option>
            {consultantProfiles.filter(p => p.id).map(c => (
              <option key={c.key} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 mr-auto text-[11px]">
            <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">{t.statsOpen}: {fa ? toPersianDigits(slotStats.open) : slotStats.open}</span>
            <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-800 font-bold">{t.statsPending}: {fa ? toPersianDigits(slotStats.pending) : slotStats.pending}</span>
            <span className="px-2 py-1 rounded-lg bg-red-100 text-red-800 font-bold">{t.statsConfirmed}: {fa ? toPersianDigits(slotStats.confirmed) : slotStats.confirmed}</span>
          </div>
        </div>

        {/* Consultant detail + session agendas */}
        {consultantId && selectedProfile && (
          <div className="bg-white rounded-2xl border border-violet-100 shadow-md overflow-hidden">
            <div className="flex flex-col md:flex-row gap-0 md:gap-5">
              <div className="md:w-52 lg:w-56 shrink-0 p-4 md:p-5 md:pr-0 flex justify-center md:block">
                <ConsultantPublicCard
                  profile={selectedProfile}
                  fa={fa}
                  selected
                  openSlots={selectedProfile.openSlots || 0}
                  className="max-w-[220px] md:max-w-none mx-auto pointer-events-none"
                />
              </div>
              <div className="flex-1 min-w-0 p-4 sm:p-5 md:pr-5 border-b md:border-b-0 border-violet-50">
                <h3 className="text-lg font-black text-gray-900 text-center md:text-right">{selectedProfile.name}</h3>
                {selectedProfile.bio && (
                  <div className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-3 border border-gray-100 text-right max-h-48 overflow-y-auto">
                    {selectedProfile.bio}
                  </div>
                )}
              </div>
            </div>
            {consultantSessions.length > 0 ? (
              <div className="p-4 sm:p-5 bg-violet-50/40">
                <h4 className="text-sm font-black text-violet-900 mb-3">{t.sessionAgendaTitle}</h4>
                <div className="space-y-3">
                  {consultantSessions.map(m => {
                    const agenda = getMeetingSessionAgenda(m);
                    const label = getMeetingSessionLabel(m, fa ? 'fa' : 'en');
                    const st = getMeetingDisplayStatus(m);
                    const bookable = canPublicBookMeeting(m);
                    return (
                      <div key={m.id} className="bg-white rounded-xl border border-violet-100 p-3 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-sm">{label}</p>
                            <p className="text-xs text-gray-700 mt-1">{formatMeetingDateShamsi(m.date, fa)}</p>
                            <p className="text-xs text-violet-800 font-semibold">{formatMeetingTimeRange(m.startTime, m.endTime, fa)}</p>
                            {agenda ? (
                              <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">
                                <span className="font-bold text-violet-700">{t.sessionAgendaLabel}: </span>
                                {agenda}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 mt-2 italic">{fa ? 'سرفصل ثبت نشده' : 'No agenda yet'}</p>
                            )}
                          </div>
                          {bookable && st !== 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => setBookingMeeting(m)}
                              className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700"
                            >
                              {t.bookNow}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="p-4 sm:p-5 text-sm text-gray-400 text-center">{t.noSlots}</p>
            )}
          </div>
        )}

        {profilesWithSlots.length > 0 && !consultantId && (
          <div className="space-y-3">
            <h2 className="text-sm font-black text-gray-800">{t.consultantsTitle}</h2>
            <p className="text-xs text-gray-500">{t.pickConsultant}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {profilesWithSlots.map(c => (
                <ConsultantPublicCard
                  key={c.key}
                  profile={c}
                  fa={fa}
                  openSlots={c.openSlots || 0}
                  onClick={() => c.id && onConsultantChange?.(c.id)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {!consultantId && (
            <>
              <h2 className="text-sm font-bold text-gray-800">{t.sessionsTitle}</h2>
              {grouped.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">{t.noSlots}</p>
              ) : (
                grouped.map(({ category, meetings: groupMeetings }) => (
                  <div key={category?.id || 'none'} className="space-y-3">
                    <h3 className="text-xs font-black text-violet-700 uppercase tracking-wide px-1">
                      {category ? categoryLabel(category, fa) : t.uncategorized}
                    </h3>
                    <div className="space-y-2">
                      {groupMeetings.map(renderSessionRow)}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      <MeetingBookingModal
        open={!!bookingMeeting}
        meeting={bookingMeeting}
        consultant={bookingMeeting ? findConsultant(personnel, bookingMeeting.consultantId) : undefined}
        lang={lang}
        onClose={() => setBookingMeeting(null)}
        onBooked={() => {}}
        onOpenTracking={onOpenTracking}
      />
    </div>
  );
};
