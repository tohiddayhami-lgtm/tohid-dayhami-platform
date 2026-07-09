import React, { useMemo, useState } from 'react';
import type { Personnel } from '../../types';
import type { SupplierCountryOption, SupplierListSettings, SupplierTag } from '../../types/supplier';
import { saveSupplierListSettings } from '../../services/supplierService';
import { emptySupplierListSettings, genCountryCode, buildSupplierLists } from '../../utils/supplierLists';
import { SUPPLIER_CATEGORIES, COUNTRIES, DEFAULT_SUPPLIER_TAGS } from '../../utils/supplierConstants';
import { IconPlus, IconTrash, IconCheck, IconSettings } from '../Icons';

const IconX = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

interface Props {
  settings: SupplierListSettings;
  currentUser: Personnel;
  canEdit: boolean;
  lang: 'fa' | 'en';
  onSaved: (s: SupplierListSettings) => void;
  onClose: () => void;
}

type Tab = 'categories' | 'countries' | 'services' | 'tags';

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const SupplierListSettingsPanel: React.FC<Props> = ({
  settings, currentUser, canEdit, lang, onSaved, onClose,
}) => {
  const [draft, setDraft] = useState<SupplierListSettings>(JSON.parse(JSON.stringify(settings)));
  const [tab, setTab] = useState<Tab>('categories');
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newSvc, setNewSvc] = useState('');
  const [newCountry, setNewCountry] = useState({ name: '', code: '', flag: '🌍' });
  const [newTag, setNewTag] = useState({ label: '', color: '#6366f1' });
  const isFa = lang === 'fa';
  const previewLists = useMemo(() => buildSupplierLists(draft), [draft]);

  const addCategory = () => {
    const v = newCat.trim();
    if (!v) return;
    setDraft(d => ({
      ...d,
      extraCategories: [...new Set([...d.extraCategories, v])],
      removedCategories: d.removedCategories.filter(x => x !== v),
    }));
    setNewCat('');
  };

  const removeCategory = (c: string) => {
    setDraft(d => {
      const isBuiltin = (SUPPLIER_CATEGORIES as readonly string[]).includes(c);
      if (isBuiltin) {
        return {
          ...d,
          removedCategories: [...new Set([...d.removedCategories, c])],
          extraCategories: d.extraCategories.filter(x => x !== c),
        };
      }
      return { ...d, extraCategories: d.extraCategories.filter(x => x !== c) };
    });
  };

  const restoreCategory = (c: string) => {
    setDraft(d => ({ ...d, removedCategories: d.removedCategories.filter(x => x !== c) }));
  };

  const addCountry = () => {
    const name = newCountry.name.trim();
    if (!name) return;
    const codes = new Set(previewLists.countries.map(c => c.code));
    const code = (newCountry.code.trim().toUpperCase() || genCountryCode(name, codes));
    const entry: SupplierCountryOption = { code, name, flag: newCountry.flag || '🌍', custom: true };
    setDraft(d => ({
      ...d,
      extraCountries: [...d.extraCountries.filter(c => c.code !== code), entry],
      removedCountryCodes: d.removedCountryCodes.filter(c => c !== code),
    }));
    setNewCountry({ name: '', code: '', flag: '🌍' });
  };

  const removeCountry = (c: SupplierCountryOption) => {
    setDraft(d => {
      if (c.custom) {
        return { ...d, extraCountries: d.extraCountries.filter(x => x.code !== c.code) };
      }
      return { ...d, removedCountryCodes: [...new Set([...d.removedCountryCodes, c.code])] };
    });
  };

  const restoreCountry = (code: string) => {
    setDraft(d => ({ ...d, removedCountryCodes: d.removedCountryCodes.filter(c => c !== code) }));
  };

  const addServiceType = () => {
    const v = newSvc.trim();
    if (!v) return;
    setDraft(d => ({
      ...d,
      extraServiceTypes: [...new Set([...d.extraServiceTypes, v])],
      removedServiceTypes: d.removedServiceTypes.filter(x => x !== v),
    }));
    setNewSvc('');
  };

  const removeServiceType = (v: string) => {
    setDraft(d => ({
      ...d,
      extraServiceTypes: d.extraServiceTypes.filter(x => x !== v),
      removedServiceTypes: [...new Set([...d.removedServiceTypes, v])],
    }));
  };

  const restoreServiceType = (v: string) => {
    setDraft(d => ({ ...d, removedServiceTypes: d.removedServiceTypes.filter(x => x !== v) }));
  };

  const addTag = () => {
    const label = newTag.label.trim();
    if (!label) return;
    const tag: SupplierTag = { id: uid('tag'), label, color: newTag.color };
    setDraft(d => ({
      ...d,
      extraTags: [...d.extraTags.filter(t => t.label !== label), tag],
      removedTagLabels: d.removedTagLabels.filter(l => l !== label),
    }));
    setNewTag({ label: '', color: '#6366f1' });
  };

  const removeTag = (label: string, isBuiltin: boolean) => {
    setDraft(d => {
      if (isBuiltin) {
        return {
          ...d,
          removedTagLabels: [...new Set([...d.removedTagLabels, label])],
          extraTags: d.extraTags.filter(t => t.label !== label),
        };
      }
      return { ...d, extraTags: d.extraTags.filter(t => t.label !== label) };
    });
  };

  const restoreTag = (label: string) => {
    setDraft(d => ({ ...d, removedTagLabels: d.removedTagLabels.filter(l => l !== label) }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await saveSupplierListSettings(draft, currentUser);
      onSaved(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'categories', label: isFa ? 'دسته‌ها' : 'Categories' },
    { id: 'countries', label: isFa ? 'کشورها' : 'Countries' },
    { id: 'services', label: isFa ? 'انواع خدمت' : 'Service types' },
    { id: 'tags', label: isFa ? 'برچسب‌ها' : 'Tags' },
  ];

  const inputCls = 'flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconSettings className="w-5 h-5 text-gray-500" />
            <h2 className="font-black text-gray-900">{isFa ? 'مدیریت لیست‌ها' : 'Manage lists'}</h2>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <button type="button" onClick={() => void handleSave()} disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                <IconCheck className="w-4 h-4" />{saving ? '…' : (isFa ? 'ذخیره' : 'Save')}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><IconX className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!canEdit && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              {isFa ? 'فقط مشاهده — برای ویرایش لیست‌ها مجوز ویرایش تأمین‌کنندگان لازم است.' : 'View only — edit permission required to change lists.'}
            </p>
          )}

          {tab === 'categories' && (
            <>
              {canEdit && (
                <div className="flex gap-2">
                  <input className={inputCls} placeholder={isFa ? 'دسته جدید...' : 'New category...'} value={newCat} onChange={e => setNewCat(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCategory()} />
                  <button type="button" onClick={addCategory} className="px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1">
                    <IconPlus className="w-4 h-4" />{isFa ? 'افزودن' : 'Add'}
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {previewLists.categories.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-bold text-gray-700 border border-gray-200">
                    {c}
                    {canEdit && (
                      <button type="button" onClick={() => removeCategory(c)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3 h-3" /></button>
                    )}
                  </span>
                ))}
              </div>
              {draft.removedCategories.length > 0 && canEdit && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 mb-2">{isFa ? 'حذف‌شده — بازیابی:' : 'Removed — restore:'}</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.removedCategories.map(c => (
                      <button key={c} type="button" onClick={() => restoreCategory(c)}
                        className="px-2 py-1 rounded-lg text-xs border border-dashed border-gray-300 text-gray-500 line-through hover:no-underline hover:border-teal-400">
                        {c} ↩
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'countries' && (
            <>
              {canEdit && (
                <div className="grid sm:grid-cols-4 gap-2">
                  <input className={inputCls + ' sm:col-span-2'} placeholder={isFa ? 'نام کشور' : 'Country name'} value={newCountry.name}
                    onChange={e => setNewCountry(c => ({ ...c, name: e.target.value }))} />
                  <input className={inputCls} placeholder={isFa ? 'کد (اختیاری)' : 'Code (opt.)'} value={newCountry.code}
                    onChange={e => setNewCountry(c => ({ ...c, code: e.target.value }))} />
                  <div className="flex gap-2">
                    <input className="w-12 px-2 py-2 border rounded-xl text-center" value={newCountry.flag}
                      onChange={e => setNewCountry(c => ({ ...c, flag: e.target.value }))} />
                    <button type="button" onClick={addCountry} className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold">
                      <IconPlus className="w-4 h-4 inline" />
                    </button>
                  </div>
                </div>
              )}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {previewLists.countries.map(c => (
                  <div key={c.code} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm">
                    <span>{c.flag || '🌍'} {c.name} <span className="text-[10px] text-gray-400">({c.code})</span>{c.custom && <span className="text-[9px] text-teal-600 mr-1">custom</span>}</span>
                    {canEdit && (
                      <button type="button" onClick={() => removeCountry(c)} className="text-red-400 hover:text-red-600 p-1"><IconTrash className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              {draft.removedCountryCodes.length > 0 && canEdit && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 mb-2">{isFa ? 'کشورهای حذف‌شده:' : 'Removed countries:'}</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.removedCountryCodes.map(code => {
                      const c = COUNTRIES.find(x => x.code === code);
                      return (
                        <button key={code} type="button" onClick={() => restoreCountry(code)}
                          className="px-2 py-1 rounded-lg text-xs border border-dashed text-gray-500">
                          {c ? `${c.flag} ${c.name}` : code} ↩
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'services' && (
            <>
              {canEdit && (
                <div className="flex gap-2">
                  <input className={inputCls} placeholder={isFa ? 'نوع خدمت جدید...' : 'New service type...'} value={newSvc} onChange={e => setNewSvc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addServiceType()} />
                  <button type="button" onClick={addServiceType} className="px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"><IconPlus className="w-4 h-4" /></button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {previewLists.serviceTypes.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-xs font-bold text-indigo-800 border border-indigo-100">
                    {s}
                    {canEdit && <button type="button" onClick={() => removeServiceType(s)} className="text-red-400"><IconTrash className="w-3 h-3" /></button>}
                  </span>
                ))}
              </div>
              {draft.removedServiceTypes.length > 0 && canEdit && (
                <div className="flex flex-wrap gap-2">
                  {draft.removedServiceTypes.map(s => (
                    <button key={s} type="button" onClick={() => restoreServiceType(s)} className="px-2 py-1 text-xs border border-dashed rounded-lg text-gray-500">{s} ↩</button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'tags' && (
            <>
              {canEdit && (
                <div className="flex gap-2 flex-wrap items-center">
                  <input className={inputCls} placeholder={isFa ? 'برچسب جدید' : 'New tag'} value={newTag.label}
                    onChange={e => setNewTag(t => ({ ...t, label: e.target.value }))} />
                  <input type="color" value={newTag.color} onChange={e => setNewTag(t => ({ ...t, color: e.target.value }))} className="w-10 h-10 rounded-lg" />
                  <button type="button" onClick={addTag} className="px-3 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold"><IconPlus className="w-4 h-4" /></button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {previewLists.tags.map(t => (
                  <span key={t.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: t.color }}>
                    {t.label}
                    {canEdit && (
                      <button type="button" onClick={() => removeTag(t.label, DEFAULT_SUPPLIER_TAGS.some(dt => dt.label === t.label))} className="opacity-80 hover:opacity-100">×</button>
                    )}
                  </span>
                ))}
              </div>
              {draft.removedTagLabels.length > 0 && canEdit && (
                <div className="flex flex-wrap gap-2">
                  {draft.removedTagLabels.map(l => (
                    <button key={l} type="button" onClick={() => restoreTag(l)} className="px-2 py-1 text-xs border border-dashed rounded-lg text-gray-500">{l} ↩</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
