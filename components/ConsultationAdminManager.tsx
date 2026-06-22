import React, { useMemo, useState, useRef } from 'react';
import type { ConsultantCategory, Meeting, MeetingKind, Personnel, Price, Currency } from '../types';
import { Language } from '../App';
import {
  deleteMeetingFromCloud, saveMeetingToCloud, updateMeetingInCloud,
  confirmMeetingBooking, uploadFileWithProgress, updateConsultationFollowUp,
  saveConsultantCategoryToCloud, deleteConsultantCategoryFromCloud,
} from '../services/firebaseService';
import { IconCalendarClock, IconPlus, IconTrash, IconEdit } from './Icons';
import {
  getMeetingDisplayStatus, getMeetingSessionLabel, isBookableMeeting, MEETING_STATUS_STYLE,
} from '../utils/meetingBookingUtils';
import { categoryLabel, sortCategories } from '../utils/consultationTracking';
import { ALL_CURRENCIES, CUR_LABEL, normalizePrices } from '../utils/servicePriceList';
import { InvoiceAmountInput } from './InvoiceAmountInput';
import { toDateStr } from '../utils/weekCalendar';

interface Props {
  meetings: Meeting[];
  personnel: Personnel[];
  categories: ConsultantCategory[];
  currentUser: Personnel;
  lang: Language;
  shopBaseUrl?: string;
}

