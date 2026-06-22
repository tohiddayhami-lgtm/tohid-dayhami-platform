import React, { useMemo, useRef, useState } from 'react';
import type { Meeting, Personnel } from '../types';
import { Language } from '../App';
import { IconCalendarClock, IconCopy } from './Icons';
import { MeetingBookingModal } from './MeetingBookingModal';
import { ConsultantAvatar } from './ConsultantAvatar';
import {
  MEETING_STATUS_STYLE,
  SESSION_TYPE_LABEL,
  canPublicBookMeeting,
  countConsultantOpenSlots,
  filterPublicBookableMeetings,
  findConsultant,
  getBookableConsultants,
  getMeetingDisplayStatus,
  meetingPrices,
} from '../utils/meetingBookingUtils';
import { formatPriceAmount } from '../utils/servicePriceList';

const HOUR_HEIGHT = 52;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() - 6 + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeTime(t?: string | null, fallback = '09:00'): string {
  if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) return t;
  return fallback;
}

function timeToMinutes(t?: string | null): number {
  const [h, m] = normalizeTime(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function parseDateLocal(ds: string): Date {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function sortMeetingsChronologically(list: Meeting[]): Meeting[] {
  return [...list].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return normalizeTime(a.startTime).localeCompare(normalizeTime(b.startTime));
  });
}

function formatSlotDate(ds: string, fa: boolean, getDayName: (d: Date, short?: boolean) => string): string {
  const d = parseDateLocal(ds);
  const mon = fa
    ? ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${getDayName(d)} ${d.getDate()} ${mon[d.getMonth()]}`;
}

interface SlotChip {
  meeting: Meeting;
  status: 'open' | 'pending' | 'confirmed';
  guestCount: number;
  bookable: boolean;
}

interface Props {
  meetings: Meeting[];
  personnel: Personnel[];
  lang: Language;
  consultantId?: string | null;
  onConsultantChange?: (id: string | null) => void;
  onExit?: () => void;
}

export const PublicMeetingBookingView: React.FC<Props> = ({
  meetings, personnel, lang, consultantId, onConsultantChange, onExit,
}) => {
  const fa = lang === 'fa';
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [bookingMeeting, setBookingMeeting] = useState<Meeting | null>(null);
  const [copied, setCopied] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const consultants = useMemo(() => getBookableConsultants(meetings, personnel), [meetings, personnel]);
  const visibleMeetings = useMemo(
    () => filterPublicBookableMeetings(meetings, consultantId),
    [meetings, consultantId],
  );

  const todayStr = toDateStr(new Date());
  const weekDays = getWeekDays(weekStart);

  const upcomingSlots = useMemo(() => {
    const upcoming = visibleMeetings.filter(m => m.date >= todayStr);
    return sortMeetingsChronologically(upcoming);
  }, [visibleMeetings, todayStr]);

  const slotStats = useMemo(() => {
    let open = 0, pending = 0, confirmed = 0, totalRequests = 0;
    for (const m of upcomingSlots) {
      const st = getMeetingDisplayStatus(m);
      if (st === 'open') open += 1;
      else if (st === 'pending') { pending += 1; totalRequests += m.guests?.length || 0; }
      else if (st === 'confirmed') confirmed += 1;
    }
    return { open, pending, confirmed, totalRequests, total: upcomingSlots.length };
  }, [upcomingSlots]);

  const slotChips = useMemo((): SlotChip[] =>
    upcomingSlots.map(meeting => {
      const status = getMeetingDisplayStatus(meeting) as 'open' | 'pending' | 'confirmed';
      return {
        meeting,
        status,
        guestCount: meeting.guests?.length || 0,
        bookable: canPublicBookMeeting(meeting),
      };
    }),
  [upcomingSlots]);

  const DAY_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
  const DAY_FA_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const DAY_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const MON_FA = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getDayName = (d: Date, short = false) => {
    const idx = d.getDay() === 6 ? 0 : d.getDay() + 1;
    return fa ? (short ? DAY_FA_SHORT[idx] : DAY_FA[idx]) : DAY_EN[idx];
  };

  const getWeekRange = () => {
    const s = weekDays[0], e = weekDays[6];
    const ms = fa ? MON_FA[s.getMonth()] : MON_EN[s.getMonth()];
    const me = fa ? MON_FA[e.getMonth()] : MON_EN[e.getMonth()];
    return s.getMonth() === e.getMonth()
      ? `${ms} ${s.getDate()}–${e.getDate()}`
      : `${ms} ${s.getDate()} – ${me} ${e.getDate()}`;
  };

  const t = {
    title: fa ? 'رزرو جلسه مشاوره' : 'Book a consultation',
    subtitle: fa ? 'زمان‌های باز را انتخاب کنید و اطلاعات خود را وارد نمایید' : 'Pick an open slot and enter your details',
    consultant: fa ? 'مشاور' : 'Consultant',
    allConsultants: fa ? 'همه مشاوران' : 'All consultants',
    legendOpen: fa ? 'باز — قابل رزرو' : 'Open — available',
    legendPending: fa ? 'رزرو موقت' : 'Temporary booking',
    legendConfirmed: fa ? 'رزرو قطعی' : 'Confirmed',
    copyLink: fa ? 'کپی لینک' : 'Copy link',
    copied: fa ? 'کپی شد ✓' : 'Copied ✓',
    back: fa ? 'بازگشت' : 'Back',
    noSlots: fa ? 'در این هفته زمان قابل رزروی ثبت نشده است.' : 'No bookable slots this week.',
    clickToBook: fa ? 'کلیک برای رزرو' : 'Click to book',
    guests: fa ? 'درخواست' : 'requests',
    statsOpen: fa ? 'زمان باز' : 'Open slots',
    statsPending: fa ? 'رزرو موقت' : 'Temporary',
    statsConfirmed: fa ? 'رزرو قطعی' : 'Confirmed',
    statsRequests: fa ? 'درخواست رزرو' : 'Booking requests',
    stripTitle: fa ? 'جلسات پیش‌رو' : 'Upcoming sessions',
    stripHint: fa ? 'روی هر زمان کلیک کنید و رزرو کنید' : 'Tap a slot to book',
    hurry: fa ? 'عجله کنید! ظرفیت محدود است' : 'Hurry! Limited availability',
    onlyOpen: (n: number) => fa ? `فقط ${n.toLocaleString('fa-IR')} زمان مشاوره باز مانده` : `Only ${n} open slot${n === 1 ? '' : 's'} left`,
    peopleWaiting: (n: number) => fa ? `${n.toLocaleString('fa-IR')} نفر در صف رزرو` : `${n} people in the queue`,
    bookNow: fa ? 'رزرو فوری' : 'Book now',
    full: fa ? 'پر شده' : 'Full',
    hot: fa ? 'پرطرفدار' : 'Popular',
    consultantsTitle: fa ? 'مشاوران ما' : 'Our consultants',
    resume: fa ? 'رزومه' : 'Resume',
    openSlots: (n: number) => fa ? `${n} زمان باز` : `${n} open slot${n === 1 ? '' : 's'}`,
    selectConsultant: fa ? 'انتخاب مشاور' : 'Select consultant',
    roles: fa ? 'سمت' : 'Role',
  };

  const selectedConsultant = useMemo(
    () => findConsultant(personnel, consultantId),
    [personnel, consultantId],
  );

  const displayConsultants = useMemo(() => {
    if (consultantId && selectedConsultant) return [selectedConsultant];
    return consultants;
  }, [consultantId, selectedConsultant, consultants]);

  const jumpToMeetingWeek = (m: Meeting) => {
    setWeekStart(getWeekStart(parseDateLocal(m.date)));
    if (canPublicBookMeeting(m)) setBookingMeeting(m);
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

  const statusBlockClass = (m: Meeting) => {
    const st = getMeetingDisplayStatus(m);
    if (st === 'internal') return 'bg-gray-400';
    return MEETING_STATUS_STYLE[st].bg;
  };

  const statusLabel = (m: Meeting) => {
    const st = getMeetingDisplayStatus(m);
    if (st === 'internal') return '';
    const s = MEETING_STATUS_STYLE[st];
    return fa ? s.labelFa : s.labelEn;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white" dir={fa ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
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
            <button type="button" onClick={copyPageLink} className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm">
              {copied ? t.copied : <><IconCopy className="w-4 h-4" />{t.copyLink}</>}
            </button>
            {onExit && (
              <button type="button" onClick={onExit} className="px-3 py-2 rounded-lg text-sm font-medium text-violet-700 hover:bg-violet-50">{t.back}</button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
          <label className="text-sm font-semibold text-gray-600">{t.consultant}:</label>
          <select
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm min-w-[180px] outline-none focus:ring-2 focus:ring-violet-400"
            value={consultantId || ''}
            onChange={e => onConsultantChange?.(e.target.value || null)}
          >
            <option value="">{t.allConsultants}</option>
            {consultants.map(c => (
              <option key={c.id} value={c.id}>{c.fullName}</option>
            ))}
          </select>

          <div className="flex flex-wrap gap-3 mr-auto text-xs">
            {(['open', 'pending', 'confirmed'] as const).map(st => (
              <span key={st} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${MEETING_STATUS_STYLE[st].bg}`} />
                {fa ? MEETING_STATUS_STYLE[st].labelFa : MEETING_STATUS_STYLE[st].labelEn}
              </span>
            ))}
          </div>
        </div>

        {/* ── Consultant profiles ── */}
        {displayConsultants.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-800 px-1">{t.consultantsTitle}</h2>
            {consultantId && selectedConsultant ? (
              <div className="bg-white rounded-2xl border border-violet-100 shadow-md overflow-hidden">
                <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
                  <ConsultantAvatar person={selectedConsultant} size="xl" ring className="mx-auto sm:mx-0" />
                  <div className="flex-1 min-w-0 text-center sm:text-right">
                    <h3 className="text-lg font-black text-gray-900">{selectedConsultant.fullName}</h3>
                    {(selectedConsultant.roles || []).length > 0 && (
                      <p className="text-xs text-violet-600 font-semibold mt-0.5">
                        {(selectedConsultant.roles || []).join(' · ')}
                      </p>
                    )}
                    <p className="text-xs font-bold text-emerald-600 mt-2">
                      {t.openSlots(countConsultantOpenSlots(upcomingSlots, selectedConsultant.id))}
                    </p>
                    {selectedConsultant.consultantBio ? (
                      <div className="mt-3 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-3 border border-gray-100 text-right">
                        {selectedConsultant.consultantBio}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400 italic">{fa ? 'رزومه به‌زودی تکمیل می‌شود' : 'Bio coming soon'}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 snap-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                {displayConsultants.map(c => {
                  const openCount = countConsultantOpenSlots(upcomingSlots, c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onConsultantChange?.(c.id)}
                      className="snap-start shrink-0 w-[220px] sm:w-[260px] text-right bg-white rounded-xl border border-gray-100 shadow-sm hover:border-violet-300 hover:shadow-md transition-all p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <ConsultantAvatar person={c} size="lg" ring />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-gray-900 text-sm truncate">{c.fullName}</div>
                          <div className="text-[10px] text-violet-600 font-medium truncate">{(c.roles || []).slice(0, 2).join(' · ')}</div>
                          <div className="text-[10px] text-emerald-600 font-bold mt-0.5">{t.openSlots(openCount)}</div>
                        </div>
                      </div>
                      {c.consultantBio ? (
                        <p className="text-[11px] text-gray-500 line-clamp-3 leading-relaxed">{c.consultantBio}</p>
                      ) : null}
                      <span className="text-[10px] font-bold text-violet-600 mt-auto">{t.selectConsultant} →</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Stats + urgency banner ── */}
        {slotStats.total > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-3 shadow-md shadow-emerald-200/50">
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{slotStats.open.toLocaleString(fa ? 'fa-IR' : 'en-US')}</div>
                <div className="text-[11px] sm:text-xs font-semibold opacity-90 mt-0.5">{t.statsOpen}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white p-3 shadow-md shadow-orange-200/50">
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{slotStats.pending.toLocaleString(fa ? 'fa-IR' : 'en-US')}</div>
                <div className="text-[11px] sm:text-xs font-semibold opacity-90 mt-0.5">{t.statsPending}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-red-600 to-rose-600 text-white p-3 shadow-md shadow-red-200/50">
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{slotStats.confirmed.toLocaleString(fa ? 'fa-IR' : 'en-US')}</div>
                <div className="text-[11px] sm:text-xs font-semibold opacity-90 mt-0.5">{t.statsConfirmed}</div>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white p-3 shadow-md shadow-violet-200/50">
                <div className="text-2xl sm:text-3xl font-black tabular-nums">{slotStats.totalRequests.toLocaleString(fa ? 'fa-IR' : 'en-US')}</div>
                <div className="text-[11px] sm:text-xs font-semibold opacity-90 mt-0.5">{t.statsRequests}</div>
              </div>
            </div>

            {(slotStats.open > 0 || slotStats.pending > 0) && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50 to-violet-50 border border-orange-200/80 shadow-sm">
                <span className="text-lg animate-pulse">🔥</span>
                <div className="flex-1 min-w-0">
                  {slotStats.open > 0 && (
                    <p className="text-sm font-bold text-gray-800">{t.onlyOpen(slotStats.open)}</p>
                  )}
                  {slotStats.totalRequests > 0 && (
                    <p className="text-xs text-orange-700 font-medium">{t.peopleWaiting(slotStats.totalRequests)} — {t.hurry}</p>
                  )}
                  {slotStats.open === 0 && slotStats.pending > 0 && (
                    <p className="text-sm font-bold text-orange-800">{t.hurry}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Horizontal slot strip ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
                <div>
                  <h2 className="text-sm font-bold text-gray-800">{t.stripTitle}</h2>
                  <p className="text-[10px] text-gray-400">{t.stripHint}</p>
                </div>
                <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-full shrink-0">
                  {slotChips.length.toLocaleString(fa ? 'fa-IR' : 'en-US')} {fa ? 'جلسه' : 'sessions'}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto p-3 snap-x snap-mandatory scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
                {slotChips.map(({ meeting, status, guestCount, bookable }) => {
                  const sessionLabel = SESSION_TYPE_LABEL[meeting.sessionType || 'other']?.[fa ? 'fa' : 'en'] || meeting.title;
                  const prices = meetingPrices(meeting);
                  const style = MEETING_STATUS_STYLE[status];
                  const isHot = status === 'pending' && guestCount >= 2;

                  const consultant = findConsultant(personnel, meeting.consultantId);

                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      disabled={!bookable}
                      onClick={() => jumpToMeetingWeek(meeting)}
                      className={`snap-start shrink-0 w-[148px] sm:w-[168px] rounded-xl border-2 text-right p-2.5 transition-all ${
                        bookable
                          ? 'hover:scale-[1.02] hover:shadow-lg cursor-pointer active:scale-[0.98]'
                          : 'opacity-75 cursor-default'
                      } ${
                        status === 'open' ? 'border-emerald-400 bg-emerald-50/80 hover:bg-emerald-50'
                          : status === 'pending' ? 'border-orange-400 bg-orange-50/80 hover:bg-orange-50'
                          : 'border-red-300 bg-red-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {consultant && <ConsultantAvatar person={consultant} size="xs" />}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full text-white ${style.bg}`}>
                          {fa ? style.labelFa : style.labelEn}
                        </span>
                        {isHot && (
                          <span className="text-[8px] font-bold text-orange-600 bg-orange-100 px-1 rounded">{t.hot}</span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-gray-900 truncate">{sessionLabel}</div>
                      {meeting.consultantName && (
                        <div className="text-[10px] text-gray-600 truncate mt-0.5">{meeting.consultantName}</div>
                      )}
                      <div className="text-[10px] text-gray-500 mt-1" dir="ltr">
                        {formatSlotDate(meeting.date, fa, getDayName)}
                      </div>
                      <div className="text-[11px] font-bold text-violet-700 mt-0.5" dir="ltr">
                        {meeting.startTime} – {meeting.endTime}
                      </div>
                      {prices.length > 0 && (
                        <div className="text-[9px] text-emerald-700 font-semibold mt-1 truncate">
                          {prices.slice(0, 2).map(p => formatPriceAmount(p.amount, p.currency, lang)).join(' · ')}
                        </div>
                      )}
                      {guestCount > 0 && status !== 'confirmed' && (
                        <div className="text-[9px] text-orange-700 font-bold mt-1.5 flex items-center gap-0.5">
                          <span>👥</span> {guestCount} {t.guests}
                        </div>
                      )}
                      {bookable ? (
                        <div className="mt-2 w-full py-1 rounded-lg bg-violet-600 text-white text-[10px] font-bold text-center">
                          {t.bookNow}
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] font-bold text-red-600 text-center">{t.full}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden" style={{ minHeight: '560px' }}>
          <div className="flex items-center justify-center gap-1 px-4 py-2.5 border-b border-gray-200 bg-gray-50" dir="ltr">
            <button type="button" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 font-bold">‹</button>
            <button type="button" onClick={() => setWeekStart(getWeekStart(new Date()))} className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-gray-300 bg-white">{fa ? 'امروز' : 'Today'}</button>
            <button type="button" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 font-bold">›</button>
            <span className="text-[11px] font-semibold text-gray-500 px-2 min-w-[100px] text-center">{getWeekRange()}</span>
          </div>

          <div className="flex border-b border-gray-200 bg-gray-50" dir="ltr">
            <div className="w-10 flex-shrink-0 border-r border-gray-200" />
            {weekDays.map(day => {
              const ds = toDateStr(day);
              const isToday = ds === todayStr;
              const count = visibleMeetings.filter(m => m.date === ds).length;
              return (
                <div key={ds} className="flex-1 text-center py-1.5 border-l border-gray-200">
                  <div className={`text-[10px] font-bold uppercase ${isToday ? 'text-violet-600' : 'text-gray-400'}`}>{getDayName(day, true)}</div>
                  <div className={`text-base font-black w-8 h-8 flex items-center justify-center mx-auto rounded-full mt-0.5 ${isToday ? 'bg-violet-600 text-white' : 'text-gray-700'}`}>{day.getDate()}</div>
                  {count > 0 && <span className="text-[9px] text-gray-400">{count}</span>}
                </div>
              );
            })}
          </div>

          <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)', minHeight: '480px' }} dir="ltr">
            <div className="flex relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
              <div className="w-10 flex-shrink-0 border-r border-gray-200 relative bg-white">
                {HOURS.map(h => (
                  <div key={h} className="absolute flex items-start justify-end pr-1 w-full" style={{ top: `${h * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                    {h > 0 && <span className="text-[9px] text-gray-400 font-mono -mt-2">{h.toString().padStart(2, '0')}</span>}
                  </div>
                ))}
              </div>

              {weekDays.map(day => {
                const ds = toDateStr(day);
                const isToday = ds === todayStr;
                const dayMeetings = visibleMeetings.filter(m => m.date === ds);

                return (
                  <div key={ds} className={`flex-1 relative border-l border-gray-200 ${isToday ? 'bg-violet-50/20' : ''}`}>
                    {HOURS.map(h => (
                      <div key={h} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `${h * HOUR_HEIGHT}px` }} />
                    ))}

                    {dayMeetings.map(meeting => {
                      const startMin = timeToMinutes(meeting.startTime);
                      const endMin = timeToMinutes(meeting.endTime);
                      const top = (startMin / 60) * HOUR_HEIGHT;
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22);
                      const bookable = canPublicBookMeeting(meeting);
                      const prices = meetingPrices(meeting);
                      const sessionLabel = SESSION_TYPE_LABEL[meeting.sessionType || 'other']?.[fa ? 'fa' : 'en'] || meeting.title;
                      const guestCount = meeting.guests?.length || 0;

                      return (
                        <button
                          key={meeting.id}
                          type="button"
                          disabled={!bookable}
                          onClick={() => bookable && setBookingMeeting(meeting)}
                          className={`absolute rounded overflow-hidden shadow-sm z-10 text-right transition-all ${statusBlockClass(meeting)} ${bookable ? 'hover:shadow-lg hover:z-20 cursor-pointer' : 'opacity-90 cursor-not-allowed'}`}
                          style={{ top: `${top + 1}px`, height: `${height - 2}px`, left: '1px', right: '1px' }}
                          title={bookable ? t.clickToBook : statusLabel(meeting)}
                        >
                          <div className="px-1 py-0.5 h-full flex flex-col overflow-hidden text-white">
                            <div className="font-semibold truncate" style={{ fontSize: '10px' }}>{sessionLabel}</div>
                            {height > 26 && (
                              <div className="opacity-90 truncate" style={{ fontSize: '9px' }}>
                                {meeting.startTime}–{meeting.endTime}
                              </div>
                            )}
                            {height > 38 && meeting.consultantName && (
                              <div className="opacity-80 truncate" style={{ fontSize: '9px' }}>{meeting.consultantName}</div>
                            )}
                            {height > 50 && prices.length > 0 && (
                              <div className="opacity-90 truncate" style={{ fontSize: '8px' }}>
                                {prices.map(p => formatPriceAmount(p.amount, p.currency, lang)).join(' / ')}
                              </div>
                            )}
                            {guestCount > 0 && height > 36 && (
                              <div className="opacity-75" style={{ fontSize: '8px' }}>{guestCount} {t.guests}</div>
                            )}
                            {height > 20 && (
                              <div className="mt-auto opacity-90 font-bold" style={{ fontSize: '8px' }}>{statusLabel(meeting)}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {visibleMeetings.length === 0 && slotStats.total === 0 && (
          <p className="text-center text-sm text-gray-400 py-4">{t.noSlots}</p>
        )}
      </div>

      <MeetingBookingModal
        open={!!bookingMeeting}
        meeting={bookingMeeting}
        consultant={bookingMeeting ? findConsultant(personnel, bookingMeeting.consultantId) : undefined}
        lang={lang}
        onClose={() => setBookingMeeting(null)}
        onBooked={() => setBookingMeeting(null)}
      />
    </div>
  );
};
