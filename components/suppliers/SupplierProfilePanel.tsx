import React, { useState } from 'react';
import type { Personnel } from '../../types';
import type {
  GlobalSupplier, SupplierProposal, SupplierEvaluationCriteria, SupplierTag,
  SupplierProduct, SupplierServiceItem, SupplierDocument, SupplierCommunication, SupplierReminder,
  SupplierMergedLists,
} from '../../types/supplier';
import type { SupplierPermissions } from '../../types/supplier';
import {
  SUPPLIER_STATUSES,
  STATUS_LABELS, PROPOSAL_STATUS_LABELS, SUPPLIER_PROPOSAL_STATUSES,
} from '../../utils/supplierConstants';
import { addActivity, addEvaluation } from '../../utils/supplierUtils';
import { exportSupplierEnvelope, downloadSupplierJson } from '../../utils/supplierFormat';
import { supplierDisplayScore } from '../../utils/supplierAccess';
import { uploadFileWithProgress } from '../../services/firebaseService';
import {
  IconStar, IconPlus, IconTrash, IconUpload, IconHistory, IconFileText,
  IconMail, IconNote, IconAward, IconClock, IconGlobe, IconCheck,
} from '../Icons';

const IconX = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

interface Props {
  supplier: GlobalSupplier;
  onClose: () => void;
  onSave: (s: GlobalSupplier) => Promise<void>;
  permissions: SupplierPermissions;
  currentUser: Personnel;
  personnel: Personnel[];
  lang: 'fa' | 'en';
  lists: SupplierMergedLists;
}

type Tab = 'general' | 'contact' | 'products' | 'proposals' | 'evaluation' | 'notes' | 'timeline' | 'documents' | 'comms' | 'reminders';

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const CRITERIA_KEYS: (keyof SupplierEvaluationCriteria)[] = [
  'quality', 'price', 'communication', 'deliverySpeed', 'packaging',
  'reliability', 'responseTime', 'flexibility', 'documentation', 'professionalism',
];

const CRITERIA_LABELS: Record<keyof SupplierEvaluationCriteria, { en: string; fa: string }> = {
  quality: { en: 'Quality', fa: 'کیفیت' },
  price: { en: 'Price', fa: 'قیمت' },
  communication: { en: 'Communication', fa: 'ارتباط' },
  deliverySpeed: { en: 'Delivery Speed', fa: 'سرعت تحویل' },
  packaging: { en: 'Packaging', fa: 'بسته‌بندی' },
  reliability: { en: 'Reliability', fa: 'قابلیت اطمینان' },
  responseTime: { en: 'Response Time', fa: 'زمان پاسخ' },
  flexibility: { en: 'Flexibility', fa: 'انعطاف' },
  documentation: { en: 'Documentation', fa: 'مستندات' },
  professionalism: { en: 'Professionalism', fa: 'حرفه‌ای‌گری' },
};

const inputCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400';
const labelCls = 'text-[10px] font-bold text-gray-400 uppercase block mb-1';

