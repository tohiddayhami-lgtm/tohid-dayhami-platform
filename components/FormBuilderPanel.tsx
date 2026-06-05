
import React, { useState, useRef } from 'react';
import { CustomForm, FormField, FormFieldType, Personnel } from '../types';
import { Language } from '../App';
import { saveCustomFormToCloud, updateCustomFormInCloud, deleteCustomFormFromCloud } from '../services/firebaseService';
import { IconPlus, IconTrash, IconEdit, IconClipboard, IconFolder, IconCopy, IconLink, IconCheck, IconFile } from './Icons';

interface Props {
  customForms: CustomForm[];
  currentUser: Personnel;
  isMaster: boolean;
  isAdmin: boolean;
  lang: Language;
}

type PanelView = 'list' | 'builder' | 'preview';

const FIELD_TYPES: { value: FormFieldType; fa: string; en: string }[] = [
  { value: 'text',     fa: 'متن کوتاه',     en: 'Short Text' },
  { value: 'textarea', fa: 'متن بلند',       en: 'Long Text' },
  { value: 'email',    fa: 'ایمیل',          en: 'Email' },
  { value: 'tel',      fa: 'تلفن',           en: 'Phone' },
  { value: 'number',   fa: 'عدد',            en: 'Number' },
  { value: 'date',     fa: 'تاریخ',          en: 'Date' },
  { value: 'select',   fa: 'لیست انتخابی',  en: 'Dropdown' },
  { value: 'checkbox', fa: 'چک‌باکس',       en: 'Checkbox' },
  { value: 'header',   fa: 'سرتیتر (جداکننده)', en: 'Section Header' },
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
  fields: [], allowedRoles: [], isPublic: true,
});

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors";
const labelCls = "block text-xs font-semibold text-gray-500 mb-1";

export const FormBuilderPanel: React.FC<Props> = ({ customForms, currentUser, isMaster, isAdmin, lang }) => {
  const [view, setView] = useState<PanelView>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft());
  const [previewForm, setPreviewForm] = useState<CustomForm | null>(null);
  const [previewLang, setPreviewLang] = useState<Language>(lang);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [jsonImportOpen, setJsonImportOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const isEditor = isAdmin || isMaster;

  const getPublicUrl = (form: CustomForm) =>
    `${window.location.origin}${window.location.pathname}#/f/${form.id}`;

  const copyLink = (form: CustomForm) => {
    navigator.clipboard.writeText(getPublicUrl(form)).then(() => {
      setCopiedId(form.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
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
      allowedRoles: form.allowedRoles, isPublic: form.isPublic ?? false,
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

  // ────────────────────────── RENDER ──────────────────────────

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
  const JsonImportModal = jsonImportOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{lang === 'fa' ? 'وارد کردن فرم از JSON' : 'Import Form from JSON'}</h3>
          <button onClick={() => { setJsonImportOpen(false); setJsonText(''); setJsonError(''); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-gray-500">
          {lang === 'fa'
            ? 'JSON ساختار فرم را در کادر زیر جای‌گذاری کنید. می‌توانید از خروجی JSON فرم‌های دیگر استفاده کنید.'
            : 'Paste the form JSON below. You can use exported JSON from existing forms.'}
        </p>
        <textarea
          value={jsonText}
          onChange={e => { setJsonText(e.target.value); setJsonError(''); }}
          rows={10}
          dir="ltr"
          placeholder='{"title": "...", "fields": [...]}'
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
        {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={() => { setJsonImportOpen(false); setJsonText(''); setJsonError(''); }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            {lang === 'fa' ? 'لغو' : 'Cancel'}
          </button>
          <button onClick={handleImportJson} disabled={!jsonText.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {lang === 'fa' ? 'وارد کردن' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── List ──
  return (
    <div className="space-y-5 animate-fade-in">
      {JsonImportModal}

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
          {isEditor && (
            <>
              <button onClick={() => setJsonImportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <IconFile className="w-3.5 h-3.5" />
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
                  <div className="flex items-center gap-1.5">
                    {form.isPublic && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        {lang === 'fa' ? 'عمومی' : 'Public'}
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
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <span>{form.fields.length} {lang === 'fa' ? 'فیلد' : 'fields'}</span>
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
                      onClick={() => exportJson(form)}
                      className="py-1.5 px-2.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      JSON
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
