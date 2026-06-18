import React, { useState } from 'react';
import type { MetaBazaar, MetaExpoEvent, MetaExpoRegistration } from '../../types';
import { Language } from '../../App';
import { saveMetaExpoRegistration } from '../../services/firebaseService';

interface Props {
  open: boolean;
  bazaar: MetaBazaar;
  visitorId: string;
  lang: Language;
  title?: string;
  onClose: () => void;
  onSubmitted: (fullName: string) => void;
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

export const EntranceRegistrationModal: React.FC<Props> = ({
  open, bazaar, visitorId, lang, title, onClose, onSubmitted, onTrack,
}) => {
  const T = lang === 'fa';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [productService, setProductService] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const t = {
    title: title || (T ? 'ثبت اطلاعات بازدیدکننده' : 'Visitor registration'),
    firstName: T ? 'نام' : 'First name',
    lastName: T ? 'نام خانوادگی' : 'Last name',
    company: T ? 'نام شرکت' : 'Company name',
    productService: T ? 'نوع محصول یا خدمت تولیدی' : 'Product / service type',
    whatsapp: T ? 'شماره تماس واتساپ' : 'WhatsApp number',
    city: T ? 'شهر' : 'City',
    country: T ? 'کشور' : 'Country',
    submit: T ? 'ثبت اطلاعات' : 'Submit',
    close: T ? 'بستن' : 'Close',
    saving: T ? 'در حال ثبت…' : 'Saving…',
    success: T ? 'اطلاعات شما با موفقیت ثبت شد. از بازدید شما سپاسگزاریم.' : 'Your details were saved. Thank you for visiting.',
    required: T ? 'لطفاً همه فیلدها را پر کنید.' : 'Please fill in all fields.',
    hint: T ? 'برای ورود به نمایشگاه اطلاعات خود را ثبت کنید.' : 'Register your details to enter the exhibition.',
  };

  const reset = () => {
    setFirstName(''); setLastName(''); setCompany(''); setProductService('');
    setWhatsapp(''); setCity(''); setCountry(''); setDone(false); setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fields = [firstName, lastName, company, productService, whatsapp, city, country];
    if (fields.some(f => !f.trim())) { setError(t.required); return; }
    setSaving(true);
    setError('');
    const reg: MetaExpoRegistration = {
      id: `mer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      bazaarId: bazaar.id,
      bazaarSlug: bazaar.slug,
      bazaarName: bazaar.name,
      visitorId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
      productService: productService.trim(),
      whatsapp: whatsapp.trim(),
      city: city.trim(),
      country: country.trim(),
      sessionId: getSessionId(),
      device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : (/Tablet|iPad/i.test(navigator.userAgent) ? 'tablet' : 'desktop'),
    };
    try {
      await saveMetaExpoRegistration(reg);
      const fullName = `${reg.firstName} ${reg.lastName}`;
      onTrack?.('registration_complete', { targetName: fullName, targetType: 'entrance_registration', targetId: reg.id });
      onSubmitted(fullName);
      setDone(true);
    } catch {
      setError(T ? 'خطا در ثبت. دوباره تلاش کنید.' : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fld = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-indigo-500 text-sm bg-white';
  const lbl = 'block text-xs font-bold text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        dir={T ? 'rtl' : 'ltr'}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">📝 {t.title}</h2>
            {!done && <p className="text-xs text-gray-500 mt-0.5">{t.hint}</p>}
          </div>
          <button type="button" onClick={handleClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-2">×</button>
        </div>

        {done ? (
          <div className="p-6 text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm text-gray-700 font-medium">{t.success}</p>
            <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700">{t.close}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>{t.firstName}</label><input className={fld} value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
              <div><label className={lbl}>{t.lastName}</label><input className={fld} value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
            </div>
            <div><label className={lbl}>{t.company}</label><input className={fld} value={company} onChange={e => setCompany(e.target.value)} required /></div>
            <div><label className={lbl}>{t.productService}</label><input className={fld} value={productService} onChange={e => setProductService(e.target.value)} required /></div>
            <div><label className={lbl}>{t.whatsapp}</label><input className={fld + ' dir-ltr'} value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+98…" required /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={lbl}>{t.city}</label><input className={fld} value={city} onChange={e => setCity(e.target.value)} required /></div>
              <div><label className={lbl}>{t.country}</label><input className={fld} value={country} onChange={e => setCountry(e.target.value)} required /></div>
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-colors">
              {saving ? t.saving : t.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

/** CSV export helper for admin — opens in Excel with UTF-8 BOM. */
export const exportExpoRegistrationsCSV = (rows: MetaExpoRegistration[], lang: Language, filename: string) => {
  if (!rows.length) return;
  const T = lang === 'fa';
  const headers = T
    ? ['تاریخ', 'نام', 'نام خانوادگی', 'شرکت', 'محصول/خدمت', 'واتساپ', 'شهر', 'کشور']
    : ['Date', 'First name', 'Last name', 'Company', 'Product/service', 'WhatsApp', 'City', 'Country'];
  const escape = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
  const csvRows = rows.map(r => [
    new Date(r.timestamp).toLocaleString(T ? 'fa-IR' : 'en-US'),
    r.firstName, r.lastName, r.company, r.productService, r.whatsapp, r.city, r.country,
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
