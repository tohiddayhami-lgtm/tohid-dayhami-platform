import type { Currency, Meeting, Personnel, Price } from '../types';
import { resolvePrices } from './servicePriceList';

export const MAX_MEETING_PENDING_GUESTS = 100;

export type MeetingDisplayStatus = 'internal' | 'open' | 'pending' | 'confirmed';

export const MEETING_STATUS_STYLE: Record<Exclude<MeetingDisplayStatus, 'internal'>, {
  bg: string; hex: string; labelFa: string; labelEn: string;
}> = {
  open: { bg: 'bg-emerald-500', hex: '#22c55e', labelFa: 'باز', labelEn: 'Open' },
  pending: { bg: 'bg-orange-500', hex: '#f97316', labelFa: 'رزرو موقت', labelEn: 'Temporary' },
  confirmed: { bg: 'bg-red-600', hex: '#dc2626', labelFa: 'رزرو قطعی', labelEn: 'Confirmed' },
};

export const SESSION_TYPE_LABEL: Record<string, { fa: string; en: string }> = {
  consultation: { fa: 'مشاوره', en: 'Consultation' },
  workshop: { fa: 'ورکشاپ', en: 'Workshop' },
  session: { fa: 'جلسه', en: 'Session' },
  other: { fa: 'سایر', en: 'Other' },
};

/** نوع جلسه — متن آزاد یا برچسب‌های قدیمی ذخیره‌شده */
export const getMeetingSessionLabel = (m: Meeting, lang: 'fa' | 'en' = 'fa'): string => {
  const st = m.sessionType?.trim();
  if (st) {
    const legacy = SESSION_TYPE_LABEL[st];
    if (legacy) return lang === 'fa' ? legacy.fa : legacy.en;
    return st;
  }
  return m.title?.trim() || (lang === 'fa' ? 'جلسه' : 'Session');
};

export const isBookableMeeting = (m: Meeting) => m.kind === 'bookable';

export const isInternalMeeting = (m: Meeting) => !m.kind || m.kind === 'internal';

export const getMeetingDisplayStatus = (m: Meeting): MeetingDisplayStatus => {
  if (!isBookableMeeting(m)) return 'internal';
  if (m.bookingStatus === 'confirmed' || m.confirmedGuestId) return 'confirmed';
  if ((m.guests?.length || 0) > 0 || m.bookingStatus === 'pending') return 'pending';
  return 'open';
};

export const meetingPrices = (m: Meeting): Price[] =>
  resolvePrices(m.price, m.prices);

export const filterPublicBookableMeetings = (
  meetings: Meeting[],
  consultantId?: string | null,
): Meeting[] =>
  meetings.filter(m => {
    if (!isBookableMeeting(m)) return false;
    if (consultantId && m.consultantId !== consultantId) return false;
    return true;
  });

export const getBookableConsultants = (
  meetings: Meeting[],
  personnel: Personnel[],
): Personnel[] => {
  const ids = new Set(
    meetings.filter(isBookableMeeting).map(m => m.consultantId).filter(Boolean) as string[],
  );
  return personnel
    .filter(p => (p.status || 'active') === 'active' && ids.has(p.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fa'));
};

export const findConsultant = (personnel: Personnel[], id?: string | null): Personnel | undefined =>
  id ? personnel.find(p => p.id === id) : undefined;

export const countConsultantOpenSlots = (meetings: Meeting[], consultantId: string): number =>
  meetings.filter(m => m.consultantId === consultantId && getMeetingDisplayStatus(m) === 'open').length;

export const buildBookingPublicUrl = (baseUrl: string, consultantId?: string | null) => {
  const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
  url.search = '';
  url.hash = '';
  url.searchParams.set('page', 'booking');
  if (consultantId) url.searchParams.set('consultant', consultantId);
  return `${url.pathname}${url.search}`;
};

export const canPublicBookMeeting = (m: Meeting): boolean => {
  const status = getMeetingDisplayStatus(m);
  return status === 'open' || status === 'pending';
};
