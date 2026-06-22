import React, { useState } from 'react';
import type { Meeting, Personnel } from '../types';
import { Language } from '../App';
import { tryBookMeeting } from '../services/firebaseService';
import { meetingPrices, SESSION_TYPE_LABEL } from '../utils/meetingBookingUtils';
import { formatPriceAmount } from '../utils/servicePriceList';
import { ConsultantAvatar } from './ConsultantAvatar';

interface Props {
  open: boolean;
  meeting: Meeting | null;
  consultant?: Personnel;
  lang: Language;
  onClose: () => void;
  onBooked: () => void;
}

export const MeetingBookingModal: React.FC<Props> = ({ open, meeting, consultant, lang, onClose, onBooked }) => {
  const fa = lang === 'fa';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!open || !meeting) return null;

  const sessionLabel = SESSION_TYPE_LABEL[meeting.sessionType || 'other']?.[fa ? 'fa' : 'en'] || meeting.title;
  const prices = meetingPrices(meeting);

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
      ? 'رزرو موقت شما ثبت شد. پس از تأیید مستر، رزرو قطعی می‌شود و به رنگ قرمز نمایش داده می‌شود.'
      : 'Your temporary booking was submitted. After master confirmation it will show as confirmed (red).',
    taken: fa ? 'این زمان قبلاً رزرو قطعی شده است.' : 'This slot is already confirmed.',
    full: fa ? 'ظرفیت رزرو موقت این زمان پر شده است.' : 'Temporary booking limit reached for this slot.',
    required: fa ? 'نام و شماره تماس الزامی است.' : 'Name and phone are required.',
    fail: fa ? 'خطا در ثبت. دوباره تلاش کنید.' : 'Save failed. Please try again.',
    hint: fa
      ? 'چند نفر می‌توانند همزمان رزرو موقت ثبت کنند؛ مستر یکی را قطعی می‌کند.'
      : 'Multiple people can book temporarily; master confirms one winner.',
    resume: fa ? 'رزومه مشاور' : 'Consultant bio',
  };

  const reset = () => {
    setName(''); setPhone(''); setEmail(''); setCompany(''); setNote('');
    setDone(false); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { setError(t.required); return; }
    setSaving(true);
    setError('');
    const result = await tryBookMeeting(meeting.id, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (result === 'ok') { setDone(true); onBooked(); return; }
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
            <button type="button" onClick={handleClose} className="px-5 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold">{t.close}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            {(consultant || meeting.consultantName) && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 flex gap-3">
                <ConsultantAvatar person={consultant} name={meeting.consultantName} size="md" ring />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-900">{consultant?.fullName || meeting.consultantName}</div>
                  {consultant?.roles?.length ? (
                    <div className="text-[10px] text-violet-600 font-medium">{(consultant.roles || []).join(' · ')}</div>
                  ) : null}
                  {consultant?.consultantBio && (
                    <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed line-clamp-4 whitespace-pre-wrap">{consultant.consultantBio}</p>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm space-y-1.5">
              <div><span className="text-gray-500">{t.session}: </span><strong>{sessionLabel}</strong></div>
              {meeting.consultantName && (
                <div><span className="text-gray-500">{t.consultant}: </span><strong>{meeting.consultantName}</strong></div>
              )}
              <div dir="ltr" className="text-left"><span className="text-gray-500">{t.date}: </span><strong>{meeting.date}</strong> — {meeting.startTime}–{meeting.endTime}</div>
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