export const ConsultationAdminManager: React.FC<Props> = ({
  meetings, personnel, categories, currentUser, lang, shopBaseUrl,
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
  const [followUpText, setFollowUpText] = useState('');
  const [followUpFiles, setFollowUpFiles] = useState<{ id: string; name: string; url: string; uploadedAt: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);

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
    delete: fa ? 'حذف' : 'Delete',
    category: fa ? 'دسته موضوعی' : 'Category',
    pending: (n: number) => fa ? `${n} رزرو موقت` : `${n} temp.`,
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

  const openCreate = () => {
    setEditingId(null);
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
    const prices = m.prices?.length ? m.prices : m.price ? [m.price] : [];
    setForm({
      sessionType: m.sessionType || '',
      consultantId: m.consultantId || '',
      consultantName: m.consultantName || '',
      consultantBio: m.consultantBio || '',
      consultantPhoto: m.consultantPhoto || '',
      consultantCategoryId: m.consultantCategoryId || '',
      date: m.date,
      startTime: m.startTime,
      endTime: m.endTime,
      location: m.location || '',
      description: m.description || '',
      priceInputs: ALL_CURRENCIES.map(c => ({ currency: c, amount: prices.find(p => p.currency === c)?.amount || 0 })),
    });
    setFollowUpText(m.followUp?.recommendations || '');
    setFollowUpFiles(m.followUp?.attachments || []);
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

  const sortedSessions = useMemo(() =>
    [...bookableMeetings].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '')),
  [bookableMeetings]);

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden animate-fade-in">
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
              </div>
              <button type="button" onClick={() => openEdit(m)} className="p-2 rounded-lg hover:bg-white border border-gray-200"><IconEdit className="w-4 h-4 text-gray-600" /></button>
              <button type="button" onClick={() => window.confirm(fa ? 'حذف؟' : 'Delete?') && deleteMeetingFromCloud(m.id)} className="p-2 rounded-lg hover:bg-red-50 border border-gray-200"><IconTrash className="w-4 h-4 text-red-500" /></button>
            </div>
          );
        })}
        {sortedSessions.length === 0 && <p className="text-center text-sm text-gray-400 py-8">{fa ? 'جلسه‌ای ثبت نشده' : 'No sessions yet'}</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" dir={fa ? 'rtl' : 'ltr'}>
            <div className="sticky top-0 bg-violet-600 text-white px-5 py-3 rounded-t-2xl font-bold text-sm flex justify-between">
              <span>{editingId ? (fa ? 'ویرایش جلسه' : 'Edit session') : t.newSession}</span>
              <button type="button" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveSession} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">{fa ? 'نوع جلسه' : 'Session'} *</label>
                <input required className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.sessionType} onChange={e => setForm(p => ({ ...p, sessionType: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">{t.category}</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.consultantCategoryId} onChange={e => setForm(p => ({ ...p, consultantCategoryId: e.target.value }))}>
                  <option value="">—</option>
                  {sortedCats.map(c => <option key={c.id} value={c.id}>{categoryLabel(c, fa)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">{fa ? 'نام مشاور' : 'Consultant'} *</label>
                <input required className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.consultantName} onChange={e => setForm(p => ({ ...p, consultantName: e.target.value }))} />
              </div>
              <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form.consultantId} onChange={e => {
                const id = e.target.value;
                const p = activePersonnel.find(x => x.id === id);
                setForm(prev => ({ ...prev, consultantId: id, consultantName: p?.fullName || prev.consultantName, consultantBio: p?.consultantBio || prev.consultantBio, consultantPhoto: p?.avatar || prev.consultantPhoto }));
              }}>
                <option value="">{fa ? 'انتخاب از پرسنل' : 'Pick staff'}</option>
                {activePersonnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" required dir="ltr" className="px-3 py-2 border rounded-lg text-sm" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                <input type="time" required dir="ltr" className="px-3 py-2 border rounded-lg text-sm" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
                <input type="time" required dir="ltr" className="px-3 py-2 border rounded-lg text-sm col-span-2" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
              <textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={fa ? 'رزومه مشاور' : 'Bio'} value={form.consultantBio} onChange={e => setForm(p => ({ ...p, consultantBio: e.target.value }))} />

              {editingId && (meetings.find(m => m.id === editingId)?.guests?.length || 0) > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-600">{t.guests}</label>
                  <div className="space-y-1 mt-1 max-h-28 overflow-y-auto">
                    {(meetings.find(m => m.id === editingId)?.guests || []).map(g => (
                      <div key={g.id} className="text-xs border rounded-lg px-2 py-1.5 flex justify-between items-center">
                        <div>
                          <strong>{g.name}</strong> <span dir="ltr">{g.phone}</span>
                          {g.trackingCode && <span className="block text-violet-600 font-mono text-[10px]" dir="ltr">{g.trackingCode}</span>}
                        </div>
                        {isMasterOrAdmin && meetings.find(m => m.id === editingId)?.confirmedGuestId !== g.id && (
                          <button type="button" onClick={() => confirmMeetingBooking(editingId!, g.id, currentUser.fullName)} className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold">{t.confirm}</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editingId && meetings.find(m => m.id === editingId)?.confirmedGuestId && (
                <div className="border-t border-violet-100 pt-3 space-y-2">
                  <label className="text-xs font-bold text-violet-800">{t.followUp}</label>
                  <textarea rows={5} className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm" value={followUpText} onChange={e => setFollowUpText(e.target.value)} placeholder={fa ? 'پیشنهادات، اقدامات بعدی، لینک‌ها…' : 'Recommendations, next steps…'} />
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
                  <button type="button" disabled={uploadingFile} onClick={() => fileRef.current?.click()} className="text-xs text-violet-600 font-bold">{uploadingFile ? '…' : (fa ? '+ ضمیمه فایل' : '+ Attach file')}</button>
                  {followUpFiles.map(f => (
                    <div key={f.id} className="text-xs flex justify-between bg-gray-50 px-2 py-1 rounded">📎 {f.name}
                      <button type="button" onClick={() => setFollowUpFiles(prev => prev.filter(x => x.id !== f.id))} className="text-red-500">×</button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => publishFollowUp(editingId, false)} className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-xs font-bold">{t.publishFollowUp}</button>
                    <button type="button" onClick={() => publishFollowUp(editingId, true)} className="flex-1 py-2 rounded-lg border border-violet-300 text-violet-700 text-xs font-bold">{t.markDone}</button>
                  </div>
                </div>
              )}

              <button type="submit" className="w-full py-2.5 rounded-lg bg-gray-900 text-white font-bold text-sm">{t.save}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
