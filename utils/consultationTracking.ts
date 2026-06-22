import type { ConsultantCategory, Meeting, MeetingBookingGuest } from '../types';

export const CONSULTATION_TRACKING_PREFIX = 'CON';

export function generateConsultationTrackingCode(phone?: string): string {
  const tail = (phone || '').replace(/\D/g, '').slice(-4) || String(Date.now()).slice(-4);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${CONSULTATION_TRACKING_PREFIX}-${tail}-${rand}`;
}

export function normalizeTrackingCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function categoryLabel(cat: ConsultantCategory, fa: boolean): string {
  return fa ? (cat.nameFa || cat.nameEn) : (cat.nameEn || cat.nameFa);
}

export function sortCategories(cats: ConsultantCategory[]): ConsultantCategory[] {
  return [...cats].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.nameFa.localeCompare(b.nameFa, 'fa'));
}

export function findGuestByTrackingCode(meetings: Meeting[], code: string): {
  meeting: Meeting;
  guest: MeetingBookingGuest;
} | null {
  const norm = normalizeTrackingCodeInput(code);
  if (!norm) return null;
  for (const meeting of meetings) {
    if (meeting.kind !== 'bookable') continue;
    for (const guest of meeting.guests || []) {
      if (guest.trackingCode && normalizeTrackingCodeInput(guest.trackingCode) === norm) {
        return { meeting, guest };
      }
    }
  }
  return null;
}

export function isSessionPast(meeting: Meeting): boolean {
  const end = `${meeting.date}T${meeting.endTime || '23:59'}`;
  const t = Date.parse(end);
  if (!Number.isNaN(t)) return t < Date.now();
  return meeting.date < new Date().toISOString().slice(0, 10);
}

export function canShowFollowUp(meeting: Meeting, guest: MeetingBookingGuest): boolean {
  if (!meeting.followUp?.publishedAt) return false;
  if (meeting.confirmedGuestId && meeting.confirmedGuestId !== guest.id) return false;
  return isSessionPast(meeting) || !!meeting.sessionCompletedAt;
}

export type BookMeetingResult = 'ok' | 'taken' | 'full' | 'error' | 'not_found';

export interface BookMeetingResponse {
  result: BookMeetingResult;
  trackingCode?: string;
}
