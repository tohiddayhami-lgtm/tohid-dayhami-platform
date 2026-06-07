
import React, { useState, useEffect, useRef } from 'react';
import { CustomForm, Ticket, TicketStatus, AttachedFile } from '../types';
import { Language } from '../App';
import { getCustomFormById, uploadFileWithProgress } from '../services/firebaseService';
import { IconCheck, IconClipboard, IconCopy, IconSearch, IconFile, IconTrash, IconUpload } from './Icons';

interface Props {
  formId: string;
  lang: Language;
  appTitle: string;
  onGoToTracking: () => void;
  onSubmit: (ticket: Ticket) => Promise<void>;
  trackingBaseUrl?: string;
}

const downloadReceipt = (trackingCode: string, name: string, formTitle: string, lang: Language, trackingUrl: string) => {
  const date = new Date().toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
  const content = lang === 'fa'
    ? `=====================================\n   رسید ثبت درخواست\n=====================================\nکد رهگیری: ${trackingCode}\nنام: ${name}\nفرم: ${formTitle}\nتاریخ ثبت: ${date}\n=====================================\nبرای پیگیری: ${trackingUrl}\n=====================================\nاین رسید را نزد خود نگه دارید.`
    : `=====================================\n   Request Submission Receipt\n=====================================\nTracking ID: ${trackingCode}\nName: ${name}\nForm: ${formTitle}\nDate: ${date}\n=====================================\nTrack at: ${trackingUrl}\n=====================================\nPlease keep this receipt.`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `receipt-${trackingCode}.txt`; a.click();
  URL.revokeObjectURL(url);
};

const MAX_GENERAL_FILES = 5;
const MAX_FILE_SIZE_MB   = 10;
const ACCEPT_ALL = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar';

