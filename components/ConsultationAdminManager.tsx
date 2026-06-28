import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { AppConfig, ConsultantCategory, Meeting, MeetingKind, Personnel, Price, Currency } from '../types';
import { Language } from '../App';
import {
  deleteMeetingFromCloud, saveMeetingToCloud, updateMeetingInCloud,
  confirmMeetingBooking, uploadFileWithProgress, updateConsultationFollowUp,
  saveConsultantCategoryToCloud, deleteConsultantCategoryFromCloud,
} from '../services/firebaseService';
import { IconCalendarClock, IconPlus, IconTrash, IconEdit, IconCopy } from './Icons';
import { AppModal, modalFieldInput, modalFieldLabel, modalFieldTextarea } from './AppModal';
import {
  getMeetingDisplayStatus, getMeetingSessionLabel, isBookableMeeting, MEETING_STATUS_STYLE, meetingPrices,
} from '../utils/meetingBookingUtils';
import { categoryLabel, sortCategories } from '../utils/consultationTracking';
import { ALL_CURRENCIES, CUR_LABEL, formatPriceAmount, normalizePrices } from '../utils/servicePriceList';
import { InvoiceAmountInput } from './InvoiceAmountInput';
import { toDateStr, parseDateLocal } from '../utils/weekCalendar';
import {
  DEFAULT_CONSULTATION_PUBLIC_NOTICE_EN,
  DEFAULT_CONSULTATION_PUBLIC_NOTICE_FA,
} from '../utils/consultationPublicNotice';

interface Props {
  meetings: Meeting[];
  personnel: Personnel[];
  categories: ConsultantCategory[];
  currentUser: Personnel;
  lang: Language;
  shopBaseUrl?: string;
  /** داخل تقویم جلسات — بدون کادر بیرونی تکراری */
  embedded?: boolean;
  config?: AppConfig;
  onUpdateConfig?: (config: AppConfig) => void | Promise<void>;
}

