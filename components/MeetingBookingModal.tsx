import React, { useState } from 'react';
import type { Meeting, Personnel } from '../types';
import { Language } from '../App';
import { tryBookMeeting } from '../services/firebaseService';
import { formatConsultationSlot, formatJalaliDateFa, formatTimeRangeFa } from '../utils/persianDateTime';
import { meetingPrices, getMeetingSessionLabel, getMeetingConsultantBio, getMeetingConsultantName, getMeetingConsultantPhoto } from '../utils/meetingBookingUtils';
import { formatPriceAmount } from '../utils/servicePriceList';
import { ConsultantAvatar } from './ConsultantAvatar';
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir={fa ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 bg-violet-600 rounded-t-2xl sticky top-0">
          <h3 className="font-bold text-white text-sm">{t.title}</h3>
          <button type="button" onClick={handleClose} className="text-white/80 hover:text-white w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20">✕</button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto text-2xl">✓</div>
            <p className="text-sm text-gray-700 leading-relaxed">{t.success}</p>
            <div className="rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 p-4">
              <p className="text-xs text-gray-500 mb-1">{t.trackingLabel}</p>
              <p className="text-lg font-black text-violet-800 tracking-wider dir-ltr" dir="ltr">{trackingCode}</p>
              <div className="flex gap-2 justify-center mt-3">
                <button type="button" onClick={copyTracking} className="px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-violet-700 text-xs font-bold flex items-center gap-1">
                  <IconCopy className="w-3.5 h-3.5" />{copied ? t.copied : t.copyCode}
                </button>
                {onOpenTracking && (
                  <button type="button" onClick={() => { onOpenTracking(trackingCode); handleClose(); }} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold">
                    {t.trackPage}
                  </button>
                )}
              </div>
            </div>
            <button type="button" onClick={handleClose} className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold">{t.close}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            {consultantName && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 flex gap-3">
                <ConsultantAvatar name={consultantName} avatarUrl={consultantPhoto} person={consultant} size="md" ring />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-900">{consultantName}</div>
                  {consultantBio && (
                    <div className="mt-1 max-h-32 overflow-y-auto text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">{consultantBio}</div>
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

            <p className="text-[11px] text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">{t.hint}</p>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t.name} *</label>
              <input required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t.phone} *</label>
              <input required dir="ltr" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t.email}</label>
              <input type="email" dir="ltr" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t.company}</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" value={company} onChange={e => setCompany(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{t.note}</label>
              <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-violet-500" value={note} onChange={e => setNote(e.target.value)} />
            </div>

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm disabled:opacity-50">
              {saving ? t.saving : t.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
