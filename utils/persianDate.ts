import { parseDateLocal } from './weekCalendar';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, d => PERSIAN_DIGITS[Number(d)] ?? d);
}

/** تاریخ شمسی — مثلاً «شنبه، ۳ تیر ۱۴۰۴» */
export function formatMeetingDateShamsi(dateStr: string, fa: boolean): string {
  if (!dateStr) return '';
  try {
    const d = parseDateLocal(dateStr);
    if (fa) {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
    }
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

function normalizeTime(t?: string | null): string {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return '00:00';
  const [h, m] = t.split(':');
  return `${String(Number(h)).padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** «ساعت ۱۴:۳۰ الی ۱۵:۰۰» با اعداد فارسی */
export function formatMeetingTimeRange(start?: string, end?: string, fa = true): string {
  const s = normalizeTime(start);
  const e = normalizeTime(end);
  if (fa) return `ساعت ${toPersianDigits(s)} الی ${toPersianDigits(e)}`;
  return `${s} – ${e}`;
}

export function formatMeetingDateTimeLine(dateStr: string, start?: string, end?: string, fa = true): string {
  const datePart = formatMeetingDateShamsi(dateStr, fa);
  const timePart = formatMeetingTimeRange(start, end, fa);
  return fa ? `${datePart} · ${timePart}` : `${datePart} · ${timePart}`;
}
