
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CustomForm, FormField, FormFieldType, Personnel, Ticket, ServiceOption, TicketStatus } from '../types';
import { Language } from '../App';
import { saveCustomFormToCloud, updateCustomFormInCloud, deleteCustomFormFromCloud, updateTicketInCloud } from '../services/firebaseService';
import { buildGoogleFormScript, buildServiceRequestGoogleScript, buildExistingFormConnectScript } from '../services/googleFormScript';
import { IconPlus, IconTrash, IconEdit, IconClipboard, IconFolder, IconCopy, IconLink, IconCheck, IconFile, IconMagic, IconUpload } from './Icons';

interface Props {
  customForms: CustomForm[];
  currentUser: Personnel;
  isMaster: boolean;
  isAdmin: boolean;
  lang: Language;
  personnel?: Personnel[];
  tickets?: Ticket[];
  services?: ServiceOption[];
  formFields?: FormField[];
  requestExternalUrl?: string;
  onUpdateRequestUrl?: (url: string) => void;
}

type PanelView = 'list' | 'builder' | 'preview' | 'archive';

const FIELD_TYPES: { value: FormFieldType; fa: string; en: string }[] = [
  { value: 'text',     fa: 'متن کوتاه',          en: 'Short Text' },
  { value: 'textarea', fa: 'متن بلند',            en: 'Long Text' },
  { value: 'email',    fa: 'ایمیل',               en: 'Email' },
  { value: 'tel',      fa: 'تلفن',                en: 'Phone' },
  { value: 'number',   fa: 'عدد',                 en: 'Number' },
  { value: 'date',     fa: 'تاریخ',               en: 'Date' },
  { value: 'select',   fa: 'لیست انتخابی',        en: 'Dropdown' },
  { value: 'checkbox', fa: 'چک‌باکس',            en: 'Checkbox' },
  { value: 'file',     fa: 'بارگزاری فایل / عکس', en: 'File / Image Upload' },
  { value: 'header',   fa: 'سرتیتر (جداکننده)',   en: 'Section Header' },
];

const genId = () => `f_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

const emptyField = (order: number): FormField => ({
  id: genId(), key: '', label: '', labelEn: '', type: 'text',
  required: false, placeholder: '', placeholderEn: '',
  options: [], optionsEn: [], order,
});

type FormDraft = Omit<CustomForm, 'id' | 'createdAt' | 'createdBy'>;

const emptyDraft = (): FormDraft => ({
  title: '', titleEn: '', category: '', description: '', descriptionEn: '',
  fields: [], allowedRoles: [], allowedPersonnelIds: [], allowAttachments: false,
  isPublic: true, assigneePersonnelId: '', assigneeRole: '',
});

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

const SAMPLE_JSON = `{
  "title": "فرم درخواست خدمت",
  "titleEn": "Service Request Form",
  "category": "خدمات",
  "description": "فرم ثبت درخواست خدمات عمومی",
  "descriptionEn": "General service request form",
  "isPublic": true,
  "allowedRoles": [],
  "fields": [
    {
      "id": "f1",
      "key": "contact_section",
      "label": "اطلاعات کسب‌وکار",
      "labelEn": "Business Information",
      "type": "header",
      "required": false,
      "placeholder": "",
      "placeholderEn": "",
      "options": [],
      "optionsEn": [],
      "order": 0
    },
    {
      "id": "f2",
      "key": "company_name",
      "label": "نام شرکت / برند",
      "labelEn": "Company / Brand Name",
      "type": "text",
      "required": true,
      "placeholder": "مثال: بازرگانی پارس",
      "placeholderEn": "e.g. Pars Trading Co.",
      "options": [],
      "optionsEn": [],
      "order": 1
    },
    {
      "id": "f3",
      "key": "business_type",
      "label": "نوع کسب‌وکار",
      "labelEn": "Business Type",
      "type": "select",
      "required": true,
      "placeholder": "",
      "placeholderEn": "",
      "options": ["تولیدی", "بازرگانی", "خدماتی", "سایر"],
      "optionsEn": ["Manufacturing", "Trading", "Services", "Other"],
      "order": 2
    },
    {
      "id": "f4",
      "key": "request_section",
      "label": "جزئیات درخواست",
      "labelEn": "Request Details",
      "type": "header",
      "required": false,
      "placeholder": "",
      "placeholderEn": "",
      "options": [],
      "optionsEn": [],
      "order": 3
    },
    {
      "id": "f5",
      "key": "request_desc",
      "label": "شرح درخواست",
      "labelEn": "Request Description",
      "type": "textarea",
      "required": true,
      "placeholder": "نیاز یا درخواست خود را توضیح دهید...",
      "placeholderEn": "Describe your request or need...",
      "options": [],
      "optionsEn": [],
      "order": 4
    },
    {
      "id": "f6",
      "key": "urgent",
      "label": "درخواست فوری است؟",
      "labelEn": "Is this urgent?",
      "type": "checkbox",
      "required": false,
      "placeholder": "بله، فوری است",
      "placeholderEn": "Yes, this is urgent",
      "options": [],
      "optionsEn": [],
      "order": 5
    }
  ]
}`;

const buildAiPrompt = (lang: 'fa' | 'en') => `${lang === 'fa'
  ? `می‌خوام یک فرم برای [موضوع فرم را اینجا بنویس] بسازم.
لطفاً یک JSON با فرمت دقیق زیر برام تولید کن — فقط JSON خالص بده بدون توضیح اضافه.`
  : `I want to create a form for [describe your form topic here].
Please generate a JSON in the exact format below — output only the raw JSON with no extra explanation.`}

${SAMPLE_JSON}

