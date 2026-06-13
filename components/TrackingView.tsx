
import React, { useState, useRef, useEffect } from 'react';
import { Ticket, TicketStatus, ServiceOption, AttachedFile, AppConfig, InternalMessage, MetaShopOrder } from '../types';
import { IconSearch, IconCheck, IconFile, IconActivity, IconCopy, IconUpload, IconTrash, IconSend, IconClock, IconMail, IconReply } from './Icons';
import { Language } from '../App';
import { uploadFileWithProgress, getTicketById } from '../services/firebaseService';

interface Props {
  tickets: Ticket[];
  services: ServiceOption[];
  lang: Language;
  config?: AppConfig;
  onCustomerUpload?: (ticketId: string, message: string, files: AttachedFile[]) => Promise<void>;
  onContactSubmit?: (data: { name: string; phone: string; departmentId: string; message: string }) => Promise<string | void>;
  lookupContactMessages?: (name: string, phone: string) => InternalMessage[];
  lookupContactByCode?: (code: string) => InternalMessage | null;
  lookupShopOrder?: (trackingCode: string) => Promise<MetaShopOrder[]>; // look up a Meta Shop order by its tracking code (SHP-...)
  openContactTick?: number; // bumped by the parent to switch to the "Contact Us" tab
}

export const TrackingView: React.FC<Props> = ({ tickets, services, lang, config, onCustomerUpload, onContactSubmit, lookupContactMessages, lookupContactByCode, lookupShopOrder, openContactTick }) => {
  const [tab, setTab] = useState<'track' | 'recover' | 'contact'>('track');

  // When the parent requests the Contact Us tab (e.g. from the header nav), switch to it
  useEffect(() => { if (openContactTick) setTab('contact'); }, [openContactTick]);
  const [searchId, setSearchId] = useState('');
  const [foundTicket, setFoundTicket] = useState<Ticket | null>(null);
  const [foundOrder, setFoundOrder] = useState<MetaShopOrder | null>(null); // Meta Shop order found by tracking code
  const [trackError, setTrackError] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [recoverName, setRecoverName] = useState('');
  const [recoverPhone, setRecoverPhone] = useState('');
  const [recoveredTickets, setRecoveredTickets] = useState<Ticket[] | null>(null);
  const [recoveredContacts, setRecoveredContacts] = useState<InternalMessage[] | null>(null);
  const [recoverError, setRecoverError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Customer upload window state
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadFiles, setUploadFiles] = useState<AttachedFile[]>([]);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  // Contact-us state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactDept, setContactDept] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);
  const [sentTrackingCode, setSentTrackingCode] = useState('');
  const [contactThreads, setContactThreads] = useState<InternalMessage[] | null>(null);
  const [foundContact, setFoundContact] = useState<InternalMessage | null>(null); // correspondence found by code in the track tab

  // Only departments the master has chosen to expose in the Contact Us form (undefined = shown, for backward compatibility)
  const departments = (config?.departments || []).filter(d => d.showInContact !== false);

  const MAX_UPLOAD_MB = 20;
  const MAX_FILES = 5;

  const t = {
    fa: {
      trackTab: 'پیگیری با کد رهگیری', recoverTab: 'بازیابی کد رهگیری',
      trackTitle: 'پیگیری وضعیت درخواست',
      trackDesc: 'کد رهگیری پرونده، سفارش فروشگاه (SHP-...) یا مکاتبه (MK-...) را وارد کنید.',
      placeholder: 'کد رهگیری — مثال: EXP-4829 یا SHP-1234-AB7C', search: 'جستجو',
      notFound: 'درخواستی با این کد یافت نشد.',
      orderTitle: 'سفارش فروشگاه شما', orderShop: 'فروشگاه', orderDate: 'تاریخ سفارش', orderItemsT: 'اقلام سفارش', orderTotal: 'جمع کل',
      orderNegotiable: 'قابل مذاکره',
      orderStatus: { new: 'ثبت شد', in_progress: 'در حال انجام', done: 'انجام شد', cancelled: 'لغو شد' } as Record<string, string>,
      recoverTitle: 'بازیابی کد رهگیری',
      recoverDesc: 'نام و شماره موبایلی که هنگام ثبت درخواست وارد کردید را بنویسید.',
      namePlaceholder: 'نام و نام خانوادگی', phonePlaceholder: 'شماره موبایل — مثال: 09120000000',
      recoverBtn: 'بازیابی', recoverNotFound: 'درخواستی با این مشخصات یافت نشد.',
      recoverFound: 'کدهای رهگیری شما:', copy: 'کپی', copied: 'کپی شد',
      recoverTypeRequest: 'درخواست', recoverTypeContact: 'مکاتبه',
      number: 'شماره پرونده', applicant: 'متقاضی', service: 'سرویس',
      date: 'تاریخ ثبت', priority: 'اولویت', files: 'فایل‌های پیوست',
      steps: ['ثبت درخواست', 'ارزیابی اولیه', 'در دست اقدام', 'تکمیل شد'],
      currentStep: 'پرونده در این مرحله است.', completedStep: 'انجام شد.', pendingStep: 'در انتظار...',
      historyTitle: 'تاریخچه پرونده', historyEmpty: 'هنوز رویدادی ثبت نشده است.',
      viewTicket: 'مشاهده وضعیت',
      contactTab: 'تماس با ما',
      contactTitle: 'مکاتبه مستقیم با دپارتمان‌های پلتفرم صادراتی توحید دیهمی',
      contactDesc: 'دپارتمان موردنظر را انتخاب کنید و پیام خود را بفرستید. پاسخ را با همین نام و شماره موبایل از همین صفحه پیگیری کنید.',
      contactDept: 'دپارتمان',
      contactDeptPlaceholder: '— انتخاب دپارتمان —',
      contactMsg: 'متن پیام',
      contactMsgPlaceholder: 'پیام خود را بنویسید...',
      contactSend: 'ارسال پیام',
      contactSending: 'در حال ارسال...',
      contactSent: 'پیام شما ثبت شد. کارشناسان دپارتمان مربوطه پاسخ خواهند داد.',
      contactNoDepts: 'در حال حاضر دپارتمانی برای ارتباط تعریف نشده است.',
      contactIncomplete: 'لطفاً همه فیلدها (نام، موبایل، دپارتمان و پیام) را تکمیل کنید.',
      contactError: 'خطا در ارسال. دوباره تلاش کنید.',
      contactMyMessages: 'پیام‌ها و پاسخ‌های من',
      contactLookup: 'مشاهده پاسخ‌ها',
      contactNoThreads: 'پیامی با این نام و شماره موبایل یافت نشد.',
      contactReplies: 'پاسخ‌ها',
      contactNoReply: 'هنوز پاسخی ثبت نشده است.',
      contactYou: 'شما',
      contactTracking: 'کد رهگیری مکاتبه:',
      contactTrackHint: 'این کد را نگه دارید؛ از همین بخش «پیگیری درخواست» می‌توانید با وارد کردن آن، پاسخ‌های مکاتبه را ببینید.',
      trackContactTitle: 'مکاتبه شما',
      trackContactNotFound: 'مکاتبه‌ای با این کد رهگیری یافت نشد.',
    },
    en: {
      trackTab: 'Track by ID', recoverTab: 'Recover Tracking ID',
      trackTitle: 'Track Your Request',
      trackDesc: 'Enter a case tracking ID, a shop order code (SHP-...) or a correspondence code (MK-...).',
      placeholder: 'Tracking ID — e.g. EXP-4829 or SHP-1234-AB7C', search: 'Search',
      notFound: 'No application found with this ID.',
      orderTitle: 'Your shop order', orderShop: 'Shop', orderDate: 'Order date', orderItemsT: 'Order items', orderTotal: 'Total',
      orderNegotiable: 'Negotiable',
      orderStatus: { new: 'Received', in_progress: 'In progress', done: 'Completed', cancelled: 'Cancelled' } as Record<string, string>,
      recoverTitle: 'Recover Tracking ID',
      recoverDesc: 'Enter the name and phone number you used when submitting your request.',
      namePlaceholder: 'Full Name', phonePlaceholder: 'Phone Number — e.g. +1 555 000 0000',
      recoverBtn: 'Recover', recoverNotFound: 'No requests found with these details.',
      recoverFound: 'Your tracking codes:', copy: 'Copy', copied: 'Copied',
      recoverTypeRequest: 'Request', recoverTypeContact: 'Correspondence',
      number: 'Case ID', applicant: 'Applicant', service: 'Service',
      date: 'Date', priority: 'Priority', files: 'Attachments',
      steps: ['Submitted', 'Under Review', 'In Progress', 'Completed'],
      currentStep: 'Your case is at this stage.', completedStep: 'Done.', pendingStep: 'Pending...',
      historyTitle: 'Case History', historyEmpty: 'No events recorded yet.',
      viewTicket: 'View Status',
      contactTab: 'Contact Us',
      contactTitle: 'Contact a Department',
      contactDesc: 'Choose a department and send your message. Track the reply from this page using the same name and mobile number.',
      contactDept: 'Department',
      contactDeptPlaceholder: '— Select a department —',
      contactMsg: 'Message',
      contactMsgPlaceholder: 'Write your message...',
      contactSend: 'Send Message',
      contactSending: 'Sending...',
      contactSent: 'Your message was received. The department staff will reply.',
      contactNoDepts: 'No departments are available for contact at the moment.',
      contactIncomplete: 'Please complete all fields (name, mobile, department and message).',
      contactError: 'Submission failed. Please try again.',
      contactMyMessages: 'My messages & replies',
      contactLookup: 'View replies',
      contactNoThreads: 'No messages found with this name and mobile number.',
      contactReplies: 'Replies',
      contactNoReply: 'No reply yet.',
      contactYou: 'You',
      contactTracking: 'Correspondence tracking code:',
      contactTrackHint: 'Keep this code. You can view the replies anytime from the "Track" tab by entering it.',
      trackContactTitle: 'Your correspondence',
      trackContactNotFound: 'No correspondence found with this tracking code.',
    },
  }[lang];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchId.trim();
    if (!clean) return;

    // Correspondence tracking code (MK-...) → look up the conversation instead of a ticket
    if (/^mk-/i.test(clean) && lookupContactByCode) {
      const msg = lookupContactByCode(clean);
      setFoundTicket(null); setFoundOrder(null);
      if (msg) { setFoundContact(msg); setTrackError(''); }
      else { setFoundContact(null); setTrackError(t.trackContactNotFound); }
      return;
    }
    setFoundContact(null);

    // Meta Shop order tracking code (SHP-...) → look up the shop order
    if (/^shp-/i.test(clean) && lookupShopOrder) {
      setTrackLoading(true); setFoundTicket(null); setFoundOrder(null); setTrackError('');
      try {
        const orders = await lookupShopOrder(clean.toUpperCase());
        if (orders.length) setFoundOrder(orders[0]);
        else setTrackError(t.notFound);
      } catch {
        setTrackError(lang === 'fa' ? 'خطا در اتصال. دوباره تلاش کنید.' : 'Connection error. Please try again.');
      } finally { setTrackLoading(false); }
      return;
    }

    // Try local list first (instant if already loaded)
    const local = tickets.find(tk =>
      tk.id.toLowerCase() === clean.toLowerCase() ||
      tk.id.toLowerCase() === `exp-${clean.toLowerCase()}`
    );
    if (local) { setFoundTicket(local); setFoundOrder(null); setTrackError(''); return; }

    // Direct Firebase / proxy lookup — works in Iran, works before subscription loads
    setTrackLoading(true);
    setFoundTicket(null); setFoundOrder(null);
    setTrackError('');
    try {
      const ids = [clean, `exp-${clean}`, clean.toUpperCase(), `EXP-${clean.toUpperCase()}`];
      let found: Ticket | null = null;
      for (const id of ids) {
        const result = await getTicketById(id);
        if (result) { found = result; break; }
      }
      if (found) { setFoundTicket(found); setTrackError(''); return; }
      // Fallback: it may be a shop order code entered without the SHP- prefix being recognised
      if (lookupShopOrder) {
        const orders = await lookupShopOrder(clean.toUpperCase());
        if (orders.length) { setFoundOrder(orders[0]); setTrackError(''); return; }
      }
      setTrackError(t.notFound);
    } catch {
      setTrackError(lang === 'fa' ? 'خطا در اتصال. دوباره تلاش کنید.' : 'Connection error. Please try again.');
    } finally {
      setTrackLoading(false);
    }
  };

  const handleRecover = (e: React.FormEvent) => {
    e.preventDefault();
    const name  = recoverName.trim().toLowerCase();
    const phone = recoverPhone.trim().replace(/\D/g, '');
    if (!name || !phone) return;
    const found = tickets.filter(tk => {
      const tName  = (tk.customerName || '').trim().toLowerCase();
      const tPhone = (tk.phoneNumber  || '').replace(/\D/g, '');
      return tName === name && (tPhone === phone || tPhone.endsWith(phone) || phone.endsWith(tPhone));
    });
    // Also recover the customer's correspondences (Contact Us messages) by name + mobile
    const contacts = lookupContactMessages ? lookupContactMessages(recoverName, recoverPhone).filter(m => m.contactTrackingCode) : [];
    setRecoveredTickets(found);
    setRecoveredContacts(contacts);
    if (found.length === 0 && contacts.length === 0) setRecoverError(t.recoverNotFound);
    else setRecoverError('');
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); });
  };

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onContactSubmit) return;
    if (!contactName.trim() || !contactPhone.trim() || !contactDept || !contactMessage.trim()) {
      setContactError(t.contactIncomplete);
      return;
    }
    setContactSubmitting(true);
    setContactError('');
    setContactSuccess(false);
    try {
      const code = await onContactSubmit({ name: contactName.trim(), phone: contactPhone.trim(), departmentId: contactDept, message: contactMessage.trim() });
      setContactMessage('');
      setSentTrackingCode(typeof code === 'string' ? code : '');
      setContactSuccess(true);
      // Show the customer their conversation thread (including the message just sent)
      setTimeout(() => { if (lookupContactMessages) setContactThreads(lookupContactMessages(contactName, contactPhone)); }, 400);
    } catch {
      setContactError(t.contactError);
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleContactLookup = () => {
    if (!lookupContactMessages) return;
    const found = lookupContactMessages(contactName, contactPhone);
    setContactThreads(found);
  };

  const getStepStatus = (step: TicketStatus, current: TicketStatus) => {
    const order = [TicketStatus.SUBMITTED, TicketStatus.PROCESSING, TicketStatus.IN_PROGRESS, TicketStatus.COMPLETED];
    const ci = order.indexOf(current), si = order.indexOf(step);
    if (current === TicketStatus.CANCELLED) return 'cancelled';
    if (si < ci) return 'completed'; if (si === ci) return 'current'; return 'pending';
  };

  const serviceTitle = (id: string) => {
    if (id?.startsWith('form:')) {
      const formId = id.replace('form:', '');
      return lang === 'fa' ? `فرم آنلاین (${formId.substring(0, 8)}...)` : `Online Form`;
    }
    const s = services.find(s => s.id === id);
    return lang === 'en' && s?.titleEn ? s.titleEn : (s?.title || id);
  };

  const handleUploadFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    const remaining = MAX_FILES - uploadFiles.length;
    for (let i = 0; i < Math.min(fileList.length, remaining); i++) {
      const file = fileList.item(i);
      if (!file) continue;
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { alert(lang === 'fa' ? `حداکثر ${MAX_UPLOAD_MB} مگابایت` : `Max ${MAX_UPLOAD_MB} MB`); continue; }
      const placeholder: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
      setUploadFiles(prev => {
        const newList = [...prev, placeholder];
        const idx = newList.length - 1;
        uploadFileWithProgress(
          file,
          (p) => setUploadFiles(cur => cur.map((f, i) => i === idx ? { ...f, progress: p } : f)),
          (url) => setUploadFiles(cur => cur.map((f, i) => i === idx ? { ...f, content: url, status: 'success', progress: 100 } : f)),
          (err) => setUploadFiles(cur => cur.map((f, i) => i === idx ? { ...f, status: 'error', errorMsg: err.message } : f)),
          'uploads'
        );
        return newList;
      });
    }
    e.target.value = '';
  };

  const handleUploadSubmit = async (ticketId: string) => {
    if (!onCustomerUpload) return;
    if (!uploadMessage.trim() && uploadFiles.filter(f => f.status === 'success').length === 0) return;
    if (uploadFiles.some(f => f.status === 'uploading')) return;
    setUploadSubmitting(true);
    try {
      await onCustomerUpload(ticketId, uploadMessage.trim(), uploadFiles.filter(f => f.status === 'success'));
      setUploadDone(true);
      setUploadMessage('');
      setUploadFiles([]);
    } catch {
      alert(lang === 'fa' ? 'خطا در ارسال. دوباره تلاش کنید.' : 'Submission failed. Please try again.');
    } finally {
      setUploadSubmitting(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string): string => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return lang === 'fa' ? 'منقضی شده' : 'Expired';
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (lang === 'fa') return h > 0 ? `${h} ساعت و ${m} دقیقه دیگر` : `${m} دقیقه دیگر`;
    return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  };

  const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-colors";

  // One correspondence thread (original message + staff replies) — shared by the Contact tab and the Track-by-code result
  const renderThread = (m: InternalMessage) => (
    <div key={m.id} className="border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-700">{m.contactDepartmentName || ''}</span>
          {m.contactTrackingCode && (
            <span className="text-[10px] font-mono bg-gray-900 text-white px-1.5 py-0.5 rounded" dir="ltr" title={t.contactTracking}>{m.contactTrackingCode}</span>
          )}
        </div>
        <span className="text-[10px] text-gray-400" dir="ltr">{new Date(m.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
      </div>
      {/* Customer's original message */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">{(m.contactName || t.contactYou).charAt(0)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-gray-500 mb-0.5">{t.contactYou}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.body}</p>
          </div>
        </div>
      </div>
      {/* Replies */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[11px] font-semibold text-gray-400 mb-2 flex items-center gap-1"><IconReply className="w-3 h-3" />{t.contactReplies}</p>
        {(!m.replies || m.replies.length === 0) ? (
          <p className="text-xs text-gray-400">{t.contactNoReply}</p>
        ) : (
          <div className="space-y-2">
            {m.replies.map(r => (
              <div key={r.id} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">{(r.authorName || '?').charAt(0)}</div>
                <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-medium text-emerald-700">{r.authorName}</span>
                    <span className="text-[10px] text-gray-400" dir="ltr">{new Date(r.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-16 animate-fade-in">

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-7 gap-6">
        {(['track', 'recover', 'contact'] as const).map((tabId) => (
          <button key={tabId}
            onClick={() => { setTab(tabId); setFoundTicket(null); setFoundOrder(null); setTrackError(''); setRecoveredTickets(null); setRecoveredContacts(null); setRecoverError(''); setFoundContact(null); }}
            className={`py-3 px-0.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === tabId ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {tabId === 'track' ? <><IconSearch className="w-3.5 h-3.5" />{t.trackTab}</>
              : tabId === 'recover' ? <><IconCopy className="w-3.5 h-3.5" />{t.recoverTab}</>
              : <><IconMail className="w-3.5 h-3.5" />{t.contactTab}</>}
          </button>
        ))}
      </div>

      {/* ── Track by ID ── */}
      {tab === 'track' && (
        <>
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">{t.trackTitle}</h2>
            <p className="text-sm text-gray-400 mb-5">{t.trackDesc}</p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input type="text" placeholder={t.placeholder} value={searchId}
                onChange={e => setSearchId(e.target.value)} className={inputCls} dir="ltr" />
              <button type="submit" disabled={trackLoading} className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black disabled:opacity-60 transition-colors flex items-center gap-1.5 shrink-0">
                {trackLoading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <IconSearch className="w-4 h-4" />}
                {trackLoading ? (lang === 'fa' ? 'جستجو...' : 'Searching...') : t.search}
              </button>
            </form>
            {trackError && <p className="text-xs text-red-500 mt-3">{trackError}</p>}
          </div>

          {foundTicket && (
            <div className="space-y-4 animate-fade-in">
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t.number}</p>
                    <p className="font-mono text-sm font-semibold text-gray-900">{foundTicket.id}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border
                    ${foundTicket.status === TicketStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-200' :
                      foundTicket.status === TicketStatus.CANCELLED  ? 'bg-red-50 text-red-600 border-red-200' :
                      'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {foundTicket.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-100 rtl:divide-x-reverse">
                  {[
                    { label: t.applicant, value: foundTicket.customerName },
                    { label: t.service,   value: serviceTitle(foundTicket.serviceId) },
                    { label: t.date,      value: new Date(foundTicket.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') },
                    { label: t.priority,  value: foundTicket.priority || 'Normal' },
                  ].map((item, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-[11px] text-gray-400 mb-0.5">{item.label}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{item.value}</p>
                    </div>
                  ))}
                </div>
                {foundTicket.files && foundTicket.files.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 mb-2">{t.files}</p>
                    <div className="flex flex-wrap gap-2">
                      {foundTicket.files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-lg">
                          <IconFile className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-600 max-w-[140px] truncate">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-2xl px-5 py-5">
                <div className="space-y-5">
                  {[TicketStatus.SUBMITTED, TicketStatus.PROCESSING, TicketStatus.IN_PROGRESS, TicketStatus.COMPLETED].map((step, idx, arr) => {
                    const status = getStepStatus(step, foundTicket.status);
                    const isCompleted = status === 'completed', isCurrent = status === 'current', isPending = status === 'pending';
                    return (
                      <div key={idx} className="flex items-start gap-3 relative">
                        {idx !== arr.length - 1 && <div className={`absolute top-6 rtl:right-3 ltr:left-3 w-px h-full ${isCompleted ? 'bg-gray-800' : 'bg-gray-200'}`} />}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border z-10 mt-0.5
                          ${isCompleted ? 'bg-gray-900 border-gray-900' : isCurrent ? 'bg-white border-gray-900' : 'bg-white border-gray-200'}`}>
                          {isCompleted ? <IconCheck className="w-3 h-3 text-white" />
                            : isCurrent ? <div className="w-2 h-2 bg-gray-900 rounded-full animate-pulse" />
                            : <div className="w-1.5 h-1.5 bg-gray-300 rounded-full" />}
                        </div>
                        <div className={`pt-0.5 ${isPending ? 'opacity-40' : ''}`}>
                          <p className={`text-sm font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-700'}`}>{t.steps[idx]}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {isCurrent && t.currentStep}{isCompleted && t.completedStep}{isPending && t.pendingStep}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                  <IconActivity className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{t.historyTitle}</span>
                </div>
                <div className="px-5 py-4">
                  {(!foundTicket.timeline || foundTicket.timeline.filter(e => e.visibility !== 'internal').length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-4">{t.historyEmpty}</p>
                  )}
                  <div className="space-y-4">
                    {foundTicket.timeline?.filter(e => e.visibility !== 'internal').map((entry, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${entry.type === 'creation' ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {idx !== (foundTicket.timeline?.length || 0) - 1 && <div className="w-px flex-grow bg-gray-100 my-1" />}
                        </div>
                        <div className="pb-2 flex-1">
                          <div className="text-[11px] text-gray-400 mb-1" dir="ltr">
                            {new Date(entry.timestamp).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                          </div>
                          <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                            <p className="text-xs font-semibold text-gray-700 mb-0.5">{entry.title}</p>
                            {entry.description && <p className="text-xs text-gray-500 leading-relaxed">{entry.description}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Customer upload window ── */}
              {(() => {
                const win = foundTicket.customerUploadWindow;
                const winActive = win?.isOpen && new Date(win.expiresAt).getTime() > Date.now();
                if (!winActive || !onCustomerUpload) return null;
                const prompt = (lang === 'fa' || !win!.promptEn) ? win!.prompt : win!.promptEn;
                return (
                  <div className="border-2 border-amber-300 bg-amber-50 rounded-2xl overflow-hidden animate-fade-in">
                    <div className="flex items-center gap-2 px-5 py-3 bg-amber-100 border-b border-amber-200">
                      <IconUpload className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-800">
                        {lang === 'fa' ? 'درخواست مدرک / اطلاعات' : 'Document Request'}
                      </span>
                      <span className="mr-auto flex items-center gap-1 text-[11px] text-amber-600">
                        <IconClock className="w-3 h-3" />
                        {formatTimeRemaining(win!.expiresAt)}
                      </span>
                    </div>
                    <div className="px-5 py-4 space-y-4">
                      {uploadDone ? (
                        <div className="flex items-center gap-2 py-4 text-center justify-center">
                          <IconCheck className="w-5 h-5 text-emerald-500" />
                          <p className="text-sm font-medium text-emerald-700">
                            {lang === 'fa' ? 'ارسال شما با موفقیت ثبت شد.' : 'Your submission was received.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-amber-900 leading-relaxed bg-white border border-amber-200 rounded-xl px-4 py-3">
                            {prompt}
                          </p>
                          <input ref={uploadFileInputRef} type="file" multiple className="hidden" onChange={handleUploadFileSelect} />
                          {uploadFiles.length > 0 && (
                            <div className="space-y-1.5">
                              {uploadFiles.map((f, i) => (
                                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${f.status === 'error' ? 'bg-red-50 border-red-200 text-red-600' : f.status === 'uploading' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                                  <IconFile className="w-3.5 h-3.5 shrink-0" />
                                  <span className="flex-1 truncate">{f.name}</span>
                                  {f.status === 'uploading' && <span>{f.progress?.toFixed(0)}%</span>}
                                  {f.status === 'success' && <span className="text-emerald-600">✓</span>}
                                  {f.status !== 'uploading' && (
                                    <button type="button" onClick={() => setUploadFiles(p => p.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400">
                                      <IconTrash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {uploadFiles.length < MAX_FILES && (
                            <button type="button" onClick={() => uploadFileInputRef.current?.click()}
                              className="w-full py-2.5 border-2 border-dashed border-amber-300 rounded-xl text-xs text-amber-700 hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5">
                              <IconUpload className="w-3.5 h-3.5" />
                              {lang === 'fa' ? `ضمیمه فایل (حداکثر ${MAX_UPLOAD_MB} MB)` : `Attach file (max ${MAX_UPLOAD_MB} MB)`}
                            </button>
                          )}
                          <textarea
                            value={uploadMessage}
                            onChange={e => setUploadMessage(e.target.value)}
                            rows={3}
                            placeholder={lang === 'fa' ? 'پیام یا توضیحات خود را اینجا بنویسید...' : 'Write your message or notes here...'}
                            className="w-full px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleUploadSubmit(foundTicket.id)}
                            disabled={uploadSubmitting || uploadFiles.some(f => f.status === 'uploading') || (!uploadMessage.trim() && uploadFiles.filter(f => f.status === 'success').length === 0)}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                          >
                            <IconSend className="w-4 h-4" />
                            {uploadSubmitting
                              ? (lang === 'fa' ? 'در حال ارسال...' : 'Sending...')
                              : (lang === 'fa' ? 'ارسال' : 'Send')}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Meta Shop order found by tracking code (SHP-...) */}
          {foundOrder && (
            <div className="space-y-4 animate-fade-in">
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{t.orderTitle}</p>
                    <p className="font-mono text-sm font-semibold text-gray-900" dir="ltr">{foundOrder.trackingCode}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border
                    ${foundOrder.status === 'done' ? 'bg-green-50 text-green-700 border-green-200' :
                      foundOrder.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
                      'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {t.orderStatus[foundOrder.status] || foundOrder.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-gray-100 rtl:divide-x-reverse">
                  {[
                    { label: t.orderShop, value: foundOrder.shopName },
                    { label: t.applicant, value: foundOrder.customerName },
                    { label: t.orderDate, value: new Date(foundOrder.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') },
                    { label: t.orderTotal, value: foundOrder.items.every(it => it.priceHidden) ? t.orderNegotiable : `${(foundOrder.total || 0).toLocaleString()} ${foundOrder.currency || ''}` },
                  ].map((item, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-[11px] text-gray-400 mb-0.5">{item.label}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{item.value}</p>
                    </div>
                  ))}
                </div>
                {foundOrder.items && foundOrder.items.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 mb-2">{t.orderItemsT}</p>
                    <div className="space-y-1.5">
                      {foundOrder.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-gray-700 min-w-0 truncate">{it.name}{it.optionLabel ? <span className="text-gray-400"> — {it.optionLabel}</span> : null}</span>
                          <span className="text-gray-500 shrink-0 font-mono text-xs" dir="ltr">
                            {it.qty}{it.unit ? ` ${it.unit}` : ''}{it.priceHidden ? ` · ${t.orderNegotiable}` : (it.lineTotal != null ? ` · ${it.lineTotal.toLocaleString()} ${it.currency || foundOrder.currency || ''}` : '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Correspondence found by tracking code (MK-...) */}
          {foundContact && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><IconMail className="w-4 h-4 text-gray-400" />{t.trackContactTitle}</p>
                <button type="button"
                  onClick={() => { if (lookupContactByCode) setFoundContact(lookupContactByCode(searchId.trim())); }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                  <IconSearch className="w-3.5 h-3.5" />{t.contactLookup}
                </button>
              </div>
              {renderThread(foundContact)}
            </div>
          )}
        </>
      )}

      {/* ── Recover tracking ID ── */}
      {tab === 'recover' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">{t.recoverTitle}</h2>
          <p className="text-sm text-gray-400 mb-5">{t.recoverDesc}</p>
          <form onSubmit={handleRecover} className="space-y-3 mb-6">
            <input type="text" placeholder={t.namePlaceholder} value={recoverName}
              onChange={e => setRecoverName(e.target.value)} className={inputCls} />
            <input type="tel" placeholder={t.phonePlaceholder} value={recoverPhone}
              onChange={e => setRecoverPhone(e.target.value)} className={inputCls} dir="ltr" />
            <button type="submit" className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors flex items-center justify-center gap-2">
              <IconSearch className="w-4 h-4" />{t.recoverBtn}
            </button>
          </form>

          {recoverError && <p className="text-xs text-red-500">{recoverError}</p>}

          {((recoveredTickets && recoveredTickets.length > 0) || (recoveredContacts && recoveredContacts.length > 0)) && (
            <div className="animate-fade-in space-y-2">
              <p className="text-xs font-semibold text-gray-500 mb-3">{t.recoverFound}</p>

              {/* Case requests */}
              {(recoveredTickets || [])
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(tk => (
                <div key={tk.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{t.recoverTypeRequest}</span>
                      <span className="font-mono text-sm font-bold text-gray-900 tracking-wide" dir="ltr">{tk.id}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {serviceTitle(tk.serviceId)} · {new Date(tk.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border
                      ${tk.status === TicketStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-200' :
                        tk.status === TicketStatus.CANCELLED  ? 'bg-red-50 text-red-600 border-red-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {tk.status}
                    </span>
                    <button onClick={() => copyId(tk.id)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${copiedId === tk.id ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {copiedId === tk.id ? t.copied : t.copy}
                    </button>
                    <button
                      onClick={() => { setTab('track'); setSearchId(tk.id); setFoundTicket(tk); setFoundContact(null); }}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-black transition-colors">
                      {t.viewTicket}
                    </button>
                  </div>
                </div>
              ))}

              {/* Correspondences */}
              {(recoveredContacts || [])
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(m => (
                <div key={m.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{t.recoverTypeContact}</span>
                      <span className="font-mono text-sm font-bold text-gray-900 tracking-wide" dir="ltr">{m.contactTrackingCode}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {m.contactDepartmentName || ''} · {new Date(m.createdAt).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.replies && m.replies.length > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">{m.replies.length} {t.contactReplies}</span>
                    )}
                    <button onClick={() => copyId(m.contactTrackingCode || '')}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${copiedId === m.contactTrackingCode ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {copiedId === m.contactTrackingCode ? t.copied : t.copy}
                    </button>
                    <button
                      onClick={() => { setTab('track'); setSearchId(m.contactTrackingCode || ''); setFoundContact(m); setFoundTicket(null); }}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-900 text-white hover:bg-black transition-colors">
                      {t.viewTicket}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Contact Us ── */}
      {tab === 'contact' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">{t.contactTitle}</h2>
          <p className="text-sm text-gray-400 mb-5">{t.contactDesc}</p>

          {departments.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-2xl py-10 text-center text-sm text-gray-400">
              {t.contactNoDepts}
            </div>
          ) : (
            <form onSubmit={handleContact} className="space-y-3 mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder={t.namePlaceholder} value={contactName}
                  onChange={e => setContactName(e.target.value)} className={inputCls} />
                <input type="tel" placeholder={t.phonePlaceholder} value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)} className={inputCls} dir="ltr" />
              </div>
              <select value={contactDept} onChange={e => setContactDept(e.target.value)} className={inputCls}>
                <option value="">{t.contactDeptPlaceholder}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{(d.contactLabel || '').trim() || d.name}</option>)}
              </select>
              <textarea value={contactMessage} onChange={e => setContactMessage(e.target.value)} rows={4}
                placeholder={t.contactMsgPlaceholder} className={inputCls} />
              {contactError && <p className="text-xs text-red-500">{contactError}</p>}
              {contactSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><IconCheck className="w-3.5 h-3.5" /></span>
                    <span>{t.contactSent}</span>
                  </div>
                  {sentTrackingCode && (
                    <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-emerald-800">{t.contactTracking}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold bg-emerald-600 text-white px-2 py-1 rounded" dir="ltr">{sentTrackingCode}</span>
                        <button type="button" onClick={() => copyId(sentTrackingCode)}
                          className="text-xs font-medium px-2 py-1 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-colors">
                          {copiedId === sentTrackingCode ? t.copied : t.copy}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-emerald-700/80 mt-2">{t.contactTrackHint}</p>
                </div>
              )}
              <button type="submit" disabled={contactSubmitting}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {contactSubmitting
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <IconSend className="w-4 h-4" />}
                {contactSubmitting ? t.contactSending : t.contactSend}
              </button>
            </form>
          )}

          {/* My messages & replies — lookup by name + mobile */}
          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p className="text-sm font-semibold text-gray-700">{t.contactMyMessages}</p>
              <button type="button" onClick={handleContactLookup}
                disabled={!contactName.trim() || !contactPhone.trim()}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <IconSearch className="w-3.5 h-3.5" />{t.contactLookup}
              </button>
            </div>

            {contactThreads !== null && contactThreads.length === 0 && (
              <p className="text-xs text-gray-400 py-4 text-center">{t.contactNoThreads}</p>
            )}

            {contactThreads && contactThreads.length > 0 && (
              <div className="space-y-3 animate-fade-in">
                {contactThreads.map(m => renderThread(m))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
