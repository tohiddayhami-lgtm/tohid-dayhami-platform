import type { Currency, Meeting, Personnel, Price, ConsultantCategory } from '../types';
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

export const getMeetingConsultantName = (m: Meeting, person?: Personnel): string =>
  m.consultantName?.trim() || person?.fullName || '';

export const getMeetingConsultantBio = (m: Meeting, person?: Personnel): string =>
  m.consultantBio?.trim() || person?.consultantBio?.trim() || '';

export const getMeetingConsultantPhoto = (m: Meeting, person?: Personnel): string | undefined =>
  m.consultantPhoto || person?.avatar || undefined;

export interface MeetingConsultantProfile {
  key: string;
  id?: string;
  name: string;
  bio: string;
  photo?: string;
}

export const collectMeetingConsultantProfiles = (
  meetings: Meeting[],
  personnel: Personnel[],
): MeetingConsultantProfile[] => {
  const seen = new Set<string>();
  const list: MeetingConsultantProfile[] = [];
  for (const m of meetings.filter(isBookableMeeting)) {
    const person = findConsultant(personnel, m.consultantId);
    const name = getMeetingConsultantName(m, person);
    if (!name) continue;
    const key = m.consultantId || `name:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({
      key,
      id: m.consultantId,
      name,
      bio: getMeetingConsultantBio(m, person),
      photo: getMeetingConsultantPhoto(m, person),
    });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
};

export const countOpenSlotsForProfile = (
  meetings: Meeting[],
  profile: MeetingConsultantProfile,
  fromDate: string,
): number =>
  meetings.filter(m => {
    if (!isBookableMeeting(m) || m.date < fromDate) return false;
    if (getMeetingDisplayStatus(m) !== 'open') return false;
    if (profile.id) return m.consultantId === profile.id;
    return !m.consultantId && getMeetingConsultantName(m) === profile.name;
  }).length;

export interface ConsultantSessionTopic {
  key: string;
  label: string;
  description?: string;
  openCount: number;
  totalCount: number;
}

/** سرفصل‌های یکتا برای یک مشاور (از جلسات آینده) */
export const collectConsultantSessionTopics = (
  meetings: Meeting[],
  consultantId: string,
  fromDate: string,
  fa: boolean,
): ConsultantSessionTopic[] => {
  const map = new Map<string, ConsultantSessionTopic>();
  for (const m of meetings) {
    if (!isBookableMeeting(m) || m.date < fromDate) continue;
    if (m.consultantId !== consultantId) continue;
    const label = getMeetingSessionLabel(m, fa ? 'fa' : 'en');
    const key = (m.sessionType?.trim() || label).toLowerCase();
    const existing = map.get(key);
    const isOpen = getMeetingDisplayStatus(m) === 'open';
    if (existing) {
      existing.totalCount += 1;
      if (isOpen) existing.openCount += 1;
      if (!existing.description && m.description?.trim()) existing.description = m.description.trim();
    } else {
      map.set(key, {
        key,
        label,
        description: m.description?.trim() || undefined,
        openCount: isOpen ? 1 : 0,
        totalCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'fa'));
};

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

export const filterPublicBookableMeetingsByCategory = (
  meetings: Meeting[],
  categoryId?: string | null,
  consultantId?: string | null,
): Meeting[] => {
  let list = filterPublicBookableMeetings(meetings, consultantId);
  if (categoryId) list = list.filter(m => m.consultantCategoryId === categoryId);
  return list;
};

export const getCategoryForMeeting = (
  meeting: Meeting,
  categories: ConsultantCategory[],
): ConsultantCategory | undefined =>
  categories.find(c => c.id === meeting.consultantCategoryId);

export const groupMeetingsByCategory = (
  meetings: Meeting[],
  categories: ConsultantCategory[],
): { category: ConsultantCategory | null; meetings: Meeting[] }[] => {
  const sorted = [...meetings].sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
  const catOrder = categories.map(c => c.id);
  const buckets = new Map<string | '__none__', Meeting[]>();
  for (const m of sorted) {
    const key = m.consultantCategoryId || '__none__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }
  const result: { category: ConsultantCategory | null; meetings: Meeting[] }[] = [];
  for (const id of catOrder) {
    const ms = buckets.get(id);
    if (ms?.length) {
      result.push({ category: categories.find(c => c.id === id) || null, meetings: ms });
      buckets.delete(id);
    }
  }
  const uncategorized = buckets.get('__none__');
  if (uncategorized?.length) result.push({ category: null, meetings: uncategorized });
  for (const [key, ms] of buckets) {
    if (key !== '__none__' && ms.length) {
      result.push({ category: categories.find(c => c.id === key) || null, meetings: ms });
    }
  }
  return result;
};
