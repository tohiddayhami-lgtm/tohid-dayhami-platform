import React, { useState } from 'react';
import type { MetaBazaar, MetaExpoBoothReservation, MetaExpoEvent, MetaverseBooth } from '../../types';
import { Language } from '../../App';
import { bi } from './expoUtils';
import { tryReserveBooth } from '../../services/firebaseService';

interface Props {
  open: boolean;
  bazaar: MetaBazaar;
  booth: MetaverseBooth | null;
  visitorId: string;
  lang: Language;
  onClose: () => void;
  onReserved: () => void;
  onTrack?: (type: MetaExpoEvent['type'], opts?: Partial<MetaExpoEvent>) => void;
}

const getSessionId = () => {
  try {
    const k = '_meta_expo_sid';
    let s = sessionStorage.getItem(k);
    if (!s) { s = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem(k, s); }
    return s;
  } catch { return undefined; }
};

export const BoothReservationModal: React.FC<Props> = ({
  open, bazaar, booth, visitorId, lang, onClose, onReserved, onTrack,
}) => {
  const T = lang === 'fa';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [productService, setProductService] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!open || !booth) return null;

  const boothName = bi(booth.name, lang, lang === 'fa' ? 'غرفه' : 'Booth');

  const t = {
    title: T ? 'رزرو غرفه' : 'Reserve booth',
    booth: T ? 'غرفه' : 'Booth',
    firstName: T ? 'نام' : 'First name',
    lastName: T ? 'نام خانوادگی' : 'Last name',
    company: T ? 'نام شرکت' : 'Company name',
    jobTitle: T ? 'سمت' : 'Job title',
    productService: T ? 'نوع محصول' : 'Product type',
    whatsapp: T ? 'شماره واتساپ' : 'WhatsApp number',
    submit: T ? 'ثبت رزرو موقت' : 'Submit reservation',
    close: T ? 'بستن' : 'Close',
    saving: T ? 'در حال ثبت…' : 'Saving…',
    success: T ? 'غرفه به‌صورت موقت برای شرکت شما رزرو شد. پس از تأیید مستر، رزرو قطعی می‌شود.' : 'Booth temporarily reserved for your company. Master will confirm the booking.',
    taken: T ? 'این غرفه قبلاً رزرو شده است.' : 'This booth is already reserved.',
    required: T ? 'لطفاً همه فیلدها را پر کنید.' : 'Please fill in all fields.',
    fail: T ? 'خطا در ثبت. دوباره تلاش کنید.' : 'Save failed. Please try again.',
    hint: T ? 'پس از ثبت، این غرفه برای دیگران قابل رزرو نیست.' : 'After submitting, this booth cannot be reserved by others.',
  };

  const reset = () => {
    setFirstName(''); setLastName(''); setCompany(''); setJobTitle('');
    setProductService(''); setWhatsapp(''); setDone(false); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields = [firstName, lastName, company, jobTitle, productService, whatsapp];
    if (fields.some(f => !f.trim())) { setError(t.required); return; }
    setSaving(true);
    setError('');
    const payload: Omit<MetaExpoBoothReservation, 'id' | 'status'> = {
      timestamp: new Date().toISOString(),
      bazaarId: bazaar.id,
      bazaarSlug: bazaar.slug,
      bazaarName: bazaar.name,
      boothId: booth.id,
      boothName,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      productService: productService.trim(),
      whatsapp: whatsapp.trim(),
      visitorId,
      sessionId: getSessionId(),
      device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : (/Tablet|iPad/i.test(navigator.userAgent) ? 'tablet' : 'desktop'),
    };
    try {
      const result = await tryReserveBooth(payload);
      if (result === 'taken') { setError(t.taken); return; }
      if (result === 'error') { setError(t.fail); return; }
      const fullName = `${payload.firstName} ${payload.lastName}`;
      onTrack?.('booth_reservation_complete', {
        boothId: booth.id,
        boothName,
        targetId: booth.id,
        targetName: fullName,
        targetType: 'booth_reservation',
        side: 'booth_reserve',
      });
      onReserved();
      setDone(true);
    } catch {
      setError(t.fail);
    } finally {
      setSaving(false);
    }
  };

  const fld = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-amber-500 text-sm bg-white';
  const lbl = 'block text-xs font-bold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir={T ? 'rtl' : 'ltr'}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">📌 {t.title}</h2>
            <p className="text-xs text-amber-700 mt-0.5">{t.booth}: {boothName}</p>
            {!done && <p className="text-xs text-gray-500 mt-0.5">{t.hint}</p>}
          </div>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">×</button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm text-gray-700 font-medium">{t.success}</p>
            <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700">{t.close}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>{t.firstName}</label><input className={fld} value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
              <div><label className={lbl}>{t.lastName}</label><input className={fld} value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
            </div>
            <div><label className={lbl}>{t.company}</label><input className={fld} value={company} onChange={e => setCompany(e.target.value)} required /></div>
            <div><label className={lbl}>{t.jobTitle}</label><input className={fld} value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder={T ? 'مثلاً مدیرعامل' : 'e.g. CEO'} required /></div>
            <div><label className={lbl}>{t.productService}</label><input className={fld} value={productService} onChange={e => setProductService(e.target.value)} required /></div>
            <div><label className={lbl}>{t.whatsapp}</label><input className={fld + ' dir-ltr'} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+98…" required /></div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-700 disabled:opacity-60 transition-colors">
              {saving ? t.saving : t.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const exportBoothReservationsCSV = (rows: MetaExpoBoothReservation[], lang: Language, filename: string) => {
  if (!rows.length) return;
  const T = lang === 'fa';
  const headers = T
    ? ['تاریخ', 'غرفه', 'نام', 'نام خانوادگی', 'شرکت', 'سمت', 'محصول', 'واتساپ', 'وضعیت']
    : ['Date', 'Booth', 'First name', 'Last name', 'Company', 'Job title', 'Product', 'WhatsApp', 'Status'];
  const statusLabel = (s: string) => T
    ? (s === 'confirmed' ? 'قطعی' : s === 'cancelled' ? 'لغو' : 'موقت')
    : s;
  const escape = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
  const csvRows = rows.map(r => [
    new Date(r.timestamp).toLocaleString(T ? 'fa-IR' : 'en-US'),
    r.boothName || r.boothId,
    r.firstName, r.lastName, r.company, r.jobTitle, r.productService, r.whatsapp,
    statusLabel(r.status),
  ]);
  const csv = [headers, ...csvRows].map(row => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
