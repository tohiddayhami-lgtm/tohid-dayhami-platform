
import React, { useState, useRef, memo, useCallback } from 'react';
import { ServiceOption, Ticket, TicketStatus, AttachedFile, AppConfig, FormField } from '../types';
import { analyzeTicket } from '../services/geminiService';
import { uploadFileWithProgress } from '../services/firebaseService';
import { IconCheck, IconBriefcase, IconPaperclip, IconTrash, IconFile, IconSearch, IconLayout, IconImage, IconMagic, IconTrendingUp, IconBulb, IconDatabase, IconFileText, IconMessageSquare, IconGlobe, IconPort, IconShield, IconMegaphone, IconAward, IconTarget, IconCloud, IconFolder } from './Icons';
import { Language } from '../App';

interface Props {
  config: AppConfig;
  services: ServiceOption[];
  onSubmit: (tickets: Ticket[]) => Promise<void> | void;
  onCancel: () => void;
  onGoToTracking?: () => void;
  lang: Language;
}

interface FieldItemProps {
  field: FormField;
  value: any;
  onChange: (key: string, val: any) => void;
  lang: Language;
}

const inputBase = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 transition-colors";

// Map service title keywords → professional SVG icon
const getServiceIcon = (service: { id: string; title: string; titleEn?: string }) => {
  const t = (service.title + ' ' + (service.titleEn || '')).toLowerCase();
  if (service.id === 's_other' || t.includes('سایر') || t.includes('other'))          return IconMessageSquare;
  if (t.includes('بسته‌بندی') || t.includes('packaging') || t.includes('بسته'))      return IconLayout;
  if (t.includes('گرافیک') || t.includes('graphic') || t.includes('طراحی'))          return IconMagic;
  if (t.includes('صادرات') || t.includes('export') || t.includes('تجارت'))           return IconTrendingUp;
  if (t.includes('فروش') || t.includes('sales') || t.includes('sale'))               return IconTarget;
  if (t.includes('مشاوره') || t.includes('consul') || t.includes('expert'))          return IconBulb;
  if (t.includes('نرم‌افزار') || t.includes('software') || t.includes('سیستم'))     return IconDatabase;
  if (t.includes('ثبت') || t.includes('شرکت') || t.includes('register'))             return IconFileText;
  if (t.includes('بازخورد') || t.includes('feedback') || t.includes('پیشنهاد'))     return IconMessageSquare;
  if (t.includes('متاپورت') || t.includes('metaport') || t.includes('مجازی'))       return IconPort;
  if (t.includes('برند') || t.includes('brand') || t.includes('هویت'))              return IconAward;
  if (t.includes('تبلیغ') || t.includes('market') || t.includes('مارکتینگ'))        return IconMegaphone;
  if (t.includes('وب') || t.includes('web') || t.includes('سایت') || t.includes('دیجیتال')) return IconGlobe;
  if (t.includes('امنیت') || t.includes('security'))                                 return IconShield;
  if (t.includes('پروژه') || t.includes('project'))                                  return IconFolder;
  if (t.includes('ابر') || t.includes('cloud') || t.includes('هاستینگ'))            return IconCloud;
  return IconBriefcase; // default
};