export const PublicFormView: React.FC<Props> = ({ formId, lang: appLang, appTitle, onGoToTracking, onSubmit, trackingBaseUrl }) => {
  const [form, setForm]           = useState<CustomForm | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey]   = useState(0);
  const [formLang, setFormLang]   = useState<Language>(appLang);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [contactName, setContactName]   = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitted, setSubmitted]       = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState<Record<string, boolean>>({});
  const [copied, setCopied]             = useState(false);

  // Per-field file uploads (for 'file' type fields)
  const [fieldFiles, setFieldFiles]         = useState<Record<string, AttachedFile | null>>({});
  const [activeFieldId, setActiveFieldId]   = useState<string | null>(null);
  const fieldFileInputRef                   = useRef<HTMLInputElement>(null);

  // General attachments (only when form.allowAttachments is true)
  const [attachedFiles, setAttachedFiles]   = useState<AttachedFile[]>([]);
  const [fileError, setFileError]           = useState('');
  const generalFileInputRef                 = useRef<HTMLInputElement>(null);

  const trackingUrl = trackingBaseUrl || `${window.location.origin}/?page=tracking`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setNotFound(false);
    setForm(null);

    const loadForm = async (attempt = 1) => {
      try {
        const f = await getCustomFormById(formId);
        if (cancelled) return;
        if (!f) {
          // null = document does not exist in Firestore (not a network error)
          setNotFound(true);
        } else if (f.isPublic === false) {
          setNotFound(true);
        } else {
          setForm(f);
        }
      } catch {
        // exception = network/Firebase error → retry with backoff
        if (cancelled) return;
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 700 * attempt));
          if (!cancelled) loadForm(attempt + 1);
          return;
        } else {
          setLoadError(true);
        }
      }
      if (!cancelled) setLoading(false);
    };

    loadForm();
    return () => { cancelled = true; };
    // Keep ?form= query param — do NOT replace with #/f/ hash.
    // Hash fragments are stripped by Instagram/WhatsApp/Telegram in-app browsers.
  }, [formId, retryKey]);

  const handleResponse = (fieldId: string, value: string) => {
    setResponses(r => ({ ...r, [fieldId]: value }));
    if (errors[fieldId]) setErrors(e => { const n = { ...e }; delete n[fieldId]; return n; });
  };

  // ── Per-field file upload ──
  const triggerFieldUpload = (fieldId: string) => {
    setActiveFieldId(fieldId);
    fieldFileInputRef.current?.click();
  };

  const handleFieldFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeFieldId) return;
    const file = e.target.files?.item(0);
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(formLang === 'fa' ? `حداکثر ${MAX_FILE_SIZE_MB} مگابایت` : `Max ${MAX_FILE_SIZE_MB} MB`);
      e.target.value = ''; return;
    }
    const fid = activeFieldId;
    const placeholder: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
    setFieldFiles(prev => ({ ...prev, [fid]: placeholder }));
    if (errors[fid]) setErrors(er => { const n = { ...er }; delete n[fid]; return n; });
    uploadFileWithProgress(
      file,
      (progress) => setFieldFiles(prev => { const f = prev[fid]; return f ? { ...prev, [fid]: { ...f, progress } } : prev; }),
      (url)      => setFieldFiles(prev => { const f = prev[fid]; return f ? { ...prev, [fid]: { ...f, content: url, status: 'success', progress: 100 } } : prev; }),
      (err)      => setFieldFiles(prev => { const f = prev[fid]; return f ? { ...prev, [fid]: { ...f, status: 'error', errorMsg: err.message } } : prev; }),
      'uploads',
    );
    e.target.value = '';
  };

  const removeFieldFile = (fieldId: string) => setFieldFiles(prev => ({ ...prev, [fieldId]: null }));

  // ── General attachments ──
  const handleGeneralFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const remaining = MAX_GENERAL_FILES - attachedFiles.length;
    if (remaining <= 0) { setFileError(formLang === 'fa' ? `حداکثر ${MAX_GENERAL_FILES} فایل` : `Max ${MAX_GENERAL_FILES} files`); return; }
    const toUpload: File[] = [];
    for (let i = 0; i < Math.min(fileList.length, remaining); i++) {
      const f = fileList.item(i); if (f) toUpload.push(f);
    }
    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) { setFileError(formLang === 'fa' ? `هر فایل حداکثر ${MAX_FILE_SIZE_MB} MB` : `Each file max ${MAX_FILE_SIZE_MB} MB`); continue; }
      const placeholder: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
      setAttachedFiles(prev => {
        const newList = [...prev, placeholder];
        const idx = newList.length - 1;
        uploadFileWithProgress(
          file,
          (progress) => setAttachedFiles(cur => cur.map((f, i) => i === idx ? { ...f, progress } : f)),
          (url)      => setAttachedFiles(cur => cur.map((f, i) => i === idx ? { ...f, content: url, status: 'success', progress: 100 } : f)),
          (err)      => setAttachedFiles(cur => cur.map((f, i) => i === idx ? { ...f, status: 'error', errorMsg: err.message } : f)),
          'uploads',
        );
        return newList;
      });
    }
    e.target.value = '';
  };

  const anyUploading = () =>
    (Object.values(fieldFiles) as (AttachedFile | null)[]).some(f => f?.status === 'uploading') ||
    attachedFiles.some(f => f.status === 'uploading');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, boolean> = {};
    if (!contactName.trim()) newErrors['__name'] = true;
    if (!contactPhone.trim()) newErrors['__phone'] = true;
    if (form) {
      for (const field of form.fields) {
        if (field.required && field.type === 'header') continue;
        if (field.type === 'file') {
          const ff = fieldFiles[field.id];
          if (field.required && (!ff || ff.status !== 'success')) newErrors[field.id] = true;
        } else {
          if (field.required && !responses[field.id]?.trim()) newErrors[field.id] = true;
        }
      }
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    if (anyUploading()) {
      alert(formLang === 'fa' ? 'لطفاً منتظر اتمام آپلود فایل‌ها بمانید.' : 'Please wait for uploads to finish.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const ticketId = `FRM-${rand}-${(formId || 'F').substring(0, 3).toUpperCase()}`;

      const customData: Record<string, string> = { formId, formTitle: form?.title || '' };
      if (form?.assigneePersonnelId) customData.__assigneePersonnelId = form.assigneePersonnelId;
      if (form?.assigneeRole)        customData.__assigneeRole = form.assigneeRole;

      // Text/select/checkbox fields
      (form?.fields ?? []).forEach(f => {
        if (f.type === 'header') return;
        if (f.type === 'file') {
          const ff = fieldFiles[f.id];
          if (ff?.status === 'success') customData[f.key || f.id] = ff.content; // store URL
        } else {
          if (responses[f.id]) customData[f.key || f.id] = responses[f.id];
        }
      });

      // Collect all uploaded files (field files + general attachments)
      const allFiles: AttachedFile[] = [
        ...(Object.values(fieldFiles) as (AttachedFile | null)[]).filter((f): f is AttachedFile => f?.status === 'success'),
        ...attachedFiles.filter(f => f.status === 'success'),
      ];

      const descParts = (form?.fields ?? [])
        .filter(f => f.type !== 'header')
        .map(f => {
          if (f.type === 'file') {
            const ff = fieldFiles[f.id];
            return ff?.status === 'success' ? `${f.label}: [فایل ضمیمه: ${ff.name}]` : null;
          }
          return responses[f.id] ? `${f.label}: ${responses[f.id]}` : null;
        })
        .filter(Boolean);
      const description = `[فرم: ${form?.title || ''}]\n${descParts.join('\n')}`;

      const ticket: Ticket = {
        id: ticketId,
        customerName: contactName.trim(),
        phoneNumber: contactPhone.trim(),
        whatsappNumber: contactPhone.trim(),
        location: '-',
        serviceId: `form:${form?.id || formId}`,
        description,
        status: TicketStatus.SUBMITTED,
        createdAt: now,
        files: allFiles.length > 0 ? allFiles : undefined,
        timeline: [{ type: 'creation', title: 'ثبت از طریق فرم آنلاین', description: `فرم "${form?.title || ''}" توسط ${contactName.trim()} پر شد${allFiles.length > 0 ? ` — ${allFiles.length} فایل ضمیمه` : ''}`, actorName: 'سیستم', timestamp: now, visibility: 'public' }],
        customData,
      };

      await onSubmit(ticket);
      setTrackingCode(ticketId);
      setSubmitted(true);
    } catch {
      alert(formLang === 'fa' ? 'خطا در ثبت فرم. لطفاً دوباره تلاش کنید.' : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyTracking = () => {
    navigator.clipboard.writeText(trackingCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const resetForm = () => {
    setSubmitted(false); setResponses({}); setContactName(''); setContactPhone('');
    setTrackingCode(''); setCopied(false); setFieldFiles({}); setAttachedFiles([]);
  };

  const t = {
    fa: {
      loading: 'در حال بارگذاری فرم...',
      notFound: 'فرم مورد نظر یافت نشد یا در دسترس عمومی نیست.',
      contactSection: 'اطلاعات تماس',
      nameLabel: 'نام و نام خانوادگی', namePlaceholder: 'مثال: علی محمدی',
      phoneLabel: 'شماره تماس', phonePlaceholder: 'مثال: 09120000000',
      required: 'این فیلد الزامی است',
      submit: 'ثبت فرم', submitting: 'در حال ثبت...',
      successTitle: 'فرم با موفقیت ثبت شد',
      successSub: 'کارشناسان ما در اسرع وقت با شما تماس می‌گیرند.',
      trackingLabel: 'کد رهگیری شما:',
      copy: 'کپی', copied: 'کپی شد', download: 'دانلود رسید',
      trackBtn: 'پیگیری وضعیت', fillAnother: 'ارسال فرم جدید',
      keepCode: 'این کد را نگه دارید — برای پیگیری وضعیت درخواستتان نیاز دارید.',
      attachSection: 'ضمیمه فایل اضافی (اختیاری)',
      attachHint: `تا ${MAX_GENERAL_FILES} فایل — هر فایل حداکثر ${MAX_FILE_SIZE_MB} مگابایت`,
      selectFiles: 'انتخاب فایل‌ها',
      chooseFile: 'انتخاب فایل یا عکس',
      changeFile: 'تغییر فایل',
      uploading: 'در حال آپلود...',
      uploadDone: 'آپلود شد ✓',
      uploadFail: 'خطا در آپلود',
    },
    en: {
      loading: 'Loading form...',
      notFound: 'Form not found or not publicly accessible.',
      contactSection: 'Contact Information',
      nameLabel: 'Full Name', namePlaceholder: 'e.g. John Smith',
      phoneLabel: 'Phone Number', phonePlaceholder: 'e.g. +1 555 000 0000',
      required: 'This field is required',
      submit: 'Submit Form', submitting: 'Submitting...',
      successTitle: 'Form Submitted Successfully',
      successSub: 'Our experts will contact you as soon as possible.',
      trackingLabel: 'Your Tracking ID:',
      copy: 'Copy', copied: 'Copied', download: 'Download Receipt',
      trackBtn: 'Track Status', fillAnother: 'Submit Another',
      keepCode: 'Keep this code — you will need it to track your request.',
      attachSection: 'Additional Files (Optional)',
      attachHint: `Up to ${MAX_GENERAL_FILES} files — max ${MAX_FILE_SIZE_MB} MB each`,
      selectFiles: 'Select Files',
      chooseFile: 'Choose file or image',
      changeFile: 'Change file',
      uploading: 'Uploading...',
      uploadDone: 'Uploaded ✓',
      uploadFail: 'Upload failed',
    },
  }[formLang];

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors ${hasError ? 'border-red-400 bg-red-50 focus:ring-red-200' : 'border-gray-200 bg-white focus:ring-black/10 focus:border-gray-400'}`;

  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
        <span className="text-sm">{t.loading}</span>
      </div>
    </div>
  );

  if (loadError) return (
    <div className="max-w-lg mx-auto py-24 text-center">
      <div className="text-4xl mb-4">🌐</div>
      <p className="text-gray-700 font-semibold text-base mb-2">
        {formLang === 'fa' ? 'خطا در بارگذاری فرم' : 'Could not load form'}
      </p>
      <p className="text-gray-400 text-sm mb-6">
        {formLang === 'fa' ? 'اتصال اینترنت را بررسی کنید و دوباره امتحان کنید.' : 'Please check your connection and try again.'}
      </p>
      <button
        onClick={() => setRetryKey(k => k + 1)}
        className="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
      >
        {formLang === 'fa' ? 'تلاش مجدد' : 'Try Again'}
      </button>
    </div>
  );

  if (notFound) return (
    <div className="max-w-lg mx-auto py-24 text-center">
      <IconClipboard className="w-12 h-12 text-gray-200 mx-auto mb-4" />
      <p className="text-gray-500 text-sm">{t.notFound}</p>
    </div>
  );

  if (submitted) return (
    <div className="max-w-lg mx-auto py-16 animate-fade-in" dir={formLang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{t.successTitle}</h2>
          <p className="text-sm text-gray-500">{t.successSub}</p>
        </div>
        <p className="text-xs font-semibold text-gray-400 mb-2">{t.trackingLabel}</p>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-4 mb-2 text-center">
          <span className="font-mono text-2xl font-bold text-gray-900 tracking-widest">{trackingCode}</span>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">⚠ {t.keepCode}</p>
        <div className="flex gap-2 mb-4">
          <button onClick={copyTracking} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${copied ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {copied ? <IconCheck className="w-4 h-4" /> : <IconCopy className="w-4 h-4" />}
            {copied ? t.copied : t.copy}
          </button>
          <button onClick={() => downloadReceipt(trackingCode, contactName, form?.title || '', formLang, trackingUrl)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            <IconFile className="w-4 h-4" />{t.download}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onGoToTracking} className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors flex items-center justify-center gap-2">
            <IconSearch className="w-4 h-4" />{t.trackBtn}
          </button>
          <button onClick={resetForm} className="w-full px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            {t.fillAnother}
          </button>
        </div>
      </div>
    </div>
  );

  const formTitle = formLang === 'en' && form?.titleEn ? form.titleEn : form?.title;
  const formDesc  = formLang === 'en' && form?.descriptionEn ? form.descriptionEn : form?.description;

  return (
    <div className="max-w-2xl mx-auto pb-16 animate-fade-in" dir={formLang === 'fa' ? 'rtl' : 'ltr'}>
      {/* Hidden file inputs */}
      <input ref={fieldFileInputRef} type="file" accept={ACCEPT_ALL} className="hidden" onChange={handleFieldFileSelect} />
      <input ref={generalFileInputRef} type="file" multiple accept={ACCEPT_ALL} className="hidden" onChange={handleGeneralFileSelect} />

      <div className="flex justify-end mb-4">
        <button onClick={() => setFormLang(l => l === 'fa' ? 'en' : 'fa')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          {formLang === 'fa' ? 'English' : 'فارسی'}
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{formTitle}</h1>
        {formDesc && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{formDesc}</p>}
        {form?.category && (
          <span className="inline-block mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{form.category}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Contact section */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.contactSection}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.nameLabel} <span className="text-red-500">*</span></label>
            <input type="text" value={contactName} onChange={e => { setContactName(e.target.value); if (errors['__name']) setErrors(er => { const n = { ...er }; delete n['__name']; return n; }); }} placeholder={t.namePlaceholder} className={inputCls(!!errors['__name'])} />
            {errors['__name'] && <p className="text-xs text-red-500 mt-1">{t.required}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t.phoneLabel} <span className="text-red-500">*</span></label>
            <input type="tel" value={contactPhone} onChange={e => { setContactPhone(e.target.value); if (errors['__phone']) setErrors(er => { const n = { ...er }; delete n['__phone']; return n; }); }} placeholder={t.phonePlaceholder} className={inputCls(!!errors['__phone'])} />
            {errors['__phone'] && <p className="text-xs text-red-500 mt-1">{t.required}</p>}
          </div>
        </div>

        {/* Dynamic fields */}
        {(form?.fields ?? []).map(field => {
          const label       = formLang === 'en' && field.labelEn   ? field.labelEn   : field.label;
          const placeholder = (formLang === 'en' && field.placeholderEn ? field.placeholderEn : field.placeholder) || '';
          const options     = formLang === 'en' && field.optionsEn?.length ? field.optionsEn : field.options;
          const hasErr      = !!errors[field.id];

          if (field.type === 'header') return (
            <div key={field.id} className="pt-2 pb-1 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
            </div>
          );

          // ── File upload field ──
          if (field.type === 'file') {
            const ff = fieldFiles[field.id];
            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {placeholder && <p className="text-xs text-gray-400 mb-1.5">{placeholder}</p>}

                {ff ? (
                  <div className={`rounded-xl border p-3 flex items-center gap-3 ${hasErr ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                    {/* Thumbnail or icon */}
                    <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                      {ff.type?.startsWith('image/') && ff.status === 'success' ? (
                        <img src={ff.content} alt={ff.name} className="w-full h-full object-cover" />
                      ) : (
                        <IconFile className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{ff.name}</p>
                      <p className="text-[11px] text-gray-400">{formatBytes(ff.size)}</p>
                      {ff.status === 'uploading' && (
                        <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${ff.progress || 0}%` }} />
                        </div>
                      )}
                      {ff.status === 'success' && <p className="text-[11px] text-emerald-600 mt-0.5">{t.uploadDone}</p>}
                      {ff.status === 'error'   && <p className="text-[11px] text-red-500 mt-0.5">{t.uploadFail}</p>}
                    </div>
                    {ff.status !== 'uploading' && (
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => triggerFieldUpload(field.id)} className="text-xs text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg hover:bg-indigo-50">
                          {t.changeFile}
                        </button>
                        <button type="button" onClick={() => removeFieldFile(field.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50">
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => triggerFieldUpload(field.id)}
                    className={`w-full py-4 border-2 border-dashed rounded-xl text-sm flex flex-col items-center gap-1.5 transition-colors ${hasErr ? 'border-red-300 bg-red-50 text-red-500' : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30'}`}
                  >
                    <IconUpload className="w-5 h-5" />
                    <span className="font-medium">{t.chooseFile}</span>
                    <span className="text-xs opacity-70">{formLang === 'fa' ? `تا ${MAX_FILE_SIZE_MB} مگابایت — عکس، PDF، Word ...` : `Up to ${MAX_FILE_SIZE_MB} MB — image, PDF, Word ...`}</span>
                  </button>
                )}
                {hasErr && <p className="text-xs text-red-500 mt-1">{t.required}</p>}
              </div>
            );
          }

          return (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea rows={4} value={responses[field.id] || ''} onChange={e => handleResponse(field.id, e.target.value)} placeholder={placeholder} className={inputCls(hasErr)} />
              ) : field.type === 'select' ? (
                <select value={responses[field.id] || ''} onChange={e => handleResponse(field.id, e.target.value)} className={inputCls(hasErr)}>
                  <option value="">{formLang === 'fa' ? 'انتخاب کنید...' : 'Select...'}</option>
                  {options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={responses[field.id] === 'true'} onChange={e => handleResponse(field.id, e.target.checked ? 'true' : '')} className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
                  <span className="text-sm text-gray-700">{placeholder}</span>
                </label>
              ) : (
                <input type={field.type} value={responses[field.id] || ''} onChange={e => handleResponse(field.id, e.target.value)} placeholder={placeholder} className={inputCls(hasErr)} />
              )}
              {hasErr && <p className="text-xs text-red-500 mt-1">{t.required}</p>}
            </div>
          );
        })}

        {/* General attachments — only if enabled on this form */}
        {form?.allowAttachments && (
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/60">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <IconUpload className="w-4 h-4 text-gray-400" />
                {t.attachSection}
              </p>
              <span className="text-xs text-gray-400">{attachedFiles.length}/{MAX_GENERAL_FILES}</span>
            </div>
            <p className="text-xs text-gray-400">{t.attachHint}</p>
            {attachedFiles.length > 0 && (
              <div className="space-y-2">
                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <div className="shrink-0">
                      {file.type.startsWith('image/') && file.status === 'success'
                        ? <img src={file.content} alt={file.name} className="w-8 h-8 object-cover rounded" />
                        : <IconFile className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-400">{formatBytes(file.size)}</p>
                      {file.status === 'uploading' && <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${file.progress || 0}%` }} /></div>}
                      {file.status === 'success' && <p className="text-[10px] text-emerald-600">{t.uploadDone}</p>}
                      {file.status === 'error'   && <p className="text-[10px] text-red-500">{t.uploadFail}</p>}
                    </div>
                    {file.status !== 'uploading' && <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="shrink-0 text-red-400 hover:text-red-600 p-1"><IconTrash className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
            )}
            {attachedFiles.length < MAX_GENERAL_FILES && (
              <button type="button" onClick={() => generalFileInputRef.current?.click()} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-colors flex items-center justify-center gap-2">
                <IconUpload className="w-4 h-4" />{t.selectFiles}
              </button>
            )}
            {fileError && <p className="text-xs text-red-500">{fileError}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || anyUploading()}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black disabled:opacity-60 transition-colors mt-4"
        >
          {anyUploading()
            ? (formLang === 'fa' ? 'در حال آپلود فایل‌ها...' : 'Uploading files...')
            : submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  );
};