export const ConsultationAdminManager: React.FC<Props> = ({
  meetings, personnel, categories, currentUser, lang, shopBaseUrl, embedded = false, config, onUpdateConfig,
}) => {
  const fa = lang === 'fa';
  const isMasterOrAdmin = currentUser.username === 'master' || (currentUser.roles || []).includes('مدیر');
  const bookableMeetings = useMemo(() => meetings.filter(isBookableMeeting), [meetings]);
  const sortedCats = useMemo(() => sortCategories(categories), [categories]);
  const activePersonnel = personnel.filter(p => (p.status || 'active') === 'active');

  const [catForm, setCatForm] = useState({ nameFa: '', nameEn: '', icon: '' });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpFiles, setFollowUpFiles] = useState<{ id: string; name: string; url: string; uploadedAt: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [noticeFa, setNoticeFa] = useState('');
  const [noticeEn, setNoticeEn] = useState('');
  const [savingNotice, setSavingNotice] = useState(false);
  const [noticeSaved, setNoticeSaved] = useState(false);

  useEffect(() => {
    setNoticeFa(config?.consultationPublicNoticeFa?.trim() || DEFAULT_CONSULTATION_PUBLIC_NOTICE_FA);
    setNoticeEn(config?.consultationPublicNoticeEn?.trim() || DEFAULT_CONSULTATION_PUBLIC_NOTICE_EN);
  }, [config?.consultationPublicNoticeFa, config?.consultationPublicNoticeEn]);

  const emptyPrices = () => ALL_CURRENCIES.map(c => ({ currency: c, amount: 0 }));
  const [form, setForm] = useState({
    sessionType: '', consultantId: '', consultantName: '', consultantBio: '', consultantPhoto: '',
    consultantCategoryId: '', date: toDateStr(new Date()), startTime: '09:00', endTime: '10:00',
    location: '', description: '', priceInputs: emptyPrices(),
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const t = {
    title: fa ? 'مشاوره عمومی' : 'Public consultations',
    categories: fa ? 'دسته‌بندی موضوعی' : 'Topic categories',
    addCat: fa ? 'افزودن دسته' : 'Add category',
    nameFa: fa ? 'نام فارسی' : 'Persian name',
    nameEn: fa ? 'نام انگلیسی' : 'English name',
    icon: fa ? 'آیکون (اختیاری)' : 'Icon (optional)',
    sessions: fa ? 'جلسات قابل رزرو' : 'Bookable sessions',
    newSession: fa ? 'جلسه جدید' : 'New session',
    publicLink: fa ? 'لینک رزرو عمومی' : 'Public booking link',
    trackLink: fa ? 'لینک پیگیری' : 'Tracking page link',
    copied: fa ? 'کپی شد ✓' : 'Copied ✓',
    followUp: fa ? 'پیشنهادات پس از جلسه' : 'Post-session recommendations',
    publishFollowUp: fa ? 'انتشار برای مهمان' : 'Publish to guest',
    markDone: fa ? 'جلسه برگزار شد' : 'Mark session completed',
    guests: fa ? 'درخواست‌های رزرو' : 'Booking requests',
    confirm: fa ? 'قطعی' : 'Confirm',
    save: fa ? 'ذخیره' : 'Save',
    cancel: fa ? 'انصراف' : 'Cancel',
    delete: fa ? 'حذف' : 'Delete',
    duplicate: fa ? 'کپی' : 'Duplicate',
    duplicateSession: fa ? 'کپی جلسه' : 'Duplicate session',
    publicNotice: fa ? 'توضیحات صفحه رزرو عمومی' : 'Public booking page notice',
    publicNoticeHint: fa ? 'این متن بالای لیست جلسات در لینک عمومی نمایش داده می‌شود.' : 'Shown above the session list on the public booking link.',
    resetNotice: fa ? 'بازنشانی پیش‌فرض' : 'Reset to default',
    saveNotice: fa ? 'ذخیره توضیحات' : 'Save notice',
    noticeSaved: fa ? 'ذخیره شد ✓' : 'Saved ✓',
    category: fa ? 'دسته موضوعی' : 'Category',
    fee: fa ? 'هزینه مشاوره (چند ارزی)' : 'Consultation fee (multi-currency)',
    feeHint: fa ? 'فقط ارزهایی که مبلغ دارند در لینک عمومی نمایش داده می‌شوند' : 'Only filled currencies appear on the public booking page',
    pending: (n: number) => fa ? `${n} رزرو موقت` : `${n} temp.`,
  };

  const setPriceAmount = (idx: number, amount: number) => {
    setForm(prev => {
      const next = [...prev.priceInputs];
      next[idx] = { ...next[idx], amount };
      return { ...prev, priceInputs: next };
    });
  };

  const saveCategory = async () => {
    if (!catForm.nameFa.trim()) return;
    const id = editingCatId || `cat-${Date.now()}`;
    await saveConsultantCategoryToCloud({
      id,
      nameFa: catForm.nameFa.trim(),
      nameEn: catForm.nameEn.trim() || catForm.nameFa.trim(),
      icon: catForm.icon.trim() || undefined,
      sortOrder: editingCatId ? categories.find(c => c.id === editingCatId)?.sortOrder : categories.length,
    });
    setCatForm({ nameFa: '', nameEn: '', icon: '' });
    setEditingCatId(null);
  };

  const fillFormFromMeeting = (m: Meeting, dateOverride?: string) => {
    const prices = m.prices?.length ? m.prices : m.price ? [m.price] : [];
    setForm({
      sessionType: m.sessionType || '',
      consultantId: m.consultantId || '',
      consultantName: m.consultantName || '',
      consultantBio: m.consultantBio || '',
      consultantPhoto: m.consultantPhoto || '',
      consultantCategoryId: m.consultantCategoryId || '',
      date: dateOverride ?? m.date,
      startTime: m.startTime,
      endTime: m.endTime,
      location: m.location || '',
      description: m.description || '',
      priceInputs: ALL_CURRENCIES.map(c => ({ currency: c, amount: prices.find(p => p.currency === c)?.amount || 0 })),
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setDuplicateMode(false);
    setForm({
      sessionType: '', consultantId: '', consultantName: '', consultantBio: '', consultantPhoto: '',
      consultantCategoryId: sortedCats[0]?.id || '', date: toDateStr(new Date()),
      startTime: '09:00', endTime: '10:00', location: '', description: '', priceInputs: emptyPrices(),
    });
    setFollowUpText('');
    setFollowUpFiles([]);
    setShowModal(true);
  };

  const openEdit = (m: Meeting) => {
    setEditingId(m.id);
    setDuplicateMode(false);
    fillFormFromMeeting(m);
    setFollowUpText(m.followUp?.recommendations || '');
    setFollowUpFiles(m.followUp?.attachments || []);
    setShowModal(true);
  };

  const openDuplicate = (m: Meeting) => {
    setEditingId(null);
    setDuplicateMode(true);
    const nextWeek = parseDateLocal(m.date);
    nextWeek.setDate(nextWeek.getDate() + 7);
    fillFormFromMeeting(m, toDateStr(nextWeek));
    setFollowUpText('');
    setFollowUpFiles([]);
    setShowModal(true);
  };

  const pricesFromForm = (): { prices: Price[]; price?: Price } => {
    const raw = form.priceInputs.map(p => ({ currency: p.currency as Currency, amount: p.amount || 0 })).filter(p => p.amount > 0);
    return normalizePrices(raw);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sessionType.trim() || !form.consultantName.trim()) return;
    const { prices, price } = pricesFromForm();
    const id = editingId || `meet-${Date.now()}`;
    const payload: Meeting = {
      id,
      title: form.sessionType.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location,
      organizerId: currentUser.id,
      organizerName: currentUser.fullName,
      attendeeIds: [],
      description: form.description,
      kind: 'bookable' as MeetingKind,
      sessionType: form.sessionType.trim(),
      consultantId: form.consultantId || undefined,
      consultantName: form.consultantName.trim(),
      consultantBio: form.consultantBio.trim() || undefined,
      consultantPhoto: form.consultantPhoto || undefined,
      consultantCategoryId: form.consultantCategoryId || undefined,
      prices: prices.length ? prices : undefined,
      price,
      bookingStatus: editingId ? meetings.find(m => m.id === editingId)?.bookingStatus || 'open' : 'open',
      guests: editingId ? meetings.find(m => m.id === editingId)?.guests : [],
      confirmedGuestId: editingId ? meetings.find(m => m.id === editingId)?.confirmedGuestId : undefined,
      followUp: editingId ? meetings.find(m => m.id === editingId)?.followUp : undefined,
    };
    if (editingId) await updateMeetingInCloud(editingId, payload, currentUser.fullName);
    else await saveMeetingToCloud({ ...payload, guests: [], bookingStatus: 'open' });
    setShowModal(false);
    setDuplicateMode(false);
  };

  const publishFollowUp = async (meetingId: string, markCompleted?: boolean) => {
    await updateConsultationFollowUp(meetingId, {
      recommendations: followUpText.trim(),
      attachments: followUpFiles,
      publishedAt: new Date().toISOString(),
      publishedBy: currentUser.fullName,
    }, currentUser.fullName, markCompleted);
    setShowModal(false);
  };

  const copyUrl = async (page: 'booking' | 'consultation-track') => {
    const base = (shopBaseUrl || `${window.location.origin}${window.location.pathname}`).replace(/\?.*$/, '').replace(/\/$/, '');
    const url = `${base}?page=${page}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {}
  };

  const savePublicNotice = async () => {
    if (!config || !onUpdateConfig) return;
    setSavingNotice(true);
    try {
      await onUpdateConfig({
        ...config,
        consultationPublicNoticeFa: noticeFa.trim(),
        consultationPublicNoticeEn: noticeEn.trim(),
      });
      setNoticeSaved(true);
      setTimeout(() => setNoticeSaved(false), 1800);
    } finally {
      setSavingNotice(false);
    }
  };

  const resetPublicNotice = () => {
    setNoticeFa(DEFAULT_CONSULTATION_PUBLIC_NOTICE_FA);
    setNoticeEn(DEFAULT_CONSULTATION_PUBLIC_NOTICE_EN);
  };

  const sortedSessions = useMemo(() =>
    [...bookableMeetings].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')),
  [bookableMeetings]);

  return (
    <div className={`flex flex-col flex-1 ${embedded ? 'bg-white rounded-2xl border border-gray-200 shadow-xl' : 'bg-white rounded-2xl border border-gray-200 shadow-xl'}`} style={embedded ? { minHeight: 'calc(100vh - 200px)' } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 bg-violet-50">
        <div className="flex items-center gap-2">
          <IconCalendarClock className="w-5 h-5 text-violet-600" />
          <span className="font-bold text-gray-800">{t.title}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copyUrl('booking')} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-violet-600 text-white">{copiedLink ? t.copied : t.publicLink}</button>
          <button type="button" onClick={() => copyUrl('consultation-track')} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700">{t.trackLink}</button>
          <button type="button" onClick={openCreate} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-gray-900 text-white flex items-center gap-1"><IconPlus className="w-3.5 h-3.5" />{t.newSession}</button>
        </div>
      </div>

      {config && onUpdateConfig && (
        <div className="p-4 border-b border-violet-100 bg-violet-50/50 space-y-3">
          <div>
            <h3 className="text-xs font-black text-violet-800 uppercase">{t.publicNotice}</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{t.publicNoticeHint}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label className={modalFieldLabel}>{fa ? 'متن فارسی' : 'Persian'}</label>
              <textarea
                className={`${modalFieldTextarea} min-h-[108px] text-sm leading-relaxed`}
                value={noticeFa}
                onChange={e => setNoticeFa(e.target.value)}
                dir="rtl"
              />
            </div>
            <div>
              <label className={modalFieldLabel}>{fa ? 'متن انگلیسی' : 'English'}</label>
              <textarea
                className={`${modalFieldTextarea} min-h-[108px] text-sm leading-relaxed`}
                value={noticeEn}
                onChange={e => setNoticeEn(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={savePublicNotice}
              disabled={savingNotice}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-60"
            >
              {noticeSaved ? t.noticeSaved : savingNotice ? (fa ? 'در حال ذخیره…' : 'Saving…') : t.saveNotice}
            </button>
            <button type="button" onClick={resetPublicNotice} className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 bg-white">
              {t.resetNotice}
            </button>
          </div>
        </div>
      )}

      <div className="p-4 border-b border-gray-100 space-y-3">
        <h3 className="text-xs font-black text-gray-500 uppercase">{t.categories}</h3>
        <div className="flex flex-wrap gap-2">
          {sortedCats.map(cat => (
            <div key={cat.id} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-sm">
              <span>{cat.icon} {categoryLabel(cat, fa)}</span>
              <button type="button" onClick={() => { setEditingCatId(cat.id); setCatForm({ nameFa: cat.nameFa, nameEn: cat.nameEn, icon: cat.icon || '' }); }} className="text-violet-600 p-0.5"><IconEdit className="w-3 h-3" /></button>
              <button type="button" onClick={() => window.confirm(fa ? 'حذف دسته؟' : 'Delete?') && deleteConsultantCategoryFromCloud(cat.id)} className="text-red-500 p-0.5"><IconTrash className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <input className="px-2 py-1.5 border rounded-lg text-sm flex-1 min-w-[120px]" placeholder={t.nameFa} value={catForm.nameFa} onChange={e => setCatForm(p => ({ ...p, nameFa: e.target.value }))} />
          <input className="px-2 py-1.5 border rounded-lg text-sm flex-1 min-w-[120px]" placeholder={t.nameEn} value={catForm.nameEn} onChange={e => setCatForm(p => ({ ...p, nameEn: e.target.value }))} />
          <input className="px-2 py-1.5 border rounded-lg text-sm w-20" placeholder={t.icon} value={catForm.icon} onChange={e => setCatForm(p => ({ ...p, icon: e.target.value }))} />
          <button type="button" onClick={saveCategory} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold">{editingCatId ? t.save : t.addCat}</button>
        </div>
      </div>

      <div className="p-4 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto">
        {sortedSessions.map(m => {
          const st = getMeetingDisplayStatus(m);
          const style = st !== 'internal' ? MEETING_STATUS_STYLE[st as 'open' | 'pending' | 'confirmed'] : null;
          const cat = sortedCats.find(c => c.id === m.consultantCategoryId);
          const guestCount = m.guests?.length || 0;
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/30">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  {style && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded text-white ${style.bg}`}>{fa ? style.labelFa : style.labelEn}</span>}
                  {cat && <span className="text-[10px] text-violet-600 font-bold">{categoryLabel(cat, fa)}</span>}
                  {guestCount > 0 && st !== 'confirmed' && (
                    <span className="text-[10px] font-bold text-orange-600">{t.pending(guestCount)}</span>
                  )}
                  {m.followUp?.publishedAt && <span className="text-[9px] text-emerald-600">✓ {t.followUp}</span>}
                </div>
                <div className="font-bold text-sm text-gray-900">{getMeetingSessionLabel(m, fa ? 'fa' : 'en')}</div>
                <div className="text-xs text-gray-500">{m.consultantName} · <span dir="ltr">{m.date} {m.startTime}–{m.endTime}</span></div>
                {meetingPrices(m).length > 0 && (
                  <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                    {meetingPrices(m).map(p => formatPriceAmount(p.amount, p.currency, fa ? 'fa' : 'en')).join(' · ')}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => openEdit(m)} className="p-2 rounded-lg hover:bg-white border border-gray-200" title={fa ? 'ویرایش' : 'Edit'}><IconEdit className="w-4 h-4 text-gray-600" /></button>
              <button type="button" onClick={() => openDuplicate(m)} className="p-2 rounded-lg hover:bg-violet-50 border border-gray-200" title={t.duplicate}><IconCopy className="w-4 h-4 text-violet-600" /></button>
              <button type="button" onClick={() => window.confirm(fa ? 'حذف؟' : 'Delete?') && deleteMeetingFromCloud(m.id)} className="p-2 rounded-lg hover:bg-red-50 border border-gray-200" title={t.delete}><IconTrash className="w-4 h-4 text-red-500" /></button>
            </div>
          );
        })}
        {sortedSessions.length === 0 && <p className="text-center text-sm text-gray-400 py-8">{fa ? 'جلسه‌ای ثبت نشده' : 'No sessions yet'}</p>}
      </div>

      <AppModal
        open={showModal}
        onClose={() => { setShowModal(false); setDuplicateMode(false); }}
        title={editingId ? (fa ? 'ویرایش جلسه' : 'Edit session') : duplicateMode ? t.duplicateSession : t.newSession}
        dir={fa ? 'rtl' : 'ltr'}
        footer={(
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => { setShowModal(false); setDuplicateMode(false); }}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              form="consultation-session-form"
              className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-colors"
            >
              {t.save}
            </button>
          </div>
        )}
      >
        <form id="consultation-session-form" onSubmit={handleSaveSession} className="space-y-4">
          <div>
            <label className={modalFieldLabel}>{fa ? 'نوع جلسه' : 'Session'} *</label>
            <input required className={modalFieldInput} value={form.sessionType} onChange={e => setForm(p => ({ ...p, sessionType: e.target.value }))} />
          </div>
          <div>
            <label className={modalFieldLabel}>{t.category}</label>
            <select className={modalFieldInput} value={form.consultantCategoryId} onChange={e => setForm(p => ({ ...p, consultantCategoryId: e.target.value }))}>
              <option value="">—</option>
              {sortedCats.map(c => <option key={c.id} value={c.id}>{categoryLabel(c, fa)}</option>)}
            </select>
          </div>
          <div>
            <label className={modalFieldLabel}>{fa ? 'نام مشاور' : 'Consultant'} *</label>
            <input required className={modalFieldInput} value={form.consultantName} onChange={e => setForm(p => ({ ...p, consultantName: e.target.value }))} />
          </div>
          <div>
            <label className={modalFieldLabel}>{fa ? 'انتخاب از پرسنل' : 'Pick staff'}</label>
            <select className={modalFieldInput} value={form.consultantId} onChange={e => {
              const id = e.target.value;
              const p = activePersonnel.find(x => x.id === id);
              setForm(prev => ({ ...prev, consultantId: id, consultantName: p?.fullName || prev.consultantName, consultantBio: p?.consultantBio || prev.consultantBio, consultantPhoto: p?.avatar || prev.consultantPhoto }));
            }}>
              <option value="">—</option>
              {activePersonnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className={modalFieldLabel}>{fa ? 'رزومه مشاور' : 'Consultant bio'}</label>
            <textarea rows={2} className={modalFieldTextarea} placeholder={fa ? 'رزومه مشاور' : 'Bio'} value={form.consultantBio} onChange={e => setForm(p => ({ ...p, consultantBio: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalFieldLabel}>{fa ? 'تاریخ' : 'Date'}</label>
              <input type="date" required dir="ltr" className={modalFieldInput} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className={modalFieldLabel}>{fa ? 'شروع' : 'Start'}</label>
              <input type="time" required dir="ltr" className={modalFieldInput} value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className={modalFieldLabel}>{fa ? 'پایان' : 'End'}</label>
              <input type="time" required dir="ltr" className={modalFieldInput} value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={modalFieldLabel}>{fa ? 'سرفصل / توضیحات جلسه' : 'Session agenda / details'}</label>
            <textarea rows={2} className={modalFieldTextarea} placeholder={fa ? 'سرفصل و جزئیات جلسه برای نمایش در لینک عمومی…' : 'Agenda shown on public booking page…'} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div>
            <label className={modalFieldLabel}>{t.fee}</label>
            <p className="text-[10px] text-gray-400 mb-2">{t.feeHint}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {form.priceInputs.map((p, idx) => (
                <div key={p.currency} className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-medium text-gray-600 w-[4.5rem] shrink-0">
                    {CUR_LABEL[p.currency as Currency][fa ? 'fa' : 'en']}
                  </span>
                  <InvoiceAmountInput
                    value={p.amount}
                    maxDecimals={p.currency === 'IRR' ? 0 : 2}
                    className={`${modalFieldInput} flex-1 !py-2 dir-ltr text-left`}
                    placeholder="0"
                    onChange={n => setPriceAmount(idx, n)}
                  />
                </div>
              ))}
            </div>
          </div>

          {editingId && (meetings.find(m => m.id === editingId)?.guests?.length || 0) > 0 && (
            <div>
              <label className={modalFieldLabel}>{t.guests}</label>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {(meetings.find(m => m.id === editingId)?.guests || []).map(g => (
                  <div key={g.id} className="text-xs border border-gray-100 rounded-xl px-3 py-2 flex justify-between items-center bg-gray-50/80">
                    <div>
                      <strong>{g.name}</strong> <span dir="ltr">{g.phone}</span>
                      {g.trackingCode && <span className="block text-violet-600 font-mono text-[10px]" dir="ltr">{g.trackingCode}</span>}
                    </div>
                    {isMasterOrAdmin && meetings.find(m => m.id === editingId)?.confirmedGuestId !== g.id && (
                      <button type="button" onClick={() => confirmMeetingBooking(editingId!, g.id, currentUser.fullName)} className="text-[10px] bg-gray-900 text-white px-2 py-0.5 rounded-lg font-bold">{t.confirm}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingId && meetings.find(m => m.id === editingId)?.confirmedGuestId && (
            <div className="border-t border-gray-100 pt-4 space-y-2">
              <label className={modalFieldLabel}>{t.followUp}</label>
              <textarea rows={4} className={modalFieldTextarea} value={followUpText} onChange={e => setFollowUpText(e.target.value)} placeholder={fa ? 'پیشنهادات، اقدامات بعدی، لینک‌ها…' : 'Recommendations, next steps…'} />
              <input ref={fileRef} type="file" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingFile(true);
                uploadFileWithProgress(file, () => {}, url => {
                  setFollowUpFiles(prev => [...prev, { id: `f-${Date.now()}`, name: file.name, url, uploadedAt: new Date().toISOString() }]);
                  setUploadingFile(false);
                }, () => setUploadingFile(false), 'documents');
                e.target.value = '';
              }} />
              <button type="button" disabled={uploadingFile} onClick={() => fileRef.current?.click()} className="text-xs text-gray-600 font-medium hover:text-gray-900">{uploadingFile ? '…' : (fa ? '+ ضمیمه فایل' : '+ Attach file')}</button>
              {followUpFiles.map(f => (
                <div key={f.id} className="text-xs flex justify-between bg-gray-50 px-2 py-1 rounded-lg">📎 {f.name}
                  <button type="button" onClick={() => setFollowUpFiles(prev => prev.filter(x => x.id !== f.id))} className="text-red-500">×</button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => publishFollowUp(editingId, false)} className="flex-1 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold">{t.publishFollowUp}</button>
                <button type="button" onClick={() => publishFollowUp(editingId, true)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold">{t.markDone}</button>
              </div>
            </div>
          )}
        </form>
      </AppModal>
    </div>
  );
};
