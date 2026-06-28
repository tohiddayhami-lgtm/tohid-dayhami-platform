import type { AppConfig } from '../types';

export const DEFAULT_CONSULTATION_PUBLIC_NOTICE_FA =
  'هر بازهٔ زمانی آزاد را می‌توانید به‌صورت «رزرو موقت» انتخاب کنید — این امکان برای همهٔ متقاضیان فعال است.\n\n'
  + 'پس از بررسی و تأیید رزرو توسط تیم ما، وضعیت جلسه به «رزرو قطعی» تغییر می‌کند و آن زمان دیگر برای سایرین قابل انتخاب نخواهد بود.';

export const DEFAULT_CONSULTATION_PUBLIC_NOTICE_EN =
  'Any open time slot can be requested as a temporary booking — this option is available to everyone.\n\n'
  + 'Once our team reviews and confirms your reservation, the session status becomes Confirmed and that slot is no longer available to others.';

export const getConsultationPublicNotice = (config: Pick<AppConfig, 'consultationPublicNoticeFa' | 'consultationPublicNoticeEn'> | undefined, fa: boolean): string => {
  const custom = fa ? config?.consultationPublicNoticeFa : config?.consultationPublicNoticeEn;
  if (custom?.trim()) return custom.trim();
  return fa ? DEFAULT_CONSULTATION_PUBLIC_NOTICE_FA : DEFAULT_CONSULTATION_PUBLIC_NOTICE_EN;
};
