import { parseDateLocal } from './weekCalendar';

const JALALI_MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

const JALALI_WEEKDAYS_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** تبدیل اعداد لاتین به فارسی */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, d => PERSIAN_DIGITS[Number(d)]);
}

/** Gregorian → [jy, jm, jd] */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 365) days = (days - 1) % 365;
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

/** تاریخ شمسی کامل — مثلاً «شنبه ۳ تیر ۱۴۰۴» */
export function formatJalaliDateFa(dateStr: string, withWeekday = true): string {
  const d = parseDateLocal(dateStr);
  const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const weekday = JALALI_WEEKDAYS_FA[d.getDay()];
  const datePart = `${toPersianDigits(jd)} ${JALALI_MONTHS_FA[jm - 1]} ${toPersianDigits(jy)}`;
  return withWeekday ? `${weekday} ${datePart}` : datePart;
}

function normalizeTimePart(t?: string | null): string {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return '۰۰:۰۰';
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** «ساعت ۰۹:۰۰ الی ۱۰:۳۰» */
export function formatTimeRangeFa(start?: string | null, end?: string | null): string {
  const s = toPersianDigits(normalizeTimePart(start));
  const e = toPersianDigits(normalizeTimePart(end));
  return `ساعت ${s} الی ${e}`;
}

/** تاریخ + ساعت برای نمایش عمومی فارسی */
export function formatConsultationSlotFa(dateStr: string, start?: string | null, end?: string | null): string {
  return `${formatJalaliDateFa(dateStr)} · ${formatTimeRangeFa(start, end)}`;
}

/** انگلیسی — همان فرمت قبلی */
export function formatConsultationSlotEn(dateStr: string, start?: string | null, end?: string | null): string {
  const d = parseDateLocal(dateStr);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${d.getDate()} ${mon[d.getMonth()]} · ${normalizeTimePart(start)} – ${normalizeTimePart(end)}`;
}

export function formatConsultationSlot(dateStr: string, start?: string | null, end?: string | null, fa = true): string {
  return fa ? formatConsultationSlotFa(dateStr, start, end) : formatConsultationSlotEn(dateStr, start, end);
}