export const SupplierProfilePanel: React.FC<Props> = ({
  supplier: initial, onClose, onSave, permissions, currentUser, personnel, lang, lists,
}) => {
  const [draft, setDraft] = useState<GlobalSupplier>(JSON.parse(JSON.stringify(initial)));
  const [tab, setTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [evalCriteria, setEvalCriteria] = useState<SupplierEvaluationCriteria>({
    quality: 3, price: 3, communication: 3, deliverySpeed: 3, packaging: 3,
    reliability: 3, responseTime: 3, flexibility: 3, documentation: 3, professionalism: 3,
  });
  const [evalNotes, setEvalNotes] = useState('');
  const [proposalDraft, setProposalDraft] = useState<Partial<SupplierProposal>>({ status: 'new' });

  const canEdit = permissions.canEdit;
  const canEval = permissions.canEvaluate;
  const canDocs = permissions.canManageDocuments;
  const canFinance = permissions.canViewFinancials;

  const patch = (updates: Partial<GlobalSupplier>) => setDraft(d => ({ ...d, ...updates }));
  const patchGeneral = (updates: Partial<GlobalSupplier['general']>) =>
    setDraft(d => ({ ...d, general: { ...d.general, ...updates } }));
  const patchContact = (updates: Partial<GlobalSupplier['contact']>) =>
    setDraft(d => ({ ...d, contact: { ...d.contact, ...updates } }));

  const handleSave = async () => {
    setSaving(true);
    addActivity(draft, { type: 'updated', title: 'Profile updated', createdBy: currentUser.fullName, createdByPersonnelId: currentUser.id });
    await onSave(draft);
    setSaving(false);
  };

  const addTag = (tag: Omit<SupplierTag, 'id'>) => {
    const t: SupplierTag = { ...tag, id: uid('tag') };
    patch({ tags: [...draft.tags, t] });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note = {
      id: uid('note'),
      content: newNote.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName || currentUser.username,
      createdByPersonnelId: currentUser.id,
    };
    patch({ internalNotes: [...draft.internalNotes, note] });
    addActivity(draft, { type: 'note', title: 'Note added', description: newNote.slice(0, 80) });
    setNewNote('');
  };

  const handleAddEvaluation = () => {
    if (!canEval) return;
    addEvaluation(draft, evalCriteria, evalNotes, { fullName: currentUser.fullName, id: currentUser.id });
    setEvalNotes('');
  };

  const handleAddProposal = () => {
    if (!proposalDraft.title?.trim()) return;
    const p: SupplierProposal = {
      id: uid('prop'),
      title: proposalDraft.title,
      proposalDate: proposalDraft.proposalDate || new Date().toISOString().slice(0, 10),
      products: proposalDraft.products,
      prices: canFinance ? proposalDraft.prices : undefined,
      currency: proposalDraft.currency,
      moq: proposalDraft.moq,
      deliveryTime: proposalDraft.deliveryTime,
      validity: proposalDraft.validity,
      notes: proposalDraft.notes,
      status: proposalDraft.status || 'new',
      createdAt: new Date().toISOString(),
    };
    patch({ proposals: [...draft.proposals, p] });
    addActivity(draft, { type: 'proposal', title: `Proposal: ${p.title}` });
    setProposalDraft({ status: 'new' });
  };

  const uploadDoc = (file: File) => {
    if (!canDocs) return;
    uploadFileWithProgress(file, () => {}, url => {
      const doc: SupplierDocument = {
        id: uid('doc'),
        name: file.name,
        docType: file.type.includes('pdf') ? 'pdf' : 'file',
        url,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
      };
      patch({ documents: [...draft.documents, doc] });
      addActivity(draft, { type: 'document', title: `Document uploaded: ${file.name}` });
    }, () => {}, 'documents');
  };

  const handleExportJson = () => {
    const safe = (draft.companyName || 'supplier').replace(/[^\w\-]+/g, '_').slice(0, 40);
    downloadSupplierJson(exportSupplierEnvelope(draft), `supplier_${safe}.json`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: lang === 'fa' ? 'عمومی' : 'General' },
    { id: 'contact', label: lang === 'fa' ? 'تماس' : 'Contact' },
    { id: 'products', label: lang === 'fa' ? 'محصولات/خدمات' : 'Products' },
    { id: 'proposals', label: lang === 'fa' ? 'پیشنهادها' : 'Proposals' },
    { id: 'evaluation', label: lang === 'fa' ? 'ارزیابی' : 'Evaluation' },
    { id: 'notes', label: lang === 'fa' ? 'یادداشت' : 'Notes' },
    { id: 'timeline', label: lang === 'fa' ? 'تایم‌لاین' : 'Timeline' },
    { id: 'documents', label: lang === 'fa' ? 'اسناد' : 'Documents' },
    { id: 'comms', label: lang === 'fa' ? 'ارتباطات' : 'Comms' },
    { id: 'reminders', label: lang === 'fa' ? 'یادآور' : 'Reminders' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-gray-50">
          <div className="flex items-center gap-3 min-w-0">
            {draft.general.logoUrl ? (
              <img src={draft.general.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover border" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-200 flex items-center justify-center font-black text-gray-500">
                {(draft.companyName || '?')[0]}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-black text-gray-900 truncate">{draft.companyName || (lang === 'fa' ? 'تأمین‌کننده جدید' : 'New Supplier')}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <IconGlobe className="w-3.5 h-3.5" />
                <span>{draft.general.country || '—'}</span>
                <span className="font-black text-amber-600">{supplierDisplayScore(draft)}/5</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={handleExportJson}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100">
              JSON
            </button>
            {canEdit && (
              <button type="button" onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                <IconCheck className="w-4 h-4" />
                {saving ? '...' : (lang === 'fa' ? 'ذخیره' : 'Save')}
              </button>
            )}
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-200"><IconX className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex gap-1 p-2 border-b border-gray-100 overflow-x-auto bg-white">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${tab === t.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'general' && (
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className={labelCls}>{lang === 'fa' ? 'نام شرکت' : 'Company Name'}</label>
                <input className={inputCls} value={draft.companyName} disabled={!canEdit}
                  onChange={e => patch({ companyName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'دسته' : 'Category'}</label>
                <select className={inputCls} value={draft.productCategory || ''} disabled={!canEdit}
                  onChange={e => patch({ productCategory: e.target.value })}>
                  <option value="">—</option>
                  {lists.categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'وضعیت' : 'Status'}</label>
                <select className={inputCls} value={draft.status} disabled={!canEdit}
                  onChange={e => patch({ status: e.target.value as GlobalSupplier['status'] })}>
                  {SUPPLIER_STATUSES.map(s => <option key={s} value={s}>{lang === 'fa' ? STATUS_LABELS[s].fa : STATUS_LABELS[s].en}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'کشور' : 'Country'}</label>
                <select className={inputCls} value={draft.general.countryCode || ''} disabled={!canEdit}
                  onChange={e => {
                    const c = lists.countries.find(x => x.code === e.target.value);
                    patchGeneral({ countryCode: e.target.value, country: c?.name || '' });
                  }}>
                  <option value="">—</option>
                  {lists.countries.map(c => <option key={c.code} value={c.code}>{c.flag || '🌍'} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'شهر' : 'City'}</label>
                <input className={inputCls} value={draft.general.city || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ city: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{lang === 'fa' ? 'آدرس' : 'Address'}</label>
                <textarea className={inputCls} rows={2} value={draft.general.address || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ address: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'وب‌سایت' : 'Website'}</label>
                <input className={inputCls} value={draft.general.website || draft.website || ''} disabled={!canEdit}
                  onChange={e => { patchGeneral({ website: e.target.value }); patch({ website: e.target.value }); }} />
              </div>
              <div>
                <label className={labelCls}>Google Maps</label>
                <input className={inputCls} value={draft.general.googleMapsUrl || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ googleMapsUrl: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'سال تأسیس' : 'Established'}</label>
                <input className={inputCls} value={draft.general.establishedYear || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ establishedYear: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'اندازه شرکت' : 'Company Size'}</label>
                <input className={inputCls} value={draft.general.companySize || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ companySize: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{lang === 'fa' ? 'توضیحات' : 'Description'}</label>
                <textarea className={inputCls} rows={4} value={draft.general.description || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ description: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'شماره مجوز' : 'License No.'}</label>
                <input className={inputCls} value={draft.general.businessLicenseNumber || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ businessLicenseNumber: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>{lang === 'fa' ? 'ظرفیت تولید' : 'Capacity'}</label>
                <input className={inputCls} value={draft.general.manufacturingCapacity || ''} disabled={!canEdit}
                  onChange={e => patchGeneral({ manufacturingCapacity: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{lang === 'fa' ? 'برچسب‌ها' : 'Tags'}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {draft.tags.map(t => (
                    <span key={t.id} className="px-2 py-1 rounded-full text-[10px] font-bold text-white flex items-center gap-1"
                      style={{ backgroundColor: t.color }}>
                      {t.label}
                      {canEdit && <button type="button" onClick={() => patch({ tags: draft.tags.filter(x => x.id !== t.id) })}>×</button>}
                    </span>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex gap-2 flex-wrap">
                    {lists.tags.slice(0, 8).map(t => (
                      <button key={t.id} type="button" onClick={() => addTag({ label: t.label, color: t.color })}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold border" style={{ borderColor: t.color, color: t.color }}>
                        + {t.label}
                      </button>
                    ))}
                    <input className="w-24 px-2 py-1 border rounded-lg text-xs" placeholder="Custom" value={newTagLabel}
                      onChange={e => setNewTagLabel(e.target.value)} />
                    <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="w-8 h-8" />
                    <button type="button" onClick={() => { if (newTagLabel) { addTag({ label: newTagLabel, color: newTagColor }); setNewTagLabel(''); } }}
                      className="px-2 py-1 bg-gray-900 text-white rounded-lg text-xs font-bold">Add</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'contact' && (
            <div className="grid md:grid-cols-2 gap-3">
              {([
                ['mainContactName', lang === 'fa' ? 'نام تماس' : 'Contact Name'],
                ['position', lang === 'fa' ? 'سمت' : 'Position'],
                ['email', 'Email'],
                ['phone', lang === 'fa' ? 'تلفن' : 'Phone'],
                ['mobile', lang === 'fa' ? 'موبایل' : 'Mobile'],
                ['whatsapp', 'WhatsApp'],
                ['wechat', 'WeChat'],
                ['telegram', 'Telegram'],
                ['linkedin', 'LinkedIn'],
                ['preferredCommunication', lang === 'fa' ? 'ترجیح ارتباط' : 'Preferred'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input className={inputCls} value={draft.contact[key] || ''} disabled={!canEdit}
                    onChange={e => patchContact({ [key]: e.target.value })} />
                </div>
              ))}
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black text-gray-800 mb-2">{lang === 'fa' ? 'محصولات' : 'Products'}</h3>
                {draft.products.map((p, i) => (
                  <div key={p.id} className="p-3 border rounded-xl mb-2 grid md:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Name" value={p.name} disabled={!canEdit}
                      onChange={e => { const products = [...draft.products]; products[i] = { ...p, name: e.target.value }; patch({ products }); }} />
                    <input className={inputCls} placeholder="MOQ" value={p.moq || ''} disabled={!canEdit}
                      onChange={e => { const products = [...draft.products]; products[i] = { ...p, moq: e.target.value }; patch({ products }); }} />
                    {canFinance && (
                      <input className={inputCls} placeholder="Price list" value={p.priceList || ''} disabled={!canEdit}
                        onChange={e => { const products = [...draft.products]; products[i] = { ...p, priceList: e.target.value }; patch({ products }); }} />
                    )}
                    {canEdit && (
                      <button type="button" className="text-red-500 text-xs font-bold"
                        onClick={() => patch({ products: draft.products.filter(x => x.id !== p.id) })}>
                        <IconTrash className="w-4 h-4 inline" /> Remove
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button type="button" className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold flex items-center gap-1"
                    onClick={() => patch({ products: [...draft.products, { id: uid('prod'), name: '' }] })}>
                    <IconPlus className="w-4 h-4" /> {lang === 'fa' ? 'افزودن محصول' : 'Add Product'}
                  </button>
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-800 mb-2">{lang === 'fa' ? 'خدمات' : 'Services'}</h3>
                {draft.supplierServices.map((s, i) => (
                  <div key={s.id} className="p-3 border rounded-xl mb-2 flex gap-2">
                    <input className={inputCls} placeholder="Service name" value={s.name} disabled={!canEdit}
                      onChange={e => { const supplierServices = [...draft.supplierServices]; supplierServices[i] = { ...s, name: e.target.value }; patch({ supplierServices }); }} />
                    {canEdit && (
                      <button type="button" onClick={() => patch({ supplierServices: draft.supplierServices.filter(x => x.id !== s.id) })}>
                        <IconTrash className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <button type="button" className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold flex items-center gap-1"
                    onClick={() => patch({ supplierServices: [...draft.supplierServices, { id: uid('svc'), name: '' }] })}>
                    <IconPlus className="w-4 h-4" /> {lang === 'fa' ? 'افزودن خدمت' : 'Add Service'}
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === 'proposals' && (
            <div className="space-y-4">
              {draft.proposals.slice().reverse().map(p => (
                <div key={p.id} className="p-4 border border-gray-100 rounded-2xl bg-gray-50">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-black text-gray-800">{p.title}</h4>
                      <p className="text-xs text-gray-400">{p.proposalDate}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PROPOSAL_STATUS_LABELS[p.status].color}`}>
                      {lang === 'fa' ? PROPOSAL_STATUS_LABELS[p.status].fa : PROPOSAL_STATUS_LABELS[p.status].en}
                    </span>
                  </div>
                  {p.products && <p className="text-sm mt-2 text-gray-600">{p.products}</p>}
                  {canFinance && p.prices && <p className="text-sm font-bold text-emerald-700 mt-1">{p.prices} {p.currency}</p>}
                  {p.notes && <p className="text-xs text-gray-500 mt-2">{p.notes}</p>}
                </div>
              ))}
              {canEdit && (
                <div className="p-4 border-2 border-dashed border-gray-200 rounded-2xl space-y-2">
                  <h4 className="text-sm font-black">{lang === 'fa' ? 'پیشنهاد جدید' : 'New Proposal'}</h4>
                  <input className={inputCls} placeholder="Title" value={proposalDraft.title || ''}
                    onChange={e => setProposalDraft(d => ({ ...d, title: e.target.value }))} />
                  <input type="date" className={inputCls} value={proposalDraft.proposalDate || ''}
                    onChange={e => setProposalDraft(d => ({ ...d, proposalDate: e.target.value }))} />
                  <textarea className={inputCls} rows={2} placeholder="Products" value={proposalDraft.products || ''}
                    onChange={e => setProposalDraft(d => ({ ...d, products: e.target.value }))} />
                  {canFinance && (
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inputCls} placeholder="Prices" value={proposalDraft.prices || ''}
                        onChange={e => setProposalDraft(d => ({ ...d, prices: e.target.value }))} />
                      <input className={inputCls} placeholder="Currency" value={proposalDraft.currency || ''}
                        onChange={e => setProposalDraft(d => ({ ...d, currency: e.target.value }))} />
                    </div>
                  )}
                  <select className={inputCls} value={proposalDraft.status || 'new'}
                    onChange={e => setProposalDraft(d => ({ ...d, status: e.target.value as SupplierProposal['status'] }))}>
                    {SUPPLIER_PROPOSAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={handleAddProposal}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">
                    {lang === 'fa' ? 'ثبت پیشنهاد' : 'Add Proposal'}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'evaluation' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                <IconAward className="w-8 h-8 text-amber-500" />
                <div>
                  <div className="text-2xl font-black text-amber-700">{supplierDisplayScore(draft)}/5</div>
                  <div className="text-xs text-amber-600">{draft.evaluations.length} {lang === 'fa' ? 'ارزیابی' : 'evaluations'}</div>
                </div>
              </div>
              {canEval && (
                <div className="p-4 border rounded-2xl space-y-3">
                  <h4 className="text-sm font-black">{lang === 'fa' ? 'ارزیابی جدید' : 'New Evaluation'}</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {CRITERIA_KEYS.map(key => (
                      <div key={key}>
                        <label className={labelCls}>{lang === 'fa' ? CRITERIA_LABELS[key].fa : CRITERIA_LABELS[key].en}</label>
                        <input type="range" min={1} max={5} step={1} className="w-full"
                          value={evalCriteria[key]}
                          onChange={e => setEvalCriteria(c => ({ ...c, [key]: Number(e.target.value) }))} />
                        <span className="text-xs font-bold">{evalCriteria[key]}/5</span>
                      </div>
                    ))}
                  </div>
                  <textarea className={inputCls} rows={2} placeholder="Notes" value={evalNotes}
                    onChange={e => setEvalNotes(e.target.value)} />
                  <button type="button" onClick={handleAddEvaluation}
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold">
                    {lang === 'fa' ? 'ثبت ارزیابی' : 'Submit Evaluation'}
                  </button>
                </div>
              )}
              {draft.evaluations.slice().reverse().map(ev => (
                <div key={ev.id} className="p-3 border rounded-xl text-sm">
                  <div className="font-black text-gray-800">{ev.overallScore}/5 — {ev.evaluatedBy}</div>
                  <div className="text-xs text-gray-400">{new Date(ev.evaluatedAt).toLocaleString()}</div>
                  {ev.notes && <p className="mt-1 text-gray-600">{ev.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {tab === 'notes' && (
            <div className="space-y-3">
              {canEdit && (
                <div className="flex gap-2">
                  <textarea className={inputCls} rows={2} value={newNote} onChange={e => setNewNote(e.target.value)}
                    placeholder={lang === 'fa' ? 'یادداشت داخلی...' : 'Internal note...'} />
                  <button type="button" onClick={handleAddNote} className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold self-end">
                    {lang === 'fa' ? 'افزودن' : 'Add'}
                  </button>
                </div>
              )}
              {draft.internalNotes.slice().reverse().map(n => (
                <div key={n.id} className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="text-xs text-indigo-400 font-bold mb-1">{n.createdBy} · {new Date(n.createdAt).toLocaleString()}</div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-2">
              {draft.activities.slice().reverse().map(a => (
                <div key={a.id} className="flex gap-3 p-3 border-b border-gray-50">
                  <IconHistory className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-gray-800">{a.title}</div>
                    <div className="text-[10px] text-gray-400">{new Date(a.createdAt).toLocaleString()} · {a.type}</div>
                    {a.description && <p className="text-xs text-gray-500 mt-1">{a.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-3">
              {canDocs && (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl py-8 cursor-pointer hover:border-indigo-300">
                  <IconUpload className="w-8 h-8 text-gray-300 mb-2" />
                  <span className="text-xs text-gray-400">{lang === 'fa' ? 'آپلود PDF, Excel, Word, تصویر' : 'Upload PDF, Excel, Word, Image'}</span>
                  <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = ''; }} />
                </label>
              )}
              {draft.documents.map(d => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 p-3 border rounded-xl hover:bg-gray-50">
                  <IconFileText className="w-5 h-5 text-indigo-500" />
                  <div>
                    <div className="text-sm font-bold text-gray-800">{d.name}</div>
                    <div className="text-[10px] text-gray-400">{new Date(d.uploadedAt).toLocaleDateString()}</div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {tab === 'comms' && (
            <div className="space-y-3">
              {draft.communications.slice().reverse().map(c => (
                <div key={c.id} className="p-3 border rounded-xl">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                    <IconMail className="w-4 h-4" /> {c.type} — {c.subject || '—'}
                  </div>
                  <div className="text-[10px] text-gray-400">{new Date(c.date).toLocaleString()}</div>
                  {c.notes && <p className="text-sm text-gray-600 mt-1">{c.notes}</p>}
                </div>
              ))}
              {canEdit && (
                <button type="button" className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold"
                  onClick={() => {
                    const comm: SupplierCommunication = {
                      id: uid('comm'), type: 'call', subject: 'Follow-up', notes: '',
                      date: new Date().toISOString(), createdBy: currentUser.fullName,
                    };
                    patch({ communications: [...draft.communications, comm], lastContact: comm.date });
                  }}>
                  + {lang === 'fa' ? 'ثبت تماس' : 'Log Communication'}
                </button>
              )}
            </div>
          )}

          {tab === 'reminders' && (
            <div className="space-y-3">
              {draft.reminders.map(r => (
                <div key={r.id} className={`p-3 border rounded-xl flex items-center gap-3 ${r.completed ? 'opacity-50' : ''}`}>
                  <IconClock className="w-4 h-4 text-rose-500" />
                  <div className="flex-1">
                    <div className="text-sm font-bold">{r.title}</div>
                    <div className="text-[10px] text-gray-400">{r.type} · {new Date(r.dueDate).toLocaleDateString()}</div>
                  </div>
                  {canEdit && (
                    <button type="button" className="text-xs font-bold text-emerald-600"
                      onClick={() => patch({ reminders: draft.reminders.map(x => x.id === r.id ? { ...x, completed: !x.completed } : x) })}>
                      {r.completed ? 'Undo' : 'Done'}
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <button type="button" className="px-3 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold"
                  onClick={() => {
                    const rem: SupplierReminder = {
                      id: uid('rem'), type: 'follow_up', title: 'Follow up',
                      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
                      createdAt: new Date().toISOString(),
                    };
                    patch({ reminders: [...draft.reminders, rem] });
                  }}>
                  + {lang === 'fa' ? 'یادآور جدید' : 'New Reminder'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