${lang === 'fa'
  ? `انواع "type" مجاز: "text" | "textarea" | "email" | "tel" | "number" | "date" | "select" | "checkbox" | "header"
نکته: "header" برای جداکردن بخش‌ها استفاده می‌شود.
نکته: فیلدهای "select" باید "options" (فارسی) و "optionsEn" (انگلیسی) داشته باشند.
id و key هر فیلد باید منحصر به‌فرد باشد.`
  : `Allowed "type" values: "text" | "textarea" | "email" | "tel" | "number" | "date" | "select" | "checkbox" | "header"
Note: "header" is used as a section divider.
Note: "select" fields must have both "options" (Persian) and "optionsEn" (English) arrays.
Each field's id and key must be unique.`}
`;

// Shared modal that shows a generated Google Apps Script + step-by-step guide.
const GoogleScriptModal: React.FC<{
  title: string;
  subtitle?: string;
  script: string;
  noteFa?: string;
  extraControls?: React.ReactNode;
  steps?: string[];
  lang: Language;
  onClose: () => void;
}> = ({ title, subtitle, script, noteFa, extraControls, steps: stepsProp, lang, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copyScript = () => {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };
  const steps = stepsProp || (lang === 'fa'
    ? [
        'به آدرس script.google.com بروید و یک پروژه جدید بسازید (New Project).',
        'تمام کد پیش‌فرض را پاک کنید و کد زیر را جای‌گذاری کنید (دکمه کپی).',
        'ذخیره کنید (Ctrl+S).',
        'از نوار بالا تابع «setupGoogleForm» را انتخاب و دکمه Run (▷) را بزنید.',
        'بار اول پنجره مجوز باز می‌شود: Review Permissions ← انتخاب حساب گوگل ← Advanced ← Go to (unsafe) ← Allow.',
        'پس از اجرا، از منوی Execution log لینک پر کردن فرم را کپی کنید و برای مشتری بفرستید.',
        'از این پس هر پاسخ گوگل‌فرم، خودکار به‌صورت تیکت در سامانه ثبت می‌شود.',
      ]
    : [
        'Open script.google.com and create a New Project.',
        'Delete the default code and paste the code below (Copy button).',
        'Save (Ctrl+S).',
        'Select the function "setupGoogleForm" from the top bar and click Run (▷).',
        'First run opens an auth dialog: Review Permissions → pick your Google account → Advanced → Go to (unsafe) → Allow.',
        'After it runs, copy the form link from the Execution log and share it with customers.',
        'From now on, every Google Form response is saved automatically as a ticket.',
      ]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg"><IconLink className="w-5 h-5" /></div>
            <div>
              <h3 className="text-base font-bold text-gray-800">{lang === 'fa' ? 'تبدیل به گوگل‌فرم' : 'Convert to Google Form'}</h3>
              <p className="text-xs text-gray-400">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm px-2">✕</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-800 leading-relaxed">
            {subtitle || (lang === 'fa'
              ? 'با اجرای کد زیر، یک گوگل‌فرم دقیقاً مطابق همین فرم ساخته می‌شود. هر پاسخی که مشتری ثبت کند، خودکار به‌صورت تیکت در سامانه می‌نشیند. نیازی به VPN یا تنظیمات گوگل‌کلود نیست.'
              : 'Running the code below creates a Google Form identical to this one. Every response is automatically saved as a ticket. No VPN or Google Cloud setup needed.')}
          </div>

          {extraControls}

          <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-200">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-600">{lang === 'fa' ? 'کد اسکریپت (Google Apps Script)' : 'Apps Script code'}</label>
              <button onClick={copyScript} className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${copied ? 'bg-emerald-50 text-emerald-600' : 'text-green-700 hover:bg-green-50'}`}>
                {copied ? <IconCheck className="w-3.5 h-3.5" /> : <IconCopy className="w-3.5 h-3.5" />}
                {copied ? (lang === 'fa' ? 'کپی شد' : 'Copied') : (lang === 'fa' ? 'کپی کد' : 'Copy code')}
              </button>
            </div>
            <textarea
              readOnly
              value={script}
              dir="ltr"
              onFocus={e => e.currentTarget.select()}
              className="w-full h-56 bg-gray-900 text-green-300 font-mono text-[11px] leading-relaxed p-3 rounded-xl text-left overflow-auto resize-none"
            />
          </div>

          {noteFa && lang === 'fa' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 leading-relaxed">{noteFa}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export const FormBuilderPanel: React.FC<Props> = ({ customForms, currentUser, isMaster, isAdmin, lang, personnel = [], tickets = [], services = [], formFields = [], requestExternalUrl, onUpdateRequestUrl }) => {
  const [view, setView] = useState<PanelView>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft());
  const [previewForm, setPreviewForm] = useState<CustomForm | null>(null);
  const [previewLang, setPreviewLang] = useState<Language>(lang);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [jsonImportTab, setJsonImportTab] = useState<'import' | 'ai'>('import');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archiveFormId, setArchiveFormId] = useState<string>('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [submissionAssigneeDraft, setSubmissionAssigneeDraft] = useState<Record<string, string>>({});
  const [submissionBusyId, setSubmissionBusyId] = useState<string | null>(null);
  const [googleFormFor, setGoogleFormFor] = useState<CustomForm | null>(null);
  const [serviceReqGoogleOpen, setServiceReqGoogleOpen] = useState(false);
  const [serviceReqMulti, setServiceReqMulti] = useState(false);
  const [reqUrlDraft, setReqUrlDraft] = useState(requestExternalUrl || '');
  const [reqUrlSaved, setReqUrlSaved] = useState(false);
  // Connect an existing Google Form
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectMode, setConnectMode] = useState<'service' | 'assignee'>('service');
  const [connectServiceId, setConnectServiceId] = useState('');
  const [connectAssigneeType, setConnectAssigneeType] = useState<'person' | 'role'>('person');
  const [connectAssigneeId, setConnectAssigneeId] = useState('');
  const [connectAssigneeRole, setConnectAssigneeRole] = useState('');
  useEffect(() => { setReqUrlDraft(requestExternalUrl || ''); }, [requestExternalUrl]);
  const saveReqUrl = () => {
    onUpdateRequestUrl?.(reqUrlDraft.trim());
    setReqUrlSaved(true);
    setTimeout(() => setReqUrlSaved(false), 2500);
  };
  const clearReqUrl = () => { setReqUrlDraft(''); onUpdateRequestUrl?.(''); };

  const isEditor = isAdmin || isMaster;

  // Derive unique roles and active personnel for assignment dropdowns
  const activePersonnel = useMemo(() =>
    personnel.filter(p => (p.status || 'active') === 'active'),
    [personnel]
  );
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    activePersonnel.forEach(p => (p.roles || []).forEach(r => { if (r.trim()) roles.add(r.trim()); }));
    return Array.from(roles).sort();
  }, [activePersonnel]);

  const downloadSampleJson = () => {
    const blob = new Blob([SAMPLE_JSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'form_sample.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setJsonText(text);
      setJsonError('');
      setJsonImportTab('import');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Use ?form= query param — survives Instagram/WhatsApp/Telegram link sharing
  // (hash fragments are often stripped by social media in-app browsers)
  const getPublicUrl = (form: CustomForm) =>
    `${window.location.origin}${window.location.pathname}?form=${form.id}`;

  const copyLink = (form: CustomForm) => {
    navigator.clipboard.writeText(getPublicUrl(form)).then(() => {
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Close / reopen a form — when closed, the public link shows "deadline ended"
  const toggleClosed = (form: CustomForm) => {
    updateCustomFormInCloud(form.id, { isClosed: !form.isClosed }, currentUser.fullName);
  };

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setView('builder');
  };

  const openEdit = (form: CustomForm) => {
    setEditingId(form.id);
    setDraft({
      title: form.title, titleEn: form.titleEn || '', category: form.category,
      description: form.description || '', descriptionEn: form.descriptionEn || '',
      fields: form.fields.map(f => ({ ...f, options: f.options || [], optionsEn: f.optionsEn || [] })),
      allowedRoles: form.allowedRoles || [], allowedPersonnelIds: form.allowedPersonnelIds || [],
      allowAttachments: form.allowAttachments ?? false,
      isPublic: form.isPublic ?? false,
      assigneePersonnelId: form.assigneePersonnelId || '', assigneeRole: form.assigneeRole || '',
    });
    setView('builder');
  };

  const openPreview = (form: CustomForm) => { setPreviewForm(form); setPreviewLang(lang); setView('preview'); };

  const handleSave = async () => {
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateCustomFormInCloud(editingId, { ...draft }, currentUser.fullName);
      } else {
        const id = `cf_${Date.now()}`;
        await saveCustomFormToCloud({
          id, ...draft,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.fullName,
        }, currentUser.fullName);
      }
      setView('list');
    } catch { alert('خطا در ذخیره. لطفاً دوباره تلاش کنید.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteCustomFormFromCloud(id, currentUser.fullName);
    setConfirmDeleteId(null);
  };

  const exportJson = (form: CustomForm) => {
    const exportData = {
      title: form.title, titleEn: form.titleEn, category: form.category,
      description: form.description, descriptionEn: form.descriptionEn,
      isPublic: form.isPublic, allowedRoles: form.allowedRoles,
      fields: form.fields,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `form_${form.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.title || !Array.isArray(parsed.fields)) throw new Error('فرمت JSON معتبر نیست');
      setDraft({
        title: parsed.title || '', titleEn: parsed.titleEn || '',
        category: parsed.category || '', description: parsed.description || '',
        descriptionEn: parsed.descriptionEn || '', isPublic: parsed.isPublic ?? true,
        allowedRoles: parsed.allowedRoles || [],
        fields: (parsed.fields as FormField[]).map((f, i) => ({
          ...f,
          id: genId(),
          order: f.order ?? i,
          options: f.options || [],
          optionsEn: f.optionsEn || [],
        })),
      });
      setEditingId(null);
      setJsonImportOpen(false);
      setJsonText('');
      setView('builder');
    } catch (e: any) {
      setJsonError(e.message || 'JSON نامعتبر است');
    }
  };

  // ── Field helpers ──
  const setField = (idx: number, updates: Partial<FormField>) => {
    setDraft(d => {
      const fields = [...d.fields];
      fields[idx] = { ...fields[idx], ...updates };
      if (updates.label && !updates.key) {
        fields[idx].key = updates.label.trim().toLowerCase()
          .replace(/\s+/g, '_').replace(/[^a-z0-9_؀-ۿ]/g, '').substring(0, 40) || `field_${idx}`;
      }
      return { ...d, fields };
    });
  };

  const addField = () => setDraft(d => ({ ...d, fields: [...d.fields, emptyField(d.fields.length)] }));

  const removeField = (idx: number) =>
    setDraft(d => ({ ...d, fields: d.fields.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i })) }));

  const moveField = (idx: number, dir: -1 | 1) => {
    setDraft(d => {
      const fields = [...d.fields];
      const target = idx + dir;
      if (target < 0 || target >= fields.length) return d;
      [fields[idx], fields[target]] = [fields[target], fields[idx]];
      return { ...d, fields: fields.map((f, i) => ({ ...f, order: i })) };
    });
  };

  const filteredForms = customForms.filter(f =>
    !searchQ || f.title.includes(searchQ) || (f.titleEn || '').toLowerCase().includes(searchQ.toLowerCase()) || f.category.includes(searchQ)
  );

  const formSubmissionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const formId = t.customData?.formId || ((t.serviceId || '').startsWith('form:') ? (t.serviceId || '').slice('form:'.length) : '');
      if (!formId) return;
      counts[formId] = (counts[formId] || 0) + 1;
    });
    return counts;
  }, [tickets]);

  // ── Archive helpers ──
  const formSubmissions = useMemo(() => {
    if (!archiveFormId) {
      return tickets.filter(t => (t.serviceId || '').startsWith('form:'));
    }
    return tickets.filter(t => t.serviceId === `form:${archiveFormId}` || t.customData?.formId === archiveFormId);
  }, [tickets, archiveFormId]);

  const filteredSubmissions = useMemo(() => {
    if (!archiveSearch.trim()) return formSubmissions;
    const q = archiveSearch.toLowerCase();
    return formSubmissions.filter(t =>
      t.customerName?.toLowerCase().includes(q) ||
      t.phoneNumber?.includes(q) ||
      t.id?.toLowerCase().includes(q) ||
      (t.customData?.formTitle || '').toLowerCase().includes(q)
    );
  }, [formSubmissions, archiveSearch]);

  const exportSubmissionsCSV = () => {
    if (filteredSubmissions.length === 0) return;
    const selectedForm = archiveFormId ? customForms.find(f => f.id === archiveFormId) : null;
    const fields = selectedForm ? selectedForm.fields.filter(f => f.type !== 'header') : [];

    const headers = [
      lang === 'fa' ? 'کد پیگیری' : 'Tracking ID',
      lang === 'fa' ? 'تاریخ ثبت' : 'Date',
      lang === 'fa' ? 'نام' : 'Name',
      lang === 'fa' ? 'تلفن' : 'Phone',
      lang === 'fa' ? 'فرم' : 'Form',
      ...fields.map(f => f.label),
      lang === 'fa' ? 'تعداد فایل' : 'Files Count',
      lang === 'fa' ? 'لینک فایل‌ها' : 'File URLs',
    ];

    const rows = filteredSubmissions.map(t => {
      const fileUrls = (t.files || []).map(f => f.content).filter(Boolean).join(' | ');
      return [
        t.id,
        new Date(t.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US'),
        t.customerName || '',
        t.phoneNumber || '',
        t.customData?.formTitle || t.serviceId || '',
        ...fields.map(f => t.customData?.[f.key || f.id] || ''),
        String((t.files || []).length),
        fileUrls,
      ];
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form_submissions_${archiveFormId || 'all'}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const goToFormArchive = (formId: string) => {
    setArchiveFormId(formId);
    setArchiveSearch('');
    setExpandedSubmissionId(null);
    setView('archive');
  };

  const setSubmissionStatus = async (ticketId: string, status: Ticket['status']) => {
    if (!ticketId || !status) return;
    setSubmissionBusyId(ticketId);
    try {
      await updateTicketInCloud(ticketId, { status });
    } catch {
      alert(lang === 'fa' ? 'خطا در ثبت اقدام' : 'Failed to update status');
    } finally {
      setSubmissionBusyId(null);
    }
  };

  const assignSubmission = async (ticketId: string) => {
    const assigneeId = submissionAssigneeDraft[ticketId];
    if (!ticketId || !assigneeId) return;
    setSubmissionBusyId(ticketId);
    try {
      await updateTicketInCloud(ticketId, { assignedTo: assigneeId });
      setSubmissionAssigneeDraft(prev => ({ ...prev, [ticketId]: '' }));
    } catch {
      alert(lang === 'fa' ? 'خطا در ارجاع پرونده' : 'Failed to assign submission');
    } finally {
      setSubmissionBusyId(null);
    }
  };

  // ────────────────────────── RENDER ──────────────────────────

  // ── Archive ──
  if (view === 'archive') {
    const selectedForm = archiveFormId ? customForms.find(f => f.id === archiveFormId) : null;
    const formFields = selectedForm ? selectedForm.fields.filter(f => f.type !== 'header') : [];

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
              {lang === 'fa' ? '← بازگشت' : '← Back'}
            </button>
            <h2 className="text-base font-bold text-gray-800">
              {lang === 'fa' ? '📊 بایگانی تکمیل فرم‌ها' : '📊 Form Submission Archive'}
            </h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {filteredSubmissions.length} {lang === 'fa' ? 'مورد' : 'entries'}
            </span>
          </div>
          <button
            onClick={exportSubmissionsCSV}
            disabled={filteredSubmissions.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            ⬇ {lang === 'fa' ? 'خروجی CSV' : 'Export CSV'}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-wrap gap-3 items-center">
          <select
            value={archiveFormId}
            onChange={e => { setArchiveFormId(e.target.value); setExpandedSubmissionId(null); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white min-w-[200px]"
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
          >
            <option value="">{lang === 'fa' ? 'همه فرم‌ها' : 'All Forms'}</option>
            {customForms.map(f => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
          <input
            value={archiveSearch}
            onChange={e => setArchiveSearch(e.target.value)}
            placeholder={lang === 'fa' ? 'جستجو (نام، تلفن، کد)...' : 'Search (name, phone, code)...'}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56"
            dir={lang === 'fa' ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Submissions list */}
        {filteredSubmissions.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
            <IconClipboard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">{lang === 'fa' ? 'هیچ تکمیل‌شده‌ای یافت نشد.' : 'No submissions found.'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSubmissions.map(sub => {
              const isExpanded = expandedSubmissionId === sub.id;
              const formTitle = sub.customData?.formTitle || sub.serviceId?.replace('form:', '') || '—';
              const fileCount = (sub.files || []).length;
                  const selectedAssignee = submissionAssigneeDraft[sub.id] || '';
                  const assignedName = activePersonnel.find(p => p.id === sub.assignedTo)?.fullName;

              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Row header */}
                  <button
                    type="button"
                    onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-start"
                  >
                    <div className="shrink-0 w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold">
                      {sub.customerName?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{sub.customerName}</span>
                        <span className="text-xs text-gray-400">{sub.phoneNumber}</span>
                        {fileCount > 0 && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-medium">
                            📎 {fileCount} {lang === 'fa' ? 'فایل' : 'file(s)'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{new Date(sub.createdAt).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')}</span>
                        <span className="text-xs text-indigo-500">{formTitle}</span>
                        <span className="text-[10px] font-mono text-gray-400">{sub.id}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-gray-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4 animate-fade-in">
                      {isEditor && (
                        <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <p className="text-[11px] font-bold text-indigo-700">
                              {lang === 'fa' ? 'اقدام روی این درخواست' : 'Actions on this submission'}
                            </p>
                            <span className="text-[11px] text-indigo-600">
                              {lang === 'fa'
                                ? `مسئول فعلی: ${assignedName || 'تعیین نشده'}`
                                : `Current assignee: ${assignedName || 'Unassigned'}`}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={submissionBusyId === sub.id}
                              onClick={() => setSubmissionStatus(sub.id, TicketStatus.PROCESSING)}
                              className="px-2.5 py-1.5 text-[11px] font-semibold rounded border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              {lang === 'fa' ? 'در حال بررسی' : 'Processing'}
                            </button>
                            <button
                              type="button"
                              disabled={submissionBusyId === sub.id}
                              onClick={() => setSubmissionStatus(sub.id, TicketStatus.IN_PROGRESS)}
                              className="px-2.5 py-1.5 text-[11px] font-semibold rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                            >
                              {lang === 'fa' ? 'در دست اقدام' : 'In progress'}
                            </button>
                            <button
                              type="button"
                              disabled={submissionBusyId === sub.id}
                              onClick={() => setSubmissionStatus(sub.id, TicketStatus.COMPLETED)}
                              className="px-2.5 py-1.5 text-[11px] font-semibold rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              {lang === 'fa' ? 'تکمیل شد' : 'Completed'}
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <select
                              value={selectedAssignee}
                              onChange={e => setSubmissionAssigneeDraft(prev => ({ ...prev, [sub.id]: e.target.value }))}
                              className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white min-w-[220px]"
                            >
                              <option value="">{lang === 'fa' ? '— انتخاب پرسنل برای ارجاع —' : '— Select assignee —'}</option>
                              {activePersonnel.map(p => (
                                <option key={p.id} value={p.id}>{p.fullName}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!selectedAssignee || submissionBusyId === sub.id}
                              onClick={() => assignSubmission(sub.id)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {lang === 'fa' ? 'ارجاع پرونده' : 'Assign'}
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Field values */}
                      {formFields.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {formFields.map(field => {
                            const val = sub.customData?.[field.key || field.id];
                            if (!val) return null;
                            const isUrl = val.startsWith('http');
                            const isImg = isUrl && /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(val);
                            return (
                              <div key={field.id} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-semibold text-gray-400 mb-1">{field.label}</p>
                                {field.type === 'file' || isUrl ? (
                                  isImg ? (
                                    <a href={val} target="_blank" rel="noopener noreferrer">
                                      <img src={val} alt={field.label} className="w-full max-h-40 object-contain rounded border border-gray-200 bg-white" />
                                      <p className="text-xs text-blue-600 mt-1 hover:underline">{lang === 'fa' ? 'مشاهده / دانلود' : 'View / Download'}</p>
                                    </a>
                                  ) : (
                                    <a href={val} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                                      <IconFile className="w-4 h-4 shrink-0" />
                                      <span className="break-all">{lang === 'fa' ? 'مشاهده / دانلود فایل' : 'View / Download File'}</span>
                                    </a>
                                  )
                                ) : (
                                  <p className="text-sm text-gray-800 break-words">{val}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Fallback: show all customData */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.entries(sub.customData || {})
                            .filter(([k]) => !k.startsWith('__') && k !== 'formId' && k !== 'formTitle')
                            .map(([key, val]) => (
                              <div key={key} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] font-semibold text-gray-400 mb-0.5">{key}</p>
                                <p className="text-sm text-gray-800 break-words">{val}</p>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Attached files */}
                      {fileCount > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-2">
                            {lang === 'fa' ? 'فایل‌های ضمیمه' : 'Attached Files'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(sub.files || []).map((f, i) => (
                              <a
                                key={i}
                                href={f.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                              >
                                {f.type?.startsWith('image/') ? '🖼' : '📄'}
                                <span className="max-w-[120px] truncate">{f.name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Description fallback */}
                      {sub.description && formFields.length === 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-[10px] font-semibold text-gray-400 mb-1">{lang === 'fa' ? 'محتوا' : 'Content'}</p>
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">{sub.description}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Preview ──
  if (view === 'preview' && previewForm) {
    const title = previewLang === 'en' && previewForm.titleEn ? previewForm.titleEn : previewForm.title;
    const desc = previewLang === 'en' && previewForm.descriptionEn ? previewForm.descriptionEn : previewForm.description;
    return (
      <div className="space-y-4 animate-fade-in" dir={previewLang === 'fa' ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
              {lang === 'fa' ? '← بازگشت' : '← Back'}
            </button>
            <span className="text-sm font-semibold text-gray-700">{lang === 'fa' ? 'پیش‌نمایش فرم' : 'Form Preview'}</span>
          </div>
          <button
            onClick={() => setPreviewLang(l => l === 'fa' ? 'en' : 'fa')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            {previewLang === 'fa' ? 'English' : 'فارسی'}
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
          {desc && <p className="text-sm text-gray-500 mb-4">{desc}</p>}
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{previewLang === 'fa' ? 'اطلاعات تماس' : 'Contact Info'}</p>
              <input disabled placeholder={previewLang === 'fa' ? 'نام و نام خانوادگی *' : 'Full Name *'} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-sm text-gray-400 cursor-not-allowed" />
              <input disabled placeholder={previewLang === 'fa' ? 'شماره تماس *' : 'Phone Number *'} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-sm text-gray-400 cursor-not-allowed" />
            </div>
            {previewForm.fields.map(field => {
              const label = previewLang === 'en' && field.labelEn ? field.labelEn : field.label;
              const placeholder = (previewLang === 'en' && field.placeholderEn ? field.placeholderEn : field.placeholder) || '';
              const options = previewLang === 'en' && field.optionsEn?.length ? field.optionsEn : field.options;
              if (field.type === 'header') return (
                <div key={field.id} className="pt-2 pb-1 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                </div>
              );
              return (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}{field.required && <span className="text-red-500"> *</span>}</label>
                  {field.type === 'textarea' ? <textarea disabled rows={3} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 cursor-not-allowed" />
                    : field.type === 'select' ? <select disabled className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 cursor-not-allowed"><option>{previewLang === 'fa' ? 'انتخاب کنید...' : 'Select...'}</option>{options?.map((o, i) => <option key={i}>{o}</option>)}</select>
                    : field.type === 'checkbox' ? <input type="checkbox" disabled className="w-4 h-4 cursor-not-allowed" />
                    : field.type === 'file' ? (
                      <div className="w-full px-3 py-2.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400 flex items-center gap-2 cursor-not-allowed">
                        <IconFile className="w-4 h-4 shrink-0" />
                        <span>{previewLang === 'fa' ? 'انتخاب فایل یا عکس...' : 'Choose file or image...'}</span>
                      </div>
                    )
                    : <input disabled type={field.type} placeholder={placeholder} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-400 cursor-not-allowed" />}
                </div>
              );
            })}
            <button disabled className="w-full py-2.5 bg-gray-300 text-gray-500 rounded-xl text-sm font-semibold cursor-not-allowed">
              {previewLang === 'fa' ? 'ثبت فرم' : 'Submit Form'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Builder ──
  if (view === 'builder') return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            {lang === 'fa' ? '← بازگشت' : '← Back'}
          </button>
          <h2 className="text-base font-bold text-gray-800">
            {editingId ? (lang === 'fa' ? 'ویرایش فرم' : 'Edit Form') : (lang === 'fa' ? 'فرم جدید' : 'New Form')}
          </h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !draft.title.trim()}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (lang === 'fa' ? 'در حال ذخیره...' : 'Saving...') : (lang === 'fa' ? 'ذخیره فرم' : 'Save Form')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: meta */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 lg:col-span-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
            {lang === 'fa' ? 'اطلاعات فرم' : 'Form Info'}
          </p>
          <div>
            <label className={labelCls}>{lang === 'fa' ? 'عنوان (فارسی) *' : 'Title (FA) *'}</label>
            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="مثال: فرم درخواست خدمت" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'fa' ? 'عنوان (انگلیسی)' : 'Title (EN)'}</label>
            <input value={draft.titleEn || ''} onChange={e => setDraft(d => ({ ...d, titleEn: e.target.value }))} placeholder="e.g. Service Request Form" className={inputCls} dir="ltr" />
          </div>
          <div>
            <label className={labelCls}>{lang === 'fa' ? 'دسته‌بندی' : 'Category'}</label>
            <input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} placeholder="مثال: خدمات عمومی" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'fa' ? 'توضیحات (فارسی)' : 'Description (FA)'}</label>
            <textarea value={draft.description || ''} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} placeholder="توضیحات فرم برای کاربران..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{lang === 'fa' ? 'توضیحات (انگلیسی)' : 'Description (EN)'}</label>
            <textarea value={draft.descriptionEn || ''} onChange={e => setDraft(d => ({ ...d, descriptionEn: e.target.value }))} rows={2} placeholder="Form description for users..." className={inputCls} dir="ltr" />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-700">{lang === 'fa' ? 'لینک عمومی' : 'Public Link'}</p>
              <p className="text-xs text-gray-400">{lang === 'fa' ? 'هر کسی با لینک می‌تواند فرم را ببیند' : 'Anyone with the link can view this form'}</p>
            </div>
            <button
              onClick={() => setDraft(d => ({ ...d, isPublic: !d.isPublic }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${draft.isPublic ? 'bg-indigo-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${draft.isPublic ? (lang === 'fa' ? 'left-0.5' : 'right-0.5') : (lang === 'fa' ? 'right-0.5' : 'left-0.5')}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-700">{lang === 'fa' ? 'امکان ضمیمه فایل' : 'Allow File Attachments'}</p>
              <p className="text-xs text-gray-400">{lang === 'fa' ? 'پرکننده فرم می‌تواند عکس و فایل ضمیمه کند' : 'Submitter can attach images and files'}</p>
            </div>
            <button
              onClick={() => setDraft(d => ({ ...d, allowAttachments: !d.allowAttachments }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${draft.allowAttachments ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${draft.allowAttachments ? (lang === 'fa' ? 'left-0.5' : 'right-0.5') : (lang === 'fa' ? 'right-0.5' : 'left-0.5')}`} />
            </button>
          </div>

          {/* Assignment config */}
          <div className="border border-orange-100 bg-orange-50/50 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-orange-700">
              {lang === 'fa' ? 'ارجاع خودکار فرم' : 'Auto-Assignment'}
            </p>

            {/* Assignment type selector */}
            <div className="flex rounded-lg overflow-hidden border border-orange-200 text-xs font-medium">
              {([
                { key: 'none',      fa: 'بدون ارجاع اختصاصی', en: 'System default' },
                { key: 'role',      fa: 'ارجاع به سمت',        en: 'By Role' },
                { key: 'personnel', fa: 'ارجاع به فرد',         en: 'To Person' },
              ] as const).map(opt => {
                const active = opt.key === 'none'
                  ? (!draft.assigneeRole && !draft.assigneePersonnelId)
                  : opt.key === 'role'
                  ? !!draft.assigneeRole
                  : !!draft.assigneePersonnelId;
                return (
                  <button key={opt.key} type="button"
                    onClick={() => {
                      if (opt.key === 'none')      setDraft(d => ({ ...d, assigneeRole: '', assigneePersonnelId: '' }));
                      else if (opt.key === 'role') setDraft(d => ({ ...d, assigneeRole: uniqueRoles[0] || '', assigneePersonnelId: '' }));
                      else                         setDraft(d => ({ ...d, assigneePersonnelId: activePersonnel[0]?.id || '', assigneeRole: '' }));
                    }}
                    className={`flex-1 py-1.5 px-2 text-center transition-colors ${active ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
                  >
                    {lang === 'fa' ? opt.fa : opt.en}
                  </button>
                );
              })}
            </div>

            {/* Role dropdown */}
            {draft.assigneeRole !== undefined && !draft.assigneePersonnelId && draft.assigneeRole !== '' && (
              <div>
                <label className={labelCls}>
                  {lang === 'fa' ? 'سمت / نقش' : 'Role'}
                  {(() => {
                    const count = activePersonnel.filter(p => (p.roles || []).some(r => r.trim() === draft.assigneeRole)).length;
                    return count > 0 ? (
                      <span className="mr-2 text-[10px] text-orange-600 font-normal">
                        ({count} {lang === 'fa' ? 'نفر — ارجاع با توجه به حجم کارتابل' : 'people — load-balanced'})
                      </span>
                    ) : null;
                  })()}
                </label>
                <select
                  value={draft.assigneeRole}
                  onChange={e => setDraft(d => ({ ...d, assigneeRole: e.target.value }))}
                  className={inputCls}
                >
                  {uniqueRoles.map(role => {
                    const cnt = activePersonnel.filter(p => (p.roles || []).some(r => r.trim() === role)).length;
                    return <option key={role} value={role}>{role} ({cnt} {lang === 'fa' ? 'نفر' : 'people'})</option>;
                  })}
                  {uniqueRoles.length === 0 && (
                    <option value="">{lang === 'fa' ? '— هنوز پرسنلی تعریف نشده —' : '— No personnel defined yet —'}</option>
                  )}
                </select>
              </div>
            )}

            {/* Personnel dropdown */}
            {!!draft.assigneePersonnelId && (
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'انتخاب فرد' : 'Select Person'}</label>
                <select
                  value={draft.assigneePersonnelId}
                  onChange={e => setDraft(d => ({ ...d, assigneePersonnelId: e.target.value }))}
                  className={inputCls}
                >
                  {activePersonnel.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} — {(p.roles || []).join('، ')}
                    </option>
                  ))}
                  {activePersonnel.length === 0 && (
                    <option value="">{lang === 'fa' ? '— پرسنلی وجود ندارد —' : '— No active personnel —'}</option>
                  )}
                </select>
              </div>
            )}

            <p className="text-[11px] text-orange-600">
              {lang === 'fa'
                ? 'اگه چند نفر یک سمت داشته باشند، به کسی که کارتابل کم‌ترِ باری داره ارجاع می‌شه. اگه کسی پیدا نشد → مدیرعامل.'
                : 'If multiple people share a role, the one with fewest active tickets gets assigned. If none found → CEO/master.'}
            </p>
          </div>

          {/* Access control — master only */}
          {isMaster && (
            <div className="border border-violet-100 bg-violet-50/50 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-violet-700 flex items-center gap-1.5">
                🔒 {lang === 'fa' ? 'سطح دسترسی فرم' : 'Form Access Control'}
              </p>
              <p className="text-[11px] text-violet-500">
                {lang === 'fa'
                  ? 'اگه هیچ‌کدام انتخاب نشود، همه پرسنل می‌توانند ببینند.'
                  : 'If nothing is selected, all staff can view this form.'}
              </p>

              {/* Allowed roles */}
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'محدود به سمت‌ها' : 'Allowed Roles'}</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {uniqueRoles.map(role => {
                    const selected = (draft.allowedRoles || []).includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setDraft(d => ({
                          ...d,
                          allowedRoles: selected
                            ? (d.allowedRoles || []).filter(r => r !== role)
                            : [...(d.allowedRoles || []), role]
                        }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${selected ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'}`}
                      >
                        {role}
                      </button>
                    );
                  })}
                  {uniqueRoles.length === 0 && <p className="text-xs text-gray-400">{lang === 'fa' ? 'سمتی تعریف نشده' : 'No roles defined'}</p>}
                </div>
              </div>

              {/* Allowed personnel */}
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'محدود به افراد خاص' : 'Allowed Specific People'}</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {activePersonnel.map(p => {
                    const selected = (draft.allowedPersonnelIds || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDraft(d => ({
                          ...d,
                          allowedPersonnelIds: selected
                            ? (d.allowedPersonnelIds || []).filter(id => id !== p.id)
                            : [...(d.allowedPersonnelIds || []), p.id]
                        }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${selected ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-400'}`}
                      >
                        {p.fullName}
                      </button>
                    );
                  })}
                  {activePersonnel.length === 0 && <p className="text-xs text-gray-400">{lang === 'fa' ? 'پرسنلی وجود ندارد' : 'No personnel'}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: fields */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {lang === 'fa' ? `فیلدها (${draft.fields.length})` : `Fields (${draft.fields.length})`}
            </p>
            <button onClick={addField} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
              <IconPlus className="w-3.5 h-3.5" />
              {lang === 'fa' ? 'افزودن فیلد' : 'Add Field'}
            </button>
          </div>

          {draft.fields.length === 0 && (
            <div className="py-10 text-center">
              <IconClipboard className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{lang === 'fa' ? 'فیلدی ندارید. کلیک کنید تا اضافه کنید.' : 'No fields yet. Click "Add Field" to start.'}</p>
            </div>
          )}

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {draft.fields.map((field, idx) => (
              <div key={field.id} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/50">
                {/* Header row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 font-bold w-5 text-center">{idx + 1}</span>
                  <select
                    value={field.type}
                    onChange={e => setField(idx, { type: e.target.value as FormFieldType })}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{lang === 'fa' ? t.fa : t.en}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={e => setField(idx, { required: e.target.checked })}
                      className="w-3.5 h-3.5"
                    />
                    {lang === 'fa' ? 'اجباری' : 'Required'}
                  </label>
                  <div className="flex gap-1">
                    <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1">↑</button>
                    <button onClick={() => moveField(idx, 1)} disabled={idx === draft.fields.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1">↓</button>
                    <button onClick={() => removeField(idx)} className="text-red-400 hover:text-red-600 text-xs px-1">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {field.type !== 'header' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'برچسب (فارسی)' : 'Label (FA)'}</label>
                      <input value={field.label} onChange={e => setField(idx, { label: e.target.value })} placeholder="مثال: نام شرکت" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'برچسب (انگلیسی)' : 'Label (EN)'}</label>
                      <input value={field.labelEn || ''} onChange={e => setField(idx, { labelEn: e.target.value })} placeholder="e.g. Company Name" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'راهنما (فارسی)' : 'Placeholder (FA)'}</label>
                      <input value={field.placeholder || ''} onChange={e => setField(idx, { placeholder: e.target.value })} placeholder="مثال: نام شرکت خود را وارد کنید" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'راهنما (انگلیسی)' : 'Placeholder (EN)'}</label>
                      <input value={field.placeholderEn || ''} onChange={e => setField(idx, { placeholderEn: e.target.value })} placeholder="e.g. Enter company name" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                    </div>
                    {field.type === 'select' && (
                      <>
                        <div>
                          <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'گزینه‌ها (فارسی) — با کاما جدا کنید' : 'Options (FA) — comma-separated'}</label>
                          <input
                            value={(field.options || []).join('، ')}
                            onChange={e => setField(idx, { options: e.target.value.split(/[،,]/).map(s => s.trim()).filter(Boolean) })}
                            placeholder="مثال: گزینه ۱، گزینه ۲"
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'گزینه‌ها (انگلیسی) — با کاما جدا کنید' : 'Options (EN) — comma-separated'}</label>
                          <input
                            value={(field.optionsEn || []).join(', ')}
                            onChange={e => setField(idx, { optionsEn: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                            placeholder="e.g. Option 1, Option 2"
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            dir="ltr"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'عنوان بخش (فارسی)' : 'Section Title (FA)'}</label>
                      <input value={field.label} onChange={e => setField(idx, { label: e.target.value })} placeholder="مثال: اطلاعات محصول" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 font-medium">{lang === 'fa' ? 'عنوان بخش (انگلیسی)' : 'Section Title (EN)'}</label>
                      <input value={field.labelEn || ''} onChange={e => setField(idx, { labelEn: e.target.value })} placeholder="e.g. Product Information" className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300" dir="ltr" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {draft.fields.length > 0 && (
            <button onClick={addField} className="w-full py-2 border-2 border-dashed border-gray-200 text-sm text-gray-400 rounded-xl hover:border-indigo-300 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2">
              <IconPlus className="w-4 h-4" />
              {lang === 'fa' ? 'افزودن فیلد جدید' : 'Add another field'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── JSON Import Modal ──
  const closeImport = () => { setJsonImportOpen(false); setJsonText(''); setJsonError(''); setJsonImportTab('import'); };

  const JsonImportModal = jsonImportOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <IconFile className="w-4 h-4 text-indigo-500" />
            {lang === 'fa' ? 'ورود / ساخت فرم با JSON' : 'Import / Build Form via JSON'}
          </h3>
          <button onClick={closeImport} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          <button
            onClick={() => setJsonImportTab('import')}
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors mr-6 ${jsonImportTab === 'import' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {lang === 'fa' ? 'وارد کردن JSON' : 'Import JSON'}
          </button>
          {isMaster && (
            <button
              onClick={() => setJsonImportTab('ai')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${jsonImportTab === 'ai' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <IconMagic className="w-3.5 h-3.5" />
              {lang === 'fa' ? 'ساخت با AI' : 'Build with AI'}
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {jsonImportTab === 'import' ? (
            <>
              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* File pick zone */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-indigo-200 rounded-xl py-5 flex flex-col items-center gap-2 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors group"
              >
                <IconUpload className="w-7 h-7 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                <p className="text-sm font-semibold text-indigo-600">
                  {lang === 'fa' ? 'انتخاب فایل JSON از دیسک' : 'Choose JSON file from disk'}
                </p>
                <p className="text-xs text-gray-400">
                  {lang === 'fa' ? 'پسوند .json — فایل را کلیک کنید یا بکشید' : 'Click to browse or drag a .json file'}
                </p>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">{lang === 'fa' ? 'یا' : 'or'}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Paste textarea */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {lang === 'fa' ? 'پیست کردن محتوای JSON' : 'Paste JSON content'}
                </label>
                <textarea
                  value={jsonText}
                  onChange={e => { setJsonText(e.target.value); setJsonError(''); }}
                  rows={10}
                  dir="ltr"
                  placeholder='{"title": "...", "fields": [...]}'
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-xs font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>

              {jsonError && (
                <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  ⚠ {jsonError}
                </p>
              )}

              <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
                {isMaster && (
                  <button
                    onClick={downloadSampleJson}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <IconFile className="w-3.5 h-3.5" />
                    {lang === 'fa' ? 'دانلود نمونه JSON' : 'Download sample JSON'}
                  </button>
                )}
                <div className="flex gap-2">
                  <button onClick={closeImport} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    {lang === 'fa' ? 'لغو' : 'Cancel'}
                  </button>
                  <button onClick={handleImportJson} disabled={!jsonText.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                    {lang === 'fa' ? 'وارد کردن و ویرایش' : 'Import & Edit'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* AI workflow steps */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-indigo-700">
                  {lang === 'fa' ? 'چطور با AI فرم بسازم؟' : 'How to build a form with AI?'}
                </p>
                <ol className={`text-xs text-indigo-600 space-y-1 ${lang === 'fa' ? 'pr-4' : 'pl-4'} list-decimal`}>
                  {lang === 'fa' ? (
                    <>
                      <li>Prompt زیر را کپی کن و در ChatGPT یا Claude پیست کن</li>
                      <li>بنویس «می‌خوام فرم [موضوع فرم] بسازم» و ارسال کن</li>
                      <li>خروجی JSON را کپی کن</li>
                      <li>به تب «وارد کردن JSON» برگرد و پیست کن</li>
                    </>
                  ) : (
                    <>
                      <li>Copy the prompt below and paste it in ChatGPT or Claude</li>
                      <li>Tell it what form you want to create and send</li>
                      <li>Copy the JSON output</li>
                      <li>Go to the "Import JSON" tab and paste it</li>
                    </>
                  )}
                </ol>
              </div>

              {/* Prompt box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {lang === 'fa' ? 'Prompt آماده برای AI' : 'Ready-to-use AI Prompt'}
                  </label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(buildAiPrompt(lang)).then(() => {
                        setCopiedPrompt(true);
                        setTimeout(() => setCopiedPrompt(false), 2500);
                      });
                    }}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${copiedPrompt ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {copiedPrompt
                      ? <><IconCheck className="w-3.5 h-3.5" />{lang === 'fa' ? 'کپی شد!' : 'Copied!'}</>
                      : <><IconCopy className="w-3.5 h-3.5" />{lang === 'fa' ? 'کپی Prompt' : 'Copy Prompt'}</>
                    }
                  </button>
                </div>
                <pre
                  dir="ltr"
                  className="w-full px-3 py-3 rounded-lg border border-gray-200 text-[11px] font-mono bg-gray-50 overflow-auto max-h-72 whitespace-pre-wrap text-gray-600 select-all"
                >
                  {buildAiPrompt(lang)}
                </pre>
              </div>

              {/* Sample JSON reference */}
              <details className="group">
                <summary className="text-xs font-semibold text-gray-500 cursor-pointer hover:text-gray-700 flex items-center gap-1.5 select-none">
                  <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                  {lang === 'fa' ? 'نمونه JSON کامل (مرجع)' : 'Full JSON sample (reference)'}
                </summary>
                <pre dir="ltr" className="mt-2 w-full px-3 py-3 rounded-lg border border-gray-100 text-[10px] font-mono bg-gray-50 overflow-auto max-h-64 whitespace-pre text-gray-500 select-all">
                  {SAMPLE_JSON}
                </pre>
              </details>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setJsonImportTab('import')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
                >
                  {lang === 'fa' ? 'رفتن به وارد کردن JSON ←' : 'Go to Import JSON →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── List ──
  return (
    <div className="space-y-5 animate-fade-in">
      {JsonImportModal}

      {googleFormFor && (
        <GoogleScriptModal
          lang={lang}
          title={googleFormFor.title}
          script={buildGoogleFormScript(googleFormFor)}
          noteFa={googleFormFor.fields.some(f => f.type === 'file')
            ? '⚠️ این فرم فیلد «بارگذاری فایل» دارد. در گوگل‌فرم، آن فیلد به‌صورت درخواست «لینک فایل» نمایش داده می‌شود (به‌دلیل محدودیت دسترسی آپلود مستقیم گوگل‌فرم).'
            : undefined}
          onClose={() => setGoogleFormFor(null)}
        />
      )}

      {serviceReqGoogleOpen && (
        <GoogleScriptModal
          lang={lang}
          title={lang === 'fa' ? 'فرم ثبت درخواست خدمات' : 'Service Request Form'}
          subtitle={serviceReqMulti
            ? (lang === 'fa'
                ? 'حالت چند‌خدمت: مشتری می‌تواند در صورت نیاز چند خدمت را هم‌زمان انتخاب کند. برای هر خدمتِ انتخابی یک «درخواست جداگانه» ثبت و طبق تنظیمات «ارجاع سرویس/زیرخدمت» سامانه، مستقل به کارشناس مربوطه ارجاع داده می‌شود — دقیقاً مانند ثبت درخواست بومی که چند تیکت می‌سازد.'
                : 'Multi-service mode: the customer may pick several services at once. Each selected service becomes a SEPARATE ticket, independently auto-routed by the platform’s service/sub-service rules — exactly like the native form that creates multiple tickets.')
            : (lang === 'fa'
                ? 'حالت تک‌خدمت: مشتری یک «نوع خدمت» را انتخاب می‌کند، سپس فقط «زیرخدمت‌های» همان خدمت به او نشان داده می‌شود (بخش‌بندی شرطی)، و در پایان اطلاعات تماس را پر می‌کند. هر پاسخ طبق تنظیمات «ارجاع سرویس/زیرخدمت» سامانه ارجاع داده می‌شود.'
                : 'Single-service mode: the customer picks one service type, then sees only that service’s sub-services (conditional sections), then contact info. Routed by the platform’s service/sub-service rules.')}
          script={buildServiceRequestGoogleScript(services, formFields, serviceReqMulti)}
          noteFa={serviceReqMulti
            ? 'ℹ️ چون انتخاب خدمت چندتایی است، گوگل‌فرم امکان «نمایش شرطی» زیرخدمت‌ها را ندارد؛ بنابراین گروه زیرخدمتِ هر خدمت با راهنمای واضح نمایش داده می‌شود و مشتری فقط زیرخدمت‌های خدمات انتخابی‌اش را پر می‌کند. زیرخدمت‌های خدمات انتخاب‌نشده نادیده گرفته می‌شوند.'
            : 'ℹ️ ارجاع بر اساس «نوع خدمت» و «زیرخدمت‌های» انتخابی انجام می‌شود (طبق تنظیمات بخش خدمات و تعرفه‌ها). فیلد «بارگذاری فایل» نیز در گوگل‌فرم به «لینک فایل» تبدیل می‌شود.'}
          extraControls={
            <div className="flex flex-wrap items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl p-2.5">
              <span className="text-xs font-bold text-indigo-900 px-1">{lang === 'fa' ? 'حالت انتخاب خدمت:' : 'Service selection mode:'}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setServiceReqMulti(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${!serviceReqMulti ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {lang === 'fa' ? 'تک‌خدمت (زیرخدمت شرطی)' : 'Single (conditional subs)'}
                </button>
                <button
                  onClick={() => setServiceReqMulti(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${serviceReqMulti ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                  {lang === 'fa' ? 'چند‌خدمت' : 'Multiple'}
                </button>
              </div>
            </div>
          }
          onClose={() => setServiceReqGoogleOpen(false)}
        />
      )}

      {connectOpen && (() => {
        const svc = services.find(s => s.id === connectServiceId);
        const per = personnel.find(p => p.id === connectAssigneeId);
        const targetLabel = connectMode === 'service'
          ? (svc?.title || (lang === 'fa' ? 'خدمت انتخاب نشده' : 'no service'))
          : (connectAssigneeType === 'person' ? (per?.fullName || '—') : (connectAssigneeRole || '—'));
        const script = buildExistingFormConnectScript({
          mode: connectMode,
          serviceId: connectServiceId,
          serviceTitle: svc?.title,
          assigneeId: connectAssigneeType === 'person' ? connectAssigneeId : '',
          assigneeRole: connectAssigneeType === 'role' ? connectAssigneeRole : '',
          targetLabel,
        });
        const steps = lang === 'fa'
          ? [
              'گوگل‌فرمِ موجود خود را باز کنید.',
              'از منوی بالای فرم، روی «⋮» (سه‌نقطه) ← Apps Script کلیک کنید (یا Extensions ← Apps Script).',
              'کل کد پیش‌فرض را پاک کنید و کد زیر را جای‌گذاری کنید (دکمه کپی).',
              'ذخیره کنید (Ctrl+S).',
              'از نوار بالا تابع «setupConnect» را انتخاب و دکمه Run (▷) را بزنید.',
              'بار اول پنجره مجوز باز می‌شود: Review Permissions ← انتخاب حساب گوگل ← Advanced ← Go to (unsafe) ← Allow.',
              'تمام! از این پس هر پاسخ این فرم در کارتابل ثبت و طبق ارجاع تعیین‌شده ارسال می‌شود.',
            ]
          : [
              'Open your existing Google Form.',
              'From the form’s top menu click “⋮” → Apps Script (or Extensions → Apps Script).',
              'Delete all default code and paste the code below (Copy button).',
              'Save (Ctrl+S).',
              'Select the function “setupConnect” from the top bar and click Run (▷).',
              'First run opens an auth dialog: Review Permissions → pick account → Advanced → Go to (unsafe) → Allow.',
              'Done — every response now lands in the cartable and is routed as configured.',
            ];
        const inputSel = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-300";
        const tabBtn = (active: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-green-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`;
        return (
          <GoogleScriptModal
            lang={lang}
            title={lang === 'fa' ? 'اتصال گوگل‌فرم موجود' : 'Connect existing Google Form'}
            subtitle={lang === 'fa'
              ? 'گوگل‌فرمی که خودتان از قبل ساخته‌اید را به سامانه وصل کنید. این کد را داخل اسکریپتِ همان فرم می‌گذارید و از آن پس پاسخ‌ها به‌صورت تیکت در کارتابل می‌نشینند. نام و شماره‌ی تماس به‌صورت خودکار از سؤالات فرم تشخیص داده می‌شوند.'
              : 'Connect a Google Form you already built. Paste this code into that form’s own Apps Script; from then on responses land in the cartable as tickets. Name & phone are auto-detected from the question titles.'}
            steps={steps}
            script={script}
            noteFa={'ℹ️ برای تشخیص خودکار، بهتر است عنوان سؤال‌های نام و تماس شامل کلماتی مثل «نام»، «تلفن»، «موبایل» یا «شماره» باشد. ارجاع طبق گزینه‌ای که در بالا انتخاب کرده‌اید انجام می‌شود.'}
            extraControls={
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">{lang === 'fa' ? 'این فرم به چه کسی ارجاع شود؟' : 'Route this form to:'}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setConnectMode('service')} className={tabBtn(connectMode === 'service')}>{lang === 'fa' ? 'بر اساس خدمت' : 'By service'}</button>
                    <button onClick={() => setConnectMode('assignee')} className={tabBtn(connectMode === 'assignee')}>{lang === 'fa' ? 'شخص / نقش' : 'Person / role'}</button>
                  </div>
                </div>
                {connectMode === 'service' ? (
                  <select value={connectServiceId} onChange={e => setConnectServiceId(e.target.value)} className={inputSel}>
                    <option value="">{lang === 'fa' ? '— انتخاب خدمت (برای ارجاع خودکار) —' : '— select service —'}</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      <button onClick={() => setConnectAssigneeType('person')} className={tabBtn(connectAssigneeType === 'person')}>{lang === 'fa' ? 'شخص مشخص' : 'Specific person'}</button>
                      <button onClick={() => setConnectAssigneeType('role')} className={tabBtn(connectAssigneeType === 'role')}>{lang === 'fa' ? 'نقش' : 'Role'}</button>
                    </div>
                    {connectAssigneeType === 'person' ? (
                      <select value={connectAssigneeId} onChange={e => setConnectAssigneeId(e.target.value)} className={inputSel}>
                        <option value="">{lang === 'fa' ? '— انتخاب شخص —' : '— select person —'}</option>
                        {activePersonnel.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                      </select>
                    ) : (
                      <select value={connectAssigneeRole} onChange={e => setConnectAssigneeRole(e.target.value)} className={inputSel}>
                        <option value="">{lang === 'fa' ? '— انتخاب نقش —' : '— select role —'}</option>
                        {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>
            }
            onClose={() => setConnectOpen(false)}
          />
        );
      })()}

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full text-center space-y-4">
            <p className="font-bold text-gray-900">{lang === 'fa' ? 'حذف فرم؟' : 'Delete Form?'}</p>
            <p className="text-sm text-gray-500">{lang === 'fa' ? 'این عمل قابل بازگشت نیست.' : 'This action cannot be undone.'}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">{lang === 'fa' ? 'لغو' : 'Cancel'}</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">{lang === 'fa' ? 'حذف' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><IconClipboard className="w-5 h-5" /></div>
          <div>
            <h2 className="text-base font-bold text-gray-800">{lang === 'fa' ? 'فرم‌ها و استانداردها' : 'Forms & Standards'}</h2>
            <p className="text-xs text-gray-400">{lang === 'fa' ? `${customForms.length} فرم` : `${customForms.length} forms`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={lang === 'fa' ? 'جستجو...' : 'Search...'}
              className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44"
              dir={lang === 'fa' ? 'rtl' : 'ltr'}
            />
          </div>
          {isMaster && (
            <button
              onClick={downloadSampleJson}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              title={lang === 'fa' ? 'دانلود نمونه JSON' : 'Download sample JSON'}
            >
              <IconFile className="w-3.5 h-3.5" />
              {lang === 'fa' ? 'نمونه JSON' : 'Sample JSON'}
            </button>
          )}
          {isMaster && (
            <button
              onClick={() => { setArchiveFormId(''); setArchiveSearch(''); setExpandedSubmissionId(null); setView('archive'); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors"
            >
              📊 {lang === 'fa' ? 'بایگانی' : 'Archive'}
            </button>
          )}
          {isEditor && (
            <>
              <button onClick={() => setConnectOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-green-200 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-50 transition-colors">
                <IconLink className="w-3.5 h-3.5" />
                {lang === 'fa' ? 'اتصال گوگل‌فرم موجود' : 'Connect existing Google Form'}
              </button>
              <button onClick={() => setJsonImportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <IconUpload className="w-3.5 h-3.5" />
                {lang === 'fa' ? 'ورود JSON' : 'Import JSON'}
              </button>
              <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                <IconPlus className="w-4 h-4" />
                {lang === 'fa' ? 'فرم جدید' : 'New Form'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Built-in Service Request form (main system form) */}
      <div className="bg-gradient-to-l from-indigo-600 to-violet-600 rounded-2xl p-5 shadow-sm text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white/20 p-2.5 rounded-xl shrink-0"><IconClipboard className="w-6 h-6" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold">{lang === 'fa' ? 'فرم ثبت درخواست خدمات' : 'Service Request Form'}</h3>
                <span className="text-[10px] font-bold bg-white/25 px-2 py-0.5 rounded-full">{lang === 'fa' ? 'فرم اصلی سامانه' : 'System form'}</span>
              </div>
              <p className="text-xs text-white/80 mt-1 leading-relaxed">
                {lang === 'fa'
                  ? `فرم رسمی ثبت درخواست — ${services.length} خدمت، ${formFields.length} فیلد. پاسخ‌ها بر اساس «نوع خدمت» خودکار به کارشناس مربوطه ارجاع می‌شوند.`
                  : `The official request form — ${services.length} services, ${formFields.length} fields. Responses are auto-routed to the right specialist by service type.`}
              </p>
            </div>
          </div>
          {isEditor && (
            <button
              onClick={() => setServiceReqGoogleOpen(true)}
              disabled={services.length === 0}
              title={services.length === 0 ? (lang === 'fa' ? 'ابتدا در بخش «خدمات و تعرفه‌ها» خدمت تعریف کنید' : 'Define services first') : ''}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <IconLink className="w-4 h-4" />
              {lang === 'fa' ? 'اتصال به گوگل‌فرم' : 'Connect to Google Form'}
            </button>
          )}
        </div>

        {/* Public "Request" button → external link (e.g. the generated Google Form) */}
        {isEditor && onUpdateRequestUrl && (
          <div className="mt-4 pt-4 border-t border-white/15">
            <label className="block text-xs font-semibold text-white/90 mb-1.5">
              {lang === 'fa' ? 'لینک دکمه‌ی «ثبت درخواست» در سایت عمومی (مثلاً لینک گوگل‌فرم)' : 'Public "Request" button link (e.g. Google Form)'}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={reqUrlDraft}
                onChange={e => setReqUrlDraft(e.target.value)}
                dir="ltr"
                placeholder="https://docs.google.com/forms/..."
                className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-sm text-gray-900 bg-white/95 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/60"
              />
              <button
                onClick={saveReqUrl}
                className="px-4 py-2 bg-white text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors shrink-0"
              >
                {reqUrlSaved ? (lang === 'fa' ? '✓ ذخیره شد' : '✓ Saved') : (lang === 'fa' ? 'ذخیره لینک' : 'Save link')}
              </button>
              {reqUrlDraft.trim() && (
                <button
                  onClick={clearReqUrl}
                  className="px-3 py-2 bg-white/15 text-white rounded-lg text-sm font-medium hover:bg-white/25 transition-colors shrink-0"
                >
                  {lang === 'fa' ? 'حذف لینک' : 'Clear'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-white/75 mt-1.5 leading-relaxed">
              {requestExternalUrl?.trim()
                ? (lang === 'fa' ? '✓ همه‌ی دکمه‌های «ثبت درخواست» در سایت عمومی این لینک را در تب جدید باز می‌کنند.' : '✓ All public "Request" buttons open this link in a new tab.')
                : (lang === 'fa' ? 'اگر خالی بماند، دکمه‌ها مثل قبل فرم داخلی سامانه را باز می‌کنند.' : 'If empty, buttons open the built-in in-app form.')}
            </p>
          </div>
        )}
      </div>

      {/* Form grid */}
      {filteredForms.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
          <IconClipboard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold text-sm">
            {searchQ ? (lang === 'fa' ? 'فرمی پیدا نشد.' : 'No forms found.') : (lang === 'fa' ? 'هیچ فرمی وجود ندارد.' : 'No forms yet.')}
          </p>
          {!searchQ && isEditor && (
            <p className="text-xs text-gray-400 mt-1">{lang === 'fa' ? 'با کلیک روی «فرم جدید» شروع کنید.' : 'Click "New Form" to get started.'}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForms.map(form => (
            <div key={form.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <IconFolder className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {form.isClosed && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        ⏳ {lang === 'fa' ? 'بسته‌شده' : 'Closed'}
                      </span>
                    )}
                    {form.isPublic && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {lang === 'fa' ? 'عمومی' : 'Public'}
                      </span>
                    )}
                    {((form.allowedRoles?.length ?? 0) > 0 || (form.allowedPersonnelIds?.length ?? 0) > 0) && (
                      <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                        🔒 {lang === 'fa' ? 'محدود' : 'Restricted'}
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                      {form.category || (lang === 'fa' ? 'عمومی' : 'General')}
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-0.5 leading-snug">{form.title}</h3>
                {form.titleEn && <p className="text-xs text-gray-400 mb-1.5" dir="ltr">{form.titleEn}</p>}
                {form.description && <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{form.description}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                  <span>{form.fields.length} {lang === 'fa' ? 'فیلد' : 'fields'}</span>
                  <button
                    type="button"
                    onClick={() => goToFormArchive(form.id)}
                    className="text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    {formSubmissionCounts[form.id] || 0} {lang === 'fa' ? 'پاسخ' : 'responses'}
                  </button>
                  {form.allowAttachments && (
                    <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                      📎 {lang === 'fa' ? 'ضمیمه فعال' : 'Attachments ON'}
                    </span>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="px-4 pb-4 flex flex-wrap gap-1.5 border-t border-gray-50 pt-3">
                <button
                  onClick={() => openPreview(form)}
                  className="flex-1 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {lang === 'fa' ? 'پیش‌نمایش' : 'Preview'}
                </button>
                {form.isPublic && (
                  <button
                    onClick={() => copyLink(form)}
                    title={getPublicUrl(form)}
                    className={`flex items-center gap-1 py-1.5 px-2.5 text-xs font-medium rounded-lg border transition-colors ${copiedId === form.id ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50'}`}
                  >
                    {copiedId === form.id ? <IconCheck className="w-3.5 h-3.5" /> : <IconLink className="w-3.5 h-3.5" />}
                    {copiedId === form.id ? (lang === 'fa' ? 'کپی شد' : 'Copied') : (lang === 'fa' ? 'لینک' : 'Link')}
                  </button>
                )}
                {isEditor && (
                  <>
                    <button
                      onClick={() => setGoogleFormFor(form)}
                      title={lang === 'fa' ? 'ساخت نسخه گوگل‌فرم از این فرم' : 'Generate a Google Form version'}
                      className="flex items-center gap-1 py-1.5 px-2.5 text-xs font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <IconLink className="w-3.5 h-3.5" />
                      {lang === 'fa' ? 'گوگل‌فرم' : 'Google Form'}
                    </button>
                    <button
                      onClick={() => exportJson(form)}
                      className="py-1.5 px-2.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => toggleClosed(form)}
                      title={form.isClosed ? (lang === 'fa' ? 'فعال‌سازی مجدد فرم' : 'Reopen form') : (lang === 'fa' ? 'بستن فرم (توقف دریافت پاسخ)' : 'Close form (stop submissions)')}
                      className={`py-1.5 px-2.5 text-xs font-medium rounded-lg border transition-colors ${form.isClosed ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                    >
                      {form.isClosed ? (lang === 'fa' ? 'فعال‌سازی' : 'Reopen') : (lang === 'fa' ? 'بستن فرم' : 'Close')}
                    </button>
                    <button
                      onClick={() => openEdit(form)}
                      className="py-1.5 px-2.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <IconEdit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(form.id)}
                      className="py-1.5 px-2.5 text-xs font-medium text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
