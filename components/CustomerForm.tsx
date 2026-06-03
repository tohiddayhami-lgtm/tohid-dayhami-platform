
import React, { useState, useRef, memo, useCallback } from 'react';
import { ServiceOption, Ticket, TicketStatus, AttachedFile, AppConfig, FormField } from '../types';
import { analyzeTicket } from '../services/geminiService';
import { uploadFileWithProgress } from '../services/firebaseService';
import { IconCheck, IconBriefcase, IconPaperclip, IconTrash, IconFile, IconSearch } from './Icons';
import { Language } from '../App';

interface Props {
  config: AppConfig;
  services: ServiceOption[];
  onSubmit: (tickets: Ticket[]) => Promise<void> | void; // Accept array of tickets
  onCancel: () => void;
  onGoToTracking?: () => void;
  lang: Language;
}

// ---------------------------------------------------------------------------
// Separate Component for Field Rendering to prevent Focus Loss
// ---------------------------------------------------------------------------
interface FieldItemProps {
    field: FormField;
    value: any;
    onChange: (key: string, val: any) => void;
    lang: Language;
}

const FieldItem = memo(({ field, value, onChange, lang }: FieldItemProps) => {
    const commonClasses = "w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none bg-white";

    const getLabel = (f: FormField) => (lang === 'en' && f.labelEn ? f.labelEn : f.label);
    const getPlaceholder = (f: FormField) => (lang === 'en' && f.placeholderEn ? f.placeholderEn : f.placeholder) || '';

    if (field.type === 'header') {
        return (
            <div className="col-span-1 md:col-span-2 mt-4 mb-2 pb-2 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-1 h-5 bg-indigo-500 rounded-full"></span>
                    {getLabel(field)}
                </h3>
            </div>
        );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        onChange(field.key, e.target.value);
    };

    let inputElement;
    switch (field.type) {
        case 'textarea':
            inputElement = (
                <textarea
                    required={field.required}
                    rows={4}
                    className={commonClasses}
                    placeholder={getPlaceholder(field)}
                    value={value || ''}
                    onChange={handleChange}
                />
            );
            break;
        case 'select':
            inputElement = (
                <select
                    required={field.required}
                    className={commonClasses}
                    value={value || ''}
                    onChange={handleChange}
                >
                    <option value="">-</option>
                    {field.options?.map((opt, idx) => (
                        <option key={idx} value={opt.trim()}>{opt.trim()}</option>
                    ))}
                </select>
            );
            break;
        default:
            inputElement = (
                <input
                    required={field.required}
                    type={field.type}
                    className={`${commonClasses} ${['tel', 'email'].includes(field.type) ? 'dir-ltr' : ''}`}
                    placeholder={getPlaceholder(field)}
                    value={value || ''}
                    onChange={handleChange}
                />
            );
    }

    return (
        <div className={field.type === 'textarea' ? 'col-span-1 md:col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLabel(field)} {field.required && <span className="text-red-500">*</span>}
            </label>
            {inputElement}
        </div>
    );
});

// ---------------------------------------------------------------------------
// Main Form Component
// ---------------------------------------------------------------------------

export const CustomerForm: React.FC<Props> = ({ config, services, onSubmit, onCancel, onGoToTracking, lang }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSubServices, setSelectedSubServices] = useState<Record<string, string[]>>({});
  
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicketIds, setSuccessTicketIds] = useState<string[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    fa: {
      header: 'فرم خدمات پلتفرم صادراتی',
      subHeader: 'اطلاعات محصول و نیاز صادراتی خود را ثبت کنید.',
      service: 'انتخاب سرویس‌ها (چند گزینه قابل انتخاب است)',
      files: 'بارگذاری مستندات (فقط عکس و PDF)',
      fileHint: 'حداکثر حجم ۵ مگابایت. آپلود بلافاصله شروع می‌شود.',
      clickUpload: 'برای انتخاب فایل کلیک کنید',
      cancel: 'انصراف',
      submit: 'ثبت نهایی درخواست‌ها',
      analyzing: 'در حال ایجاد پرونده و تفکیک درخواست‌ها...',
      required: 'الزامی',
      successTitle: 'درخواست‌های شما با موفقیت ثبت شد!',
      successSub: 'برای هر سرویس انتخابی، یک کد رهگیری جداگانه صادر شده است تا کارشناسان مربوطه همزمان پیگیری کنند.',
      trackingCode: 'کدهای رهگیری شما:',
      copy: 'کپی',
      copied: 'کپی شد!',
      quote: 'صادرات، نبض تپنده اقتصاد است. از اینکه جهانی می‌اندیشید سپاسگزاریم.',
      trackBtn: 'پیگیری وضعیت درخواست',
      homeBtn: 'بازگشت به صفحه اصلی',
      friendlyNote: 'اگر کدهای رهگیری را ذخیره نکردید نگران نباشید، با تماس با پشتیبانی و اعلام شماره موبایل می‌توانید آنها را بازیابی کنید.',
      uploadError: 'خطا در آپلود.',
      subServiceTitle: 'جزئیات خدمات'
    },
    en: {
      header: 'Export Services Request',
      subHeader: 'Register your product details and export needs.',
      service: 'Select Services (Multiple allowed)',
      files: 'Upload Documents (Photo & PDF Only)',
      fileHint: 'Max 5MB. Upload starts immediately.',
      clickUpload: 'Click to select files',
      cancel: 'Cancel',
      submit: 'Submit Requests',
      analyzing: 'Creating cases and splitting requests...',
      required: 'Required',
      successTitle: 'Requests Submitted Successfully!',
      successSub: 'Separate tracking IDs have been generated for each service so experts can process them concurrently.',
      trackingCode: 'Your Tracking IDs:',
      copy: 'Copy',
      copied: 'Copied!',
      quote: 'Exporting is the heartbeat of the economy. Thank you for thinking globally.',
      trackBtn: 'Track Application',
      homeBtn: 'Back to Home',
      friendlyNote: 'Don\'t worry if you didn\'t save the tracking codes. Contact support with your phone number to retrieve them.',
      uploadError: 'Upload Error.',
      subServiceTitle: 'Service Details'
    }
  }[lang];

  // Helper for input changes to pass to memoized component
  const handleInputChange = useCallback((key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleService = (id: string) => {
      setSelectedServiceIds(prev => 
         prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
  };

  const toggleSubService = (serviceId: string, subId: string) => {
      setSelectedSubServices(prev => {
          const currentSubs = prev[serviceId] || [];
          const updatedSubs = currentSubs.includes(subId) 
              ? currentSubs.filter(sid => sid !== subId) 
              : [...currentSubs, subId];
          return { ...prev, [serviceId]: updatedSubs };
      });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles: File[] = Array.from(e.target.files);

      for (const file of selectedFiles) {
        if (file.size > 5 * 1024 * 1024) { 
          alert(lang === 'fa' ? `فایل ${file.name} بیشتر از ۵ مگابایت است.` : `File ${file.name} is larger than 5MB.`);
          continue;
        }

        // Create initial file entry
        const newFileEntry: AttachedFile = {
            name: file.name,
            size: file.size,
            type: file.type,
            content: '',
            status: 'uploading',
            progress: 0
        };

        setFiles(prev => [...prev, newFileEntry]);

        // Start Upload (Using the new robust strategy)
        uploadFileWithProgress(
            file,
            (progress) => {
                setFiles(prev => prev.map(f => f.name === file.name ? { ...f, progress } : f));
            },
            (url) => {
                setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'success', content: url, progress: 100 } : f));
            },
            (err) => {
                setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', errorMsg: err.message } : f));
            }
        );
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) {
        alert(lang === 'fa' ? 'لطفا حداقل یک سرویس را انتخاب کنید.' : 'Please select at least one service.');
        return;
    }
    
    // Check if any file is still uploading
    if (files.some(f => f.status === 'uploading')) {
        alert(lang === 'fa' ? 'لطفا تا پایان آپلود فایل‌ها صبر کنید.' : 'Please wait for files to finish uploading.');
        return;
    }

    if (files.some(f => f.status === 'error')) {
        if (!window.confirm(lang === 'fa' ? 'برخی فایل‌ها آپلود نشدند. آیا مایلید بدون آنها ادامه دهید؟' : 'Some files failed to upload. Continue without them?')) {
            return;
        }
    }

    setIsSubmitting(true);
    
    const validFiles = files.filter(f => f.status === 'success');

    // Safety timeout
    const safetyTimer = setTimeout(() => {
        setIsSubmitting(false);
        alert(lang === 'fa' ? "عملیات ارسال زمان‌بر شد." : "Request timed out.");
    }, 45000);

    try {
      const ticketsToCreate: Ticket[] = [];
      const generatedIds: string[] = [];
      const description = formData['description'] || '';

      // Create a separate ticket for each selected service
      for (const serviceId of selectedServiceIds) {
          const selectedService = services.find(s => s.id === serviceId);
          const subs = selectedSubServices[serviceId] || [];
          
          const ticketId = `EXP-${Math.floor(1000 + Math.random() * 9000)}-${serviceId.substring(0,2).toUpperCase()}`;
          generatedIds.push(ticketId);

          // Attempt AI analysis for summary only.
          let analysisSummary = description;
          
          try {
             if (description.length > 10) {
                 const analysis = await analyzeTicket(
                    description, 
                    (lang === 'en' && selectedService?.titleEn ? selectedService.titleEn : selectedService?.title) || 'General'
                 );
                 analysisSummary = analysis.summary;
             }
          } catch(e) { console.log("AI Skipped"); }

          const newTicket: Ticket = {
            id: ticketId,
            customerName: formData['fullName'],
            companyName: formData['companyName'],
            location: formData['location'],
            phoneNumber: formData['phoneNumber'],
            whatsappNumber: formData['whatsappNumber'],
            businessType: formData['businessType'],
            serviceId: serviceId,
            selectedSubServices: subs,
            description: description,
            files: validFiles, 
            status: TicketStatus.SUBMITTED,
            createdAt: new Date().toISOString(),
            aiAnalysis: analysisSummary,
            priority: 'Medium',
            timeline: [
              {
                type: 'creation',
                title: lang === 'fa' ? 'ثبت درخواست' : 'Request Submitted',
                description: lang === 'fa' ? `درخواست سرویس ${selectedService?.title} ثبت شد.` : `Service request for ${selectedService?.titleEn} submitted.`,
                actorName: formData['fullName'] || (lang === 'fa' ? 'مشتری' : 'Customer'),
                timestamp: new Date().toISOString()
              }
            ],
            customData: formData,
            discountApplied: false
          };
          
          ticketsToCreate.push(newTicket);
      }

      await onSubmit(ticketsToCreate);
      clearTimeout(safetyTimer);
      setSuccessTicketIds(generatedIds);

    } catch (error: any) {
      console.error("Error submitting form", error);
      clearTimeout(safetyTimer);
      alert(lang === 'fa' ? `خطا در ارسال درخواست: ${error.message || 'مشکل در شبکه'}` : "Server Connection Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successTicketIds) {
    return (
        <div className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-gray-100 animate-fade-in text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <IconCheck className="w-12 h-12 text-green-600" />
            </div>
            
            <h2 className="text-3xl font-black text-gray-800 mb-4">{t.successTitle}</h2>
            <p className="text-gray-600 mb-8 text-lg">{t.successSub}</p>

            <div className="grid gap-3 mb-8">
                <p className="text-sm text-gray-500 font-medium">{t.trackingCode}</p>
                {successTicketIds.map((id) => (
                    <div key={id} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 relative group hover:border-indigo-300 transition-colors flex justify-between items-center">
                         <div className="text-xl font-mono font-bold text-indigo-700 tracking-wider">{id}</div>
                         <button 
                            onClick={(e) => {
                                handleCopy(id);
                                const btn = e.currentTarget;
                                const original = btn.innerHTML;
                                btn.innerHTML = `<span class='text-green-600'>${t.copied}</span>`;
                                setTimeout(() => btn.innerHTML = original, 2000);
                            }}
                            className="text-sm bg-white border border-gray-200 px-3 py-1 rounded hover:bg-indigo-50"
                         >
                             {t.copy}
                         </button>
                    </div>
                ))}
                <div className="text-xs text-gray-400 mt-2 bg-yellow-50 p-2 rounded border border-yellow-100">
                    {t.friendlyNote}
                </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-xl mb-8">
               <p className="text-indigo-800 italic font-medium">"{t.quote}"</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <button 
                  onClick={onGoToTracking}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
               >
                   <IconSearch className="w-5 h-5" />
                   {t.trackBtn}
               </button>
               <button 
                  onClick={onCancel}
                  className="px-8 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-colors"
               >
                   {t.homeBtn}
               </button>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100 animate-fade-in">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-100 rounded-full mb-4 text-indigo-600 shadow-lg shadow-indigo-50">
           <IconBriefcase className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800">{t.header}</h2>
        <p className="text-gray-500 mt-2 text-lg">{t.subHeader}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Dynamic Fields Container */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
           {config.formFields.map(field => (
             <FieldItem 
                key={field.id} 
                field={field} 
                value={formData[field.key]} 
                onChange={handleInputChange} 
                lang={lang} 
             />
           ))}
        </div>

        {/* Service Selection (Multi) */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">{t.service}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {services.map(service => {
              const isSelected = selectedServiceIds.includes(service.id);
              const hasSubServices = service.subServices && service.subServices.length > 0;
              
              return (
                <div key={service.id} className={`flex flex-col rounded-xl border-2 transition-all bg-white relative ${isSelected ? 'border-indigo-500 shadow-md ring-2 ring-indigo-50' : 'border-gray-200 hover:border-indigo-200'}`}>
                    <div
                      onClick={() => toggleService(service.id)}
                      className={`cursor-pointer p-4 flex flex-col items-center text-center gap-2`}
                    >
                      {isSelected && (
                          <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                              <IconCheck className="w-3 h-3" />
                          </div>
                      )}
                      <span className="text-3xl">{service.icon}</span>
                      <div className={`font-semibold text-sm ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {lang === 'en' && service.titleEn ? service.titleEn : service.title}
                      </div>
                    </div>
                    
                    {/* Expanded Details & Sub-services */}
                    {isSelected && (
                        <div className="px-4 pb-4 animate-fade-in border-t border-indigo-100 mt-2 pt-2">
                            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                                {lang === 'en' && service.descriptionEn ? service.descriptionEn : service.description}
                            </p>
                            
                            {hasSubServices && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-indigo-800">{t.subServiceTitle}</p>
                                    {service.subServices?.map(sub => {
                                        const isSubSelected = selectedSubServices[service.id]?.includes(sub.id);
                                        return (
                                            <div 
                                                key={sub.id} 
                                                className="flex items-center gap-2 p-2 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer border border-gray-200"
                                                onClick={(e) => { e.stopPropagation(); toggleSubService(service.id, sub.id); }}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSubSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                                    {isSubSelected && <IconCheck className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className="text-xs text-gray-700">{lang === 'en' && sub.titleEn ? sub.titleEn : sub.title}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>

        {/* File Upload with Immediate Feedback */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
             <label className="block text-sm font-medium text-gray-700 mb-2">{t.files}</label>
             <p className="text-xs text-gray-500 mb-3">{t.fileHint}</p>
             
             <div 
               onClick={() => fileInputRef.current?.click()}
               className={`border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors bg-white`}
             >
                <IconPaperclip className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600 font-medium">{t.clickUpload}</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                  multiple 
                  accept="image/*,.pdf"
                />
             </div>

             {files.length > 0 && (
               <div className="mt-4 space-y-3">
                 {files.map((file, idx) => (
                   <div key={idx} className={`flex flex-col p-3 bg-white border rounded-lg ${file.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-gray-100 rounded text-gray-600"><IconFile className="w-4 h-4" /></div>
                            <div className="truncate">
                              <div className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{file.name}</div>
                              <div className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             {file.status === 'uploading' && <span className="text-xs text-blue-600 font-bold">{Math.round(file.progress || 0)}%</span>}
                             {file.status === 'success' && <IconCheck className="w-5 h-5 text-green-600" />}
                             {file.status === 'error' && <span className="text-xs text-red-600 font-bold">خطا</span>}
                             <button 
                                type="button" 
                                onClick={() => removeFile(idx)}
                                className="text-red-500 p-1 hover:bg-red-50 rounded-full transition-colors"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                      
                      {/* Progress Bar */}
                      {file.status === 'uploading' && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${file.progress}%` }}></div>
                          </div>
                      )}
                      
                      {/* Error Message */}
                      {file.status === 'error' && (
                          <div className="text-xs text-red-600 mt-1">
                              {t.uploadError}
                          </div>
                      )}
                   </div>
                 ))}
               </div>
             )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-1/3 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            {t.cancel}
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting || files.some(f => f.status === 'uploading')}
            className={`flex-1 px-6 py-4 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-3 text-lg 
                ${files.some(f => f.status === 'uploading') 
                    ? 'bg-gray-400 cursor-wait' 
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t.analyzing}
              </>
            ) : (
                files.some(f => f.status === 'uploading') ? 'در حال آپلود فایل‌ها...' : t.submit
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