const FieldItem = memo(({ field, value, onChange, lang }: FieldItemProps) => {
  const getLabel = (f: FormField) => (lang === 'en' && f.labelEn ? f.labelEn : f.label);
  const getPlaceholder = (f: FormField) => (lang === 'en' && f.placeholderEn ? f.placeholderEn : f.placeholder) || '';

  if (field.type === 'header') {
    return (
      <div className="col-span-1 md:col-span-2 pt-4 pb-1 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{getLabel(field)}</h3>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(field.key, e.target.value);

  let inputElement;
  switch (field.type) {
    case 'textarea':
      inputElement = <textarea required={field.required} rows={3} className={inputBase} placeholder={getPlaceholder(field)} value={value || ''} onChange={handleChange} />;
      break;
    case 'select':
      inputElement = (
        <select required={field.required} className={inputBase} value={value || ''} onChange={handleChange}>
          <option value="">{lang === 'en' ? 'Select...' : 'انتخاب کنید'}</option>
          {field.options?.map((opt, idx) => (
            <option key={idx} value={opt.trim()}>
              {lang === 'en' && field.optionsEn?.[idx] ? field.optionsEn[idx] : opt.trim()}
            </option>
          ))}
        </select>
      );
      break;
    default:
      inputElement = <input required={field.required} type={field.type} className={`${inputBase} ${['tel', 'email'].includes(field.type) ? 'dir-ltr' : ''}`} placeholder={getPlaceholder(field)} value={value || ''} onChange={handleChange} />;
  }

  return (
    <div className={field.type === 'textarea' ? 'col-span-1 md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {getLabel(field)}{field.required && <span className="text-gray-400 ms-1">*</span>}
      </label>
      {inputElement}
    </div>
  );
});

export const CustomerForm: React.FC<Props> = ({ config, services, onSubmit, onCancel, onGoToTracking, lang }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSubServices, setSelectedSubServices] = useState<Record<string, string[]>>({});
  const [otherText, setOtherText] = useState('');
  const [requestDesc, setRequestDesc] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicketIds, setSuccessTicketIds] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    fa: {
      header: 'ثبت درخواست خدمات',
      subHeader: 'اطلاعات خود را تکمیل کنید تا کارشناسان با شما تماس بگیرند.',
      service: 'سرویس مورد نیاز',
      files: 'مستندات',
      fileHint: 'تصویر یا PDF، حداکثر ۵ مگابایت',
      clickUpload: 'افزودن فایل',
      cancel: 'انصراف',
      submit: 'ثبت درخواست',
      analyzing: 'در حال پردازش...',
      successTitle: 'درخواست ثبت شد',
      successSub: 'کارشناسان ما در اسرع وقت با شما تماس می‌گیرند.',
      trackingCode: 'کد رهگیری:',
      copy: 'کپی',
      copied: 'کپی شد',
      quote: 'صادرات، نبض تپنده اقتصاد است.',
      trackBtn: 'پیگیری وضعیت',
      homeBtn: 'بازگشت',
      friendlyNote: 'با شماره موبایل خود می‌توانید کد رهگیری را بازیابی کنید.',
      uploadError: 'خطا در آپلود',
      subServiceTitle: 'جزئیات خدمات'
    },
    en: {
      header: 'Service Request',
      subHeader: 'Complete the form and our experts will contact you shortly.',
      service: 'Required Service',
      files: 'Documents',
      fileHint: 'Image or PDF, max 5MB',
      clickUpload: 'Add File',
      cancel: 'Cancel',
      submit: 'Submit Request',
      analyzing: 'Processing...',
      successTitle: 'Request Submitted',
      successSub: 'Our experts will contact you as soon as possible.',
      trackingCode: 'Tracking ID:',
      copy: 'Copy',
      copied: 'Copied',
      quote: 'Exporting is the heartbeat of the economy.',
      trackBtn: 'Track Status',
      homeBtn: 'Go Back',
      friendlyNote: 'You can recover your tracking code with your phone number.',
      uploadError: 'Upload Error',
      subServiceTitle: 'Service Details'
    }
  }[lang];

  const handleInputChange = useCallback((key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value })), []);
  const toggleService = (id: string) => setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  const toggleSubService = (serviceId: string, subId: string) => setSelectedSubServices(prev => {
    const cur = prev[serviceId] || [];
    return { ...prev, [serviceId]: cur.includes(subId) ? cur.filter(sid => sid !== subId) : [...cur, subId] };
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    for (const file of Array.from(e.target.files)) {
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} بیشتر از ۵ مگابایت است.`); continue; }
      const newEntry: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
      setFiles(prev => [...prev, newEntry]);
      uploadFileWithProgress(file,
        (progress) => setFiles(prev => prev.map(f => f.name === file.name ? { ...f, progress } : f)),
        (url) => setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'success', content: url, progress: 100 } : f)),
        (err) => setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMsg: err.message } : f)),
        'uploads'
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) { alert(lang === 'fa' ? 'لطفا حداقل یک سرویس انتخاب کنید.' : 'Please select at least one service.'); return; }
    if (files.some(f => f.status === 'uploading')) { alert(lang === 'fa' ? 'منتظر اتمام آپلود باشید.' : 'Wait for uploads to finish.'); return; }
    if (files.some(f => f.status === 'error') && !window.confirm(lang === 'fa' ? 'برخی فایل‌ها آپلود نشدند. ادامه می‌دهید؟' : 'Some files failed. Continue?')) return;

    setIsSubmitting(true);
    const validFiles = files.filter(f => f.status === 'success');
    const safetyTimer = setTimeout(() => { setIsSubmitting(false); }, 45000);

    try {
      const ticketsToCreate: Ticket[] = [];
      const generatedIds: string[] = [];
      const description = [
        requestDesc ? `شرح درخواست:\n${requestDesc}` : '',
        formData['description'] ? `اطلاعات محصول:\n${formData['description']}` : '',
      ].filter(Boolean).join('\n\n') || '';

      for (const serviceId of selectedServiceIds) {
        const selectedService = services.find(s => s.id === serviceId);
        const subs = selectedSubServices[serviceId] || [];
        const ticketId = `EXP-${Math.floor(1000 + Math.random() * 9000)}-${serviceId.substring(0, 2).toUpperCase()}`;
        generatedIds.push(ticketId);

        const effectiveDescription = serviceId === 's_other' && otherText
          ? `${description}\n\nسایر: ${otherText}`.trim()
          : description;

        let analysisSummary = effectiveDescription;
        try {
          if (effectiveDescription.length > 10) {
            const analysis = await analyzeTicket(effectiveDescription, (lang === 'en' && selectedService?.titleEn ? selectedService.titleEn : selectedService?.title) || 'General');
            analysisSummary = analysis.summary;
          }
        } catch { }

        ticketsToCreate.push({
          id: ticketId, customerName: formData['fullName'], companyName: formData['companyName'],
          location: formData['location'], phoneNumber: formData['phoneNumber'], whatsappNumber: formData['whatsappNumber'],
          businessType: formData['businessType'], serviceId, selectedSubServices: subs, description: effectiveDescription,
          files: validFiles, status: TicketStatus.SUBMITTED, createdAt: new Date().toISOString(),
          aiAnalysis: analysisSummary, priority: 'Medium',
          timeline: [{ type: 'creation', title: lang === 'fa' ? 'ثبت درخواست' : 'Request Submitted', description: lang === 'fa' ? `درخواست سرویس ${selectedService?.title} ثبت شد.` : `Service request submitted.`, actorName: formData['fullName'] || 'Customer', timestamp: new Date().toISOString() }],
          customData: formData, discountApplied: false
        });
      }

      await onSubmit(ticketsToCreate);
      clearTimeout(safetyTimer);
      setSuccessTicketIds(generatedIds);
    } catch (error: any) {
      clearTimeout(safetyTimer);
      alert(lang === 'fa' ? `خطا: ${error.message || 'مشکل در شبکه'}` : 'Connection Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successTicketIds) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center animate-fade-in">
        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <IconCheck className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t.successTitle}</h2>
        <p className="text-sm text-gray-500 mb-8">{t.successSub}</p>

        <div className="space-y-2 mb-8 text-start">
          <p className="text-xs font-medium text-gray-400 mb-3">{t.trackingCode}</p>
          {successTicketIds.map((id) => (
            <div key={id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="font-mono text-sm font-semibold text-gray-900 tracking-wide">{id}</span>
              <button
                onClick={(e) => {
                  navigator.clipboard.writeText(id);
                  const btn = e.currentTarget;
                  const orig = btn.textContent;
                  btn.textContent = t.copied;
                  setTimeout(() => { if (btn) btn.textContent = orig; }, 2000);
                }}
                className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >{t.copy}</button>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-2">{t.friendlyNote}</p>
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={onGoToTracking} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-black transition-colors">
            <IconSearch className="w-4 h-4" /> {t.trackBtn}
          </button>
          <button onClick={onCancel} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors">
            {t.homeBtn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in py-2">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">{t.header}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{t.subHeader}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Dynamic Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.formFields.map(field => (
            <FieldItem key={field.id} field={field} value={formData[field.key]} onChange={handleInputChange} lang={lang} />
          ))}
        </div>

        {/* Service Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 pb-2 border-b border-gray-100">
            {t.service}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map(service => {
              const isSelected = selectedServiceIds.includes(service.id);
              const ServiceIcon = getServiceIcon(service);
              const desc = lang === 'en' && service.descriptionEn ? service.descriptionEn : service.description;

              return (
                <div key={service.id}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden
                    ${isSelected
                      ? 'border-gray-800 bg-gray-900 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-400 hover:shadow-sm'}`}>

                  {/* ── header row (always visible) ── */}
                  <div onClick={() => toggleService(service.id)}
                    className="cursor-pointer flex items-center gap-3 px-4 py-3">
                    {/* icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? 'bg-white/10' : 'bg-gray-100'}`}>
                      <ServiceIcon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    {/* title */}
                    <span className={`flex-1 text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                      {lang === 'en' && service.titleEn ? service.titleEn : service.title}
                    </span>
                    {/* checkmark */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                      ${isSelected ? 'bg-white border-white' : 'border-gray-300'}`}>
                      {isSelected && <IconCheck className="w-3 h-3 text-gray-900" />}
                    </div>
                  </div>

                  {/* ── description (only when selected) ── */}
                  {isSelected && desc && service.id !== 's_other' && (
                    <div className="px-4 pb-3 animate-fade-in">
                      <p className="text-xs text-gray-300 leading-relaxed border-t border-white/10 pt-2">
                        {desc}
                      </p>
                    </div>
                  )}

                  {/* ── sub-services ── */}
                  {isSelected && service.subServices && service.subServices.length > 0 && (
                    <div className="px-4 pb-3 pt-1 border-t border-white/10 space-y-1 animate-fade-in">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t.subServiceTitle}</p>
                      {service.subServices.map(sub => {
                        const isSubSelected = selectedSubServices[service.id]?.includes(sub.id);
                        return (
                          <div key={sub.id}
                            onClick={(e) => { e.stopPropagation(); toggleSubService(service.id, sub.id); }}
                            className={`flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-lg transition-colors
                              ${isSubSelected ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
                              ${isSubSelected ? 'bg-white border-white' : 'border-gray-500'}`}>
                              {isSubSelected && <IconCheck className="w-2 h-2 text-gray-900" />}
                            </div>
                            <span className="text-xs text-gray-300">
                              {lang === 'en' && sub.titleEn ? sub.titleEn : sub.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── other service text ── */}
                  {isSelected && service.id === 's_other' && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/10 animate-fade-in">
                      <textarea
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder={lang === 'fa' ? 'خدمات مورد نیاز خود را توضیح دهید...' : 'Describe the service you need...'}
                        rows={2}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-white/40 resize-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Request Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 pb-2 border-b border-gray-100">
            {lang === 'fa' ? 'شرح درخواست' : 'Request Description'}
          </label>
          <textarea
            rows={3}
            className={inputBase}
            placeholder={lang === 'fa'
              ? 'هدف و نیاز خود را از این خدمت توضیح دهید...'
              : 'Describe your goal and need for this service...'}
            value={requestDesc}
            onChange={e => setRequestDesc(e.target.value)}
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 pb-2 border-b border-gray-100">
            {t.files}
          </label>
          <p className="text-xs text-gray-400 mb-2">{t.fileHint}</p>
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            <IconPaperclip className="w-4 h-4" />
            {t.clickUpload}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,.pdf" />

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file, idx) => (
                <div key={idx} className={`flex flex-col p-3 rounded-lg border ${file.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <IconFile className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-medium text-gray-700 truncate max-w-[180px]">{file.name}</div>
                        <div className="text-[11px] text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'uploading' && <span className="text-xs text-blue-500">{Math.round(file.progress || 0)}%</span>}
                      {file.status === 'success' && <IconCheck className="w-4 h-4 text-green-500" />}
                      {file.status === 'error' && <span className="text-xs text-red-500">{file.errorMsg || t.uploadError}</span>}
                      <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500 transition-colors">
                        <IconTrash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {file.status === 'uploading' && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-0.5">
                      <div className="bg-gray-800 h-0.5 rounded-full transition-all" style={{ width: `${file.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t border-gray-100">
          <button type="button" onClick={onCancel} disabled={isSubmitting}
            className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors">
            {t.cancel}
          </button>
          <button type="submit"
            disabled={isSubmitting || files.some(f => f.status === 'uploading')}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full transition-colors
              ${files.some(f => f.status === 'uploading') ? 'bg-gray-300 text-gray-500 cursor-wait' : 'bg-gray-900 text-white hover:bg-black'}`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t.analyzing}
              </>
            ) : files.some(f => f.status === 'uploading') ? 'در حال آپلود...' : t.submit}
          </button>
        </div>
      </form>
    </div>
  );
};
