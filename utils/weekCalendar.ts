/** Shared week helpers (Saturday-start week, local dates). */

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() - 6 + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(ws: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateLocal(ds: string): Date {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function normalizeTime(t?: string | null, fallback = '09:00'): string {
  if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) return t;
  return fallback;
}

export function timeToMinutes(t?: string | null): number {
  const [h, m] = normalizeTime(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const DAY_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const DAY_FA_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const DAY_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const MON_FA = ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'];
export const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayIndex(d: Date): number {
  return d.getDay() === 6 ? 0 : d.getDay() + 1;
}

export function getDayName(d: Date, fa: boolean, short = false): string {
  const idx = dayIndex(d);
  return fa ? (short ? DAY_FA_SHORT[idx] : DAY_FA[idx]) : DAY_EN[idx];
}

export function getWeekRangeLabel(weekDays: Date[], fa: boolean): string {
  const s = weekDays[0], e = weekDays[6];
  const ms = fa ? MON_FA[s.getMonth()] : MON_EN[s.getMonth()];
  const me = fa ? MON_FA[e.getMonth()] : MON_EN[e.getMonth()];
  return s.getMonth() === e.getMonth()
    ? `${ms} ${s.getDate()}–${e.getDate()}`
    : `${ms} ${s.getDate()} – ${me} ${e.getDate()}`;
}
