import React, { useState } from 'react';
import type { Meeting, Personnel } from '../types';
import { Language } from '../App';
import { tryBookMeeting } from '../services/firebaseService';
import { formatJalaliDateFa, formatTimeRangeFa } from '../utils/persianDateTime';
import { meetingPrices, getMeetingSessionLabel, getMeetingConsultantBio, getMeetingConsultantName, getMeetingConsultantPhoto } from '../utils/meetingBookingUtils';
import { formatPriceAmount } from '../utils/servicePriceList';
import { ConsultantAvatar } from './ConsultantAvatar';
import { AppModal, modalFieldInput, modalFieldLabel, modalFieldTextarea } from './AppModal';
import { IconCopy } from './Icons';

interface Props {
  open: boolean;
  meeting: Meeting | null;
  consultant?: Personnel;
  lang: Language;
  onClose: () => void;
  onBooked: () => void;
  onOpenTracking?: (code?: string) => void;
}

export const MeetingBookingModal: React.FC<Props> = ({ open, meeting, consultant, lang, onClose, onBooked, onOpenTracking }) => {
  const fa = lang === 'fa';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!open || !meeting) return null;

  const sessionLabel = getMeetingSessionLabel(meeting, fa ? 'fa' : 'en');
  const prices = meetingPrices(meeting);
  const consultantName = getMeetingConsultantName(meeting, consultant);
  const consultantBio = getMeetingConsultantBio(meeting, consultant);
  const consultantPhoto = getMeetingConsultantPhoto(meeting, consultant);

  const t = {
    title: fa ? 'رزرو جلسه' : 'Book session',
    session: fa ? 'نوع جلسه' : 'Session type',
    consultant: fa ? 'مشاور' : 'Consultant',
    date: fa ? 'تاریخ' : 'Date',
    time: fa ? 'ساعت' : 'Time',
    price: fa ? 'هزینه' : 'Fee',
    name: fa ? 'نام و نام خانوادگی' : 'Full name',
    phone: fa ? 'شماره تماس / واتساپ' : 'Phone / WhatsApp',
    email: fa ? 'ایمیل (اختیاری)' : 'Email (optional)',
    company: fa ? 'شرکت (اختیاری)' : 'Company (optional)',
    note: fa ? 'توضیحات (اختیاری)' : 'Notes (optional)',
    submit: fa ? 'ثبت رزرو موقت' : 'Submit temporary booking',
    close: fa ? 'بستن' : 'Close',
    saving: fa ? 'در حال ثبت…' : 'Saving…',
    success: fa
      ? 'رزرو موقت شما ثبت شد. کد پیگیری را ذخیره کنید — پس از جلسه پیشنهادات مشاور از همین کد قابل مشاهده است.'
      : 'Booking submitted. Save your tracking code — consultant recommendations appear here after the session.',
    trackingLabel: fa ? 'کد پیگیری' : 'Tracking code',
    copyCode: fa ? 'کپی کد' : 'Copy code',
    copied: fa ? 'کپی شد ✓' : 'Copied ✓',
    trackPage: fa ? 'صفحه پیگیری' : 'Tracking page',
    taken: fa ? 'این زمان قبلاً رزرو قطعی شده است.' : 'This slot is already confirmed.',
    full: fa ? 'ظرفیت رزرو موقت این زمان پر شده است.' : 'Temporary booking limit reached for this slot.',
    required: fa ? 'نام و شماره تماس الزامی است.' : 'Name and phone are required.',
    fail: fa ? 'خطا در ثبت. دوباره تلاش کنید.' : 'Save failed. Please try again.',
    hint: fa
      ? 'چند نفر می‌توانند همزمان رزرو موقت ثبت کنند؛ مستر یکی را قطعی می‌کند.'
      : 'Multiple people can book temporarily; master confirms one winner.',
  };

  const reset = () => {
    setName(''); setPhone(''); setEmail(''); setCompany(''); setNote('');
    setDone(false); setError(''); setTrackingCode(''); setCopied(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const copyTracking = async () => {
    if (!trackingCode) return;
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError(t.required); return; }
    setSaving(true);
    setError('');
    const { result, trackingCode: code } = await tryBookMeeting(meeting.id, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (result === 'ok' && code) {
      setTrackingCode(code);
      setDone(true);
      onBooked();
      return;
    }
    if (result === 'taken') setError(t.taken);
    else if (result === 'full') setError(t.full);
    else setError(t.fail);
  };

  return (
    <AppModal
      open={open}
      onClose={handleClose}
      title={t.title}
      dir={fa ? 'rtl' : 'ltr'}
      size="sm"
      footer={done ? (
        <button type="button" onClick={handleClose} className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold">{t.close}</button>
      ) : (
        <button
          type="submit"
          form="meeting-booking-form"
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors disabled:opacity-50"
        >
          {saving ? t.saving : t.submit}
        </button>
      )}
    >
      {done ? (
        <div className="text-center space-y-4 py-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-2xl">✓</div>
          <p className="text-sm text-gray-700 leading-relaxed">{t.success}</p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500 mb-1">{t.trackingLabel}</p>
            <p className="text-lg font-bold text-gray-900 tracking-wider dir-ltr" dir="ltr">{trackingCode}</p>
            <div className="flex gap-2 justify-center mt-3">
              <button type="button" onClick={copyTracking} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-medium flex items-center gap-1">
                <IconCopy className="w-3.5 h-3.5" />{copied ? t.copied : t.copyCode}
              </button>
              {onOpenTracking && (
                <button type="button" onClick={() => { onOpenTracking(trackingCode); handleClose(); }} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium">
                  {t.trackPage}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form id="meeting-booking-form" onSubmit={handleSubmit} className="space-y-4">
          {consultantName && (
            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 flex gap-3">
              <ConsultantAvatar name={consultantName} avatarUrl={consultantPhoto} person={consultant} size="md" ring />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">{consultantName}</div>
                {consultantBio && (
                  <div className="mt-1 max-h-24 overflow-y-auto text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">{consultantBio}</div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm space-y-1.5">
            <div><span className="text-gray-500">{t.session}: </span><strong>{sessionLabel}</strong></div>
            <div className={fa ? 'text-right' : 'text-left'} dir={fa ? 'rtl' : 'ltr'}>
              <span className="text-gray-500">{t.date}: </span>
              <strong>{fa ? formatJalaliDateFa(meeting.date) : meeting.date}</strong>
              {fa ? (
                <div className="mt-0.5"><strong>{formatTimeRangeFa(meeting.startTime, meeting.endTime)}</strong></div>
              ) : (
                <span> — {meeting.startTime}–{meeting.endTime}</span>
              )}
            </div>
            {prices.length > 0 && (
              <div>
                <span className="text-gray-500">{t.price}: </span>
                {prices.map((p, i) => (
                  <strong key={p.currency} className="text-emerald-700">
                    {i > 0 ? ' / ' : ''}{formatPriceAmount(p.amount, p.currency, lang)}
                  </strong>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">{t.hint}</p>

          <div>
            <label className={modalFieldLabel}>{t.name} *</label>
            <input required className={modalFieldInput} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className={modalFieldLabel}>{t.phone} *</label>
            <input required dir="ltr" className={modalFieldInput} value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label className={modalFieldLabel}>{t.email}</label>
            <input type="email" dir="ltr" className={modalFieldInput} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={modalFieldLabel}>{t.company}</label>
            <input className={modalFieldInput} value={company} onChange={e => setCompany(e.target.value)} />
          </div>
          <div>
            <label className={modalFieldLabel}>{t.note}</label>
            <textarea rows={2} className={modalFieldTextarea} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </form>
      )}
    </AppModal>
  );
};
