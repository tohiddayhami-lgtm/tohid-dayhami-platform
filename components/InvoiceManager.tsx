import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceAdjustment, InvoiceTemplate, InvoiceSectionKey, InvoiceSectionPreset, Customer, Personnel, AppConfig } from '../types';
import { IconPrinter, IconPlus, IconTrash, IconCheck, IconSearch, IconEdit, IconInvoice, IconUsers, IconSettings, IconUpload } from './Icons';
import { uploadFileWithProgress, saveInvoiceSectionPresetToCloud, deleteInvoiceSectionPresetFromCloud, subscribeToInvoiceSectionPresets, saveCustomerToCloud } from '../services/firebaseService';
import { Language } from '../App';
import {
  INVOICE_PRESET_CURRENCIES,
  INVOICE_CURRENCY_CUSTOM,
  formatInvoiceMoney,
  parseInvoiceAmount,
  isPresetInvoiceCurrency,
} from '../utils/invoiceMoney';
import { exportInvoicePdf } from '../utils/exportInvoicePdf';

const normalizePhone = (p: string) => (p || '').replace(/\D/g, '');

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  config: AppConfig;
  currentUser: Personnel;
  lang: Language;
  onSaveInvoice: (invoice: Invoice) => Promise<void>;
  onDeleteInvoice: (id: string) => Promise<void>;
  onUpdateConfig: (config: AppConfig) => void;
  readonly?: boolean;
}

const DARK = '#111827';

const defaultTemplate = (config: AppConfig): InvoiceTemplate => config.invoiceTemplate || {
  companyName: config.appTitle, address: '', phone: '', footerText: 'Thank you for choosing our services.',
  termsConditions: '', defaultTaxRate: 5, colorTheme: '#0f766e',
};

// Invoice number generator → e.g. INV-2026-0609-01275
const genInvoiceNumber = (template: InvoiceTemplate, count: number): string => {
  const prefix = template.invoicePrefix || 'INV';
  const now = new Date();
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String((count + 1) % 100000 + Math.floor(now.getTime() % 1000)).padStart(5, '0').slice(-5);
  return `${prefix}-${y}-${mm}${dd}-${seq}`;
};

const cloneItems = (items?: InvoiceItem[]): InvoiceItem[] =>
  (items && items.length > 0 ? items : [{ description: '', quantity: 1, unitPrice: 0, total: 0 }])
    .map(it => ({ ...it, total: (it.quantity || 0) * (it.unitPrice || 0) }));

const emptyDraft = (config: AppConfig, issuedBy: string, count: number): Invoice => {
  const tpl = defaultTemplate(config);
  return {
    id: `inv-${Date.now()}`,
    number: genInvoiceNumber(tpl, count),
    date: new Date().toISOString().split('T')[0],
    customerName: '',
    companyName: '',
    customerPhone: '',
    customerAddress: '',
    customerEmail: '',
    items: cloneItems(tpl.defaultItems),
    adjustments: tpl.defaultAdjustments?.map(a => ({ ...a, id: a.id || `adj-${Date.now()}-${Math.random()}` })) || [],
    currency: tpl.defaultCurrency || 'OMR',
    subTotal: 0, taxRate: tpl.defaultTaxRate ?? 5, taxAmount: 0, discount: 0, total: 0,
    issuedBy,
    status: 'draft',
    createdAt: new Date().toISOString(),
    paymentTerms: tpl.defaultPaymentTerms || '',
    note: tpl.defaultNotes || '',
    vatInclusive: tpl.vatInclusive ?? true,
  };
};

export const InvoiceManager: React.FC<Props> = ({ invoices, customers, config, currentUser, lang, onSaveInvoice, onDeleteInvoice, onUpdateConfig, readonly = false }) => {
  const [mode, setMode] = useState<'archive' | 'editor' | 'company'>('archive');
  const [draft, setDraft] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const template = defaultTemplate(config);
  const accent = template.colorTheme || '#0f766e';
  const [companyForm, setCompanyForm] = useState<InvoiceTemplate>(template);
  const [companySaved, setCompanySaved] = useState(false);
  const [sectionSaved, setSectionSaved] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [sectionPresets, setSectionPresets] = useState<InvoiceSectionPreset[]>([]);
  const [presetSaveSection, setPresetSaveSection] = useState<InvoiceSectionKey | null>(null);
  const [presetSaveName, setPresetSaveName] = useState('');
  const [presetSaving, setPresetSaving] = useState(false);
  const [loadMenuSection, setLoadMenuSection] = useState<InvoiceSectionKey | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const invoiceSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToInvoiceSectionPresets(setSectionPresets);
    return () => unsub();
  }, []);

  const t = {
    fa: {
      title: 'فاکتورها', archive: 'آرشیو فاکتورها', newInvoice: 'فاکتور جدید', companyInfo: 'اطلاعات شرکت',
      search: 'جستجو شماره فاکتور یا نام مشتری...', empty: 'هنوز فاکتوری ثبت نشده است.', noResult: 'موردی یافت نشد.',
      number: 'شماره', customer: 'مشتری', date: 'تاریخ', amount: 'مبلغ', status: 'وضعیت', actions: 'عملیات',
      edit: 'ویرایش', del: 'حذف', print: 'چاپ', save: 'ذخیره', cancel: 'انصراف', back: 'بازگشت به آرشیو',
      deleteConfirm: 'این فاکتور حذف شود؟',
      draft: 'پیش‌نویس', issued: 'صادر شده', paid: 'پرداخت شده',
      pickCustomer: 'انتخاب از بانک مشتریان',
      regenNo: 'تولید شماره جدید',
      saveCompany: 'ذخیره اطلاعات شرکت', savedOk: 'ذخیره شد ✓',
      companyHint: 'این اطلاعات یک‌بار ذخیره می‌شود و در همه فاکتورهای جدید به‌صورت سربرگ استفاده می‌گردد.',
      // company fields
      cName: 'نام شرکت', logo: 'لوگو', uploadLogo: 'آپلود لوگو', uploading: 'در حال آپلود...',
      addr: 'آدرس', cr: 'CR No.', phone: 'تلفن', email: 'ایمیل', website: 'وب‌سایت',
      bankName: 'نام بانک', accHolder: 'صاحب حساب', accNo: 'شماره حساب', swift: 'کد سوئیفت', iban: 'IBAN',
      payTerms: 'شرایط پرداخت پیش‌فرض', notes: 'یادداشت/شرایط پیش‌فرض', footer: 'متن پایانی', defTax: 'مالیات پیش‌فرض (٪)', vatInc: 'مالیات به‌صورت تجمیعی (داخل قیمت)', color: 'رنگ قالب', prefix: 'پیشوند شماره فاکتور',
      type: 'نوع', terms: 'شرایط و قوانین',
    },
    en: {
      title: 'Invoices', archive: 'Invoice Archive', newInvoice: 'New Invoice', companyInfo: 'Company Info',
      search: 'Search invoice no. or customer...', empty: 'No invoices yet.', noResult: 'No results.',
      number: 'No.', customer: 'Customer', date: 'Date', amount: 'Amount', status: 'Status', actions: 'Actions',
      edit: 'Edit', del: 'Delete', print: 'Print', save: 'Save', cancel: 'Cancel', back: 'Back to archive',
      deleteConfirm: 'Delete this invoice?',
      draft: 'Draft', issued: 'Issued', paid: 'Paid',
      pickCustomer: 'Pick from Customer Bank',
      regenNo: 'New number',
      saveCompany: 'Save company info', savedOk: 'Saved ✓',
      companyHint: 'Saved once and reused as the header on every new invoice.',
      cName: 'Company name', logo: 'Logo', uploadLogo: 'Upload logo', uploading: 'Uploading...',
      addr: 'Address', cr: 'CR No.', phone: 'Phone', email: 'Email', website: 'Website',
      bankName: 'Bank name', accHolder: 'Account holder', accNo: 'Account number', swift: 'SWIFT code', iban: 'IBAN',
      payTerms: 'Default payment terms', notes: 'Default notes / terms', footer: 'Footer text', defTax: 'Default tax (%)', vatInc: 'VAT inclusive in prices', color: 'Theme color', prefix: 'Invoice number prefix',
      type: 'Type', terms: 'Terms',
    },
  }[lang];

  const statusLabel = (s?: Invoice['status']) => s === 'paid' ? t.paid : s === 'issued' ? t.issued : t.draft;
  const statusCls = (s?: Invoice['status']) => s === 'paid' ? 'bg-emerald-100 text-emerald-700' : s === 'issued' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(i => i.number.toLowerCase().includes(q) || (i.customerName || '').toLowerCase().includes(q) || (i.companyName || '').toLowerCase().includes(q));
  }, [invoices, search]);

  // ── Calculations (supports VAT-inclusive + extra adjustments) ──
  const adjustmentsSum = (inv: Invoice) => (inv.adjustments || []).reduce((acc, a) => acc + (a.amount || 0), 0);

  const recompute = (inv: Invoice): Invoice => {
    const subTotal = inv.items.reduce((acc, it) => acc + (it.total || 0), 0);
    const extras = adjustmentsSum(inv);
    const rate = inv.taxRate || 0;
    const discount = inv.discount || 0;
    let taxAmount: number, total: number;
    if (inv.vatInclusive) {
      const net = rate > 0 ? subTotal / (1 + rate / 100) : subTotal;
      taxAmount = subTotal - net;
      total = subTotal + extras - discount;
    } else {
      taxAmount = (subTotal * rate) / 100;
      total = subTotal + taxAmount + extras - discount;
    }
    return { ...inv, subTotal, taxAmount, total };
  };
  const netAmount = (inv: Invoice) => inv.vatInclusive ? inv.subTotal - inv.taxAmount : inv.subTotal;

  const startNew = () => { setDraft(recompute(emptyDraft(config, currentUser.fullName, invoices.length))); setMode('editor'); };
  const startEdit = (inv: Invoice) => { setDraft(recompute({ ...inv, adjustments: inv.adjustments || [] })); setMode('editor'); };

  const setItem = (idx: number, field: keyof InvoiceItem, value: any) => setDraft(d => {
    if (!d) return d;
    const items = [...d.items];
    const item = { ...items[idx], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') item.total = (item.quantity || 0) * (item.unitPrice || 0);
    items[idx] = item;
    return recompute({ ...d, items });
  });
  const addItem = () => setDraft(d => d ? { ...d, items: [...d.items, { description: '', quantity: 1, unitPrice: 0, total: 0 }] } : d);
  const removeItem = (idx: number) => setDraft(d => d ? recompute({ ...d, items: d.items.filter((_, i) => i !== idx) }) : d);
  const setField = (field: keyof Invoice, value: any) => setDraft(d => d ? recompute({ ...d, [field]: value }) : d);

  const addAdjustment = (preset?: { label: string; amount?: number }) => setDraft(d => {
    if (!d) return d;
    const adj: InvoiceAdjustment = {
      id: `adj-${Date.now()}`,
      label: preset?.label || 'Other charge',
      amount: preset?.amount ?? 0,
    };
    return recompute({ ...d, adjustments: [...(d.adjustments || []), adj] });
  });
  const setAdjustment = (id: string, field: keyof InvoiceAdjustment, value: any) => setDraft(d => {
    if (!d) return d;
    const adjustments = (d.adjustments || []).map(a => a.id === id ? { ...a, [field]: value } : a);
    return recompute({ ...d, adjustments });
  });
  const removeAdjustment = (id: string) => setDraft(d => d ? recompute({ ...d, adjustments: (d.adjustments || []).filter(a => a.id !== id) }) : d);

  const flashSectionSave = (key: string) => { setSectionSaved(key); setTimeout(() => setSectionSaved(null), 2000); };

  const buildPresetFromDraft = (section: InvoiceSectionKey, name: string): InvoiceSectionPreset => {
    if (!draft) throw new Error('No draft');
    const base: InvoiceSectionPreset = {
      id: `preset-${section}-${Date.now()}`,
      name: name.trim(),
      section,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName,
    };
    if (section === 'paymentTerms') {
      base.paymentTerms = draft.paymentTerms || '';
    } else if (section === 'items') {
      base.items = draft.items.map(it => ({ ...it }));
    } else if (section === 'adjustments') {
      base.adjustments = (draft.adjustments || []).map(a => ({ ...a, id: a.id || `adj-${Date.now()}` }));
    } else if (section === 'notes') {
      base.note = draft.note || '';
    } else if (section === 'vat') {
      base.taxRate = draft.taxRate;
      base.vatInclusive = draft.vatInclusive ?? true;
    }
    return base;
  };

  const applySectionPreset = (preset: InvoiceSectionPreset) => {
    setDraft(d => {
      if (!d) return d;
      let next: Invoice = { ...d };
      if (preset.section === 'paymentTerms') {
        next = { ...next, paymentTerms: preset.paymentTerms || '' };
      } else if (preset.section === 'items' && preset.items?.length) {
        next = { ...next, items: preset.items.map(it => ({ ...it, total: (it.quantity || 0) * (it.unitPrice || 0) })) };
      } else if (preset.section === 'adjustments') {
        next = {
          ...next,
          adjustments: (preset.adjustments || []).map(a => ({ ...a, id: a.id || `adj-${Date.now()}-${Math.random()}` })),
        };
      } else if (preset.section === 'notes') {
        next = { ...next, note: preset.note || '' };
      } else if (preset.section === 'vat') {
        next = { ...next, taxRate: preset.taxRate ?? next.taxRate, vatInclusive: preset.vatInclusive ?? next.vatInclusive };
      }
      return recompute(next);
    });
    setLoadMenuSection(null);
  };

  const handleSaveSectionPreset = async (section: InvoiceSectionKey) => {
    if (!draft || readonly || !presetSaveName.trim()) return;
    setPresetSaving(true);
    try {
      await saveInvoiceSectionPresetToCloud(buildPresetFromDraft(section, presetSaveName));
      flashSectionSave(section);
      setPresetSaveSection(null);
      setPresetSaveName('');
    } catch {
      alert(lang === 'fa' ? 'خطا در ذخیره preset' : 'Failed to save preset');
    } finally {
      setPresetSaving(false);
    }
  };

  const handleDeleteSectionPreset = async (id: string) => {
    if (readonly) return;
    if (!window.confirm(lang === 'fa' ? 'این preset حذف شود؟' : 'Delete this preset?')) return;
    try {
      await deleteInvoiceSectionPresetFromCloud(id);
    } catch {
      alert(lang === 'fa' ? 'خطا در حذف' : 'Delete failed');
    }
  };

  const SectionPresetControls: React.FC<{ section: InvoiceSectionKey }> = ({ section }) => {
    if (readonly) return null;
    const list = sectionPresets.filter(p => p.section === section);
    const saveOpen = presetSaveSection === section;
    const loadOpen = loadMenuSection === section;
    return (
      <div className="flex items-center gap-1 print:hidden relative">
        <button
          type="button"
          onClick={() => { setLoadMenuSection(loadOpen ? null : section); setPresetSaveSection(null); }}
          className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${list.length ? 'text-indigo-600 border-indigo-200 hover:bg-indigo-50' : 'text-gray-300 border-gray-100 cursor-not-allowed'}`}
          disabled={!list.length}
          title="Load saved preset"
        >
          Load{list.length ? ` (${list.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => { setPresetSaveSection(saveOpen ? null : section); setLoadMenuSection(null); setPresetSaveName(''); }}
          className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 hover:text-indigo-600 flex items-center gap-0.5 px-1"
          title="Save as new preset"
        >
          <IconCheck className="w-3 h-3" />
          {sectionSaved === section ? 'Saved' : 'Save'}
        </button>
        {loadOpen && list.length > 0 && (
          <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-lg shadow-xl py-1 text-left max-h-48 overflow-y-auto">
            {list.map(p => (
              <div key={p.id} className="flex items-center gap-1 px-2 py-1.5 hover:bg-gray-50 group">
                <button type="button" onClick={() => applySectionPreset(p)} className="flex-1 text-left text-[11px] text-gray-700 truncate">{p.name}</button>
                <button type="button" onClick={() => handleDeleteSectionPreset(p.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 p-0.5" title="Delete"><IconTrash className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        {saveOpen && (
          <div className="absolute right-0 top-full mt-1 z-30 w-52 bg-white border border-gray-200 rounded-lg shadow-xl p-2 text-left">
            <input
              autoFocus
              value={presetSaveName}
              onChange={e => setPresetSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveSectionPreset(section); if (e.key === 'Escape') setPresetSaveSection(null); }}
              placeholder="Preset name…"
              className="w-full px-2 py-1.5 text-[11px] border border-gray-200 rounded outline-none focus:border-indigo-400 mb-1.5"
            />
            <div className="flex gap-1">
              <button type="button" disabled={presetSaving || !presetSaveName.trim()} onClick={() => handleSaveSectionPreset(section)} className="flex-1 text-[10px] font-bold bg-indigo-600 text-white rounded py-1 hover:bg-indigo-700 disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setPresetSaveSection(null)} className="text-[10px] text-gray-500 px-2 py-1 hover:bg-gray-100 rounded">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const pickCustomer = (c: Customer) => {
    setDraft(d => d ? { ...d, customerId: c.id, customerName: c.fullName, companyName: c.companyName || '', customerAddress: c.location || '', customerPhone: c.phoneNumber || '', customerEmail: c.email || '' } : d);
    setShowCustomerPicker(false); setCustomerSearch('');
  };

  const upsertCustomerFromInvoice = async (inv: Invoice): Promise<string | undefined> => {
    const phoneRaw = inv.customerPhone || '';
    const phone = normalizePhone(phoneRaw);
    let existing = inv.customerId ? customers.find(c => c.id === inv.customerId) : undefined;
    if (!existing && phone) existing = customers.find(c => normalizePhone(c.phoneNumber) === phone);

    if (existing) {
      await saveCustomerToCloud({
        ...existing,
        fullName: inv.customerName.trim() || existing.fullName,
        companyName: inv.companyName || existing.companyName,
        location: inv.customerAddress || existing.location,
        phoneNumber: phoneRaw || existing.phoneNumber,
        whatsappNumber: existing.whatsappNumber || phoneRaw || existing.phoneNumber,
        email: inv.customerEmail || existing.email,
      });
      return existing.id;
    }

    if (!inv.customerName.trim()) return undefined;

    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const phoneSuffix = (phone || '0000').slice(-4);
    const newCustomer: Customer = {
      id: `C-${Date.now()}`,
      fullName: inv.customerName.trim(),
      companyName: inv.companyName || '',
      location: inv.customerAddress || '',
      phoneNumber: phoneRaw,
      whatsappNumber: phoneRaw,
      email: inv.customerEmail,
      firstContact: new Date().toISOString(),
      totalTickets: 0,
      source: 'Invoice',
      loyaltyCode: phone ? `VIP-${phoneSuffix}-${randomStr}` : undefined,
    };
    await saveCustomerToCloud(newCustomer);
    return newCustomer.id;
  };

  const handleSave = async () => {
    if (!draft || readonly) return;
    if (!draft.customerName.trim()) { alert(lang === 'fa' ? 'نام مشتری را وارد کنید.' : 'Enter customer name.'); return; }
    setSaving(true);
    try {
      const customerId = await upsertCustomerFromInvoice(draft);
      await onSaveInvoice(recompute({
        ...draft,
        customerId: customerId || draft.customerId,
        createdAt: draft.createdAt || new Date().toISOString(),
      }));
      setMode('archive'); setDraft(null);
    } catch { alert(lang === 'fa' ? 'خطا در ذخیره' : 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleExportPdf = async () => {
    if (!draft || !invoiceSheetRef.current) return;
    setPdfGenerating(true);
    try {
      await exportInvoicePdf(invoiceSheetRef.current, `Invoice-${draft.number || 'draft'}.pdf`);
    } catch {
      alert(lang === 'fa' ? 'خطا در ساخت PDF' : 'PDF export failed');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDelete = async (id: string) => { if (!readonly && window.confirm(t.deleteConfirm)) await onDeleteInvoice(id); };
  const handleSaveCompany = () => { onUpdateConfig({ ...config, invoiceTemplate: companyForm }); setCompanySaved(true); setTimeout(() => setCompanySaved(false), 2500); };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoUploading(true);
    uploadFileWithProgress(file, () => {}, (url) => { setCompanyForm(f => ({ ...f, logoUrl: url })); setLogoUploading(false); }, (err) => { alert(err.message); setLogoUploading(false); }, 'images');
  };

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    const list = q ? customers.filter(c => c.fullName.toLowerCase().includes(q) || (c.companyName || '').toLowerCase().includes(q) || (c.phoneNumber || '').includes(q)) : customers;
    return list.slice(0, 50);
  }, [customers, customerSearch]);

  const cur = (draft?.currency || 'OMR').trim() || 'OMR';
  const money = (n: number) => formatInvoiceMoney(n, cur);
  const fmtDate = (value?: string) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const currencySelectValue = draft && isPresetInvoiceCurrency(draft.currency) ? draft.currency : INVOICE_CURRENCY_CUSTOM;
  const setCurrencyPreset = (code: string) => {
    setDraft(d => {
      if (!d) return d;
      if (code === INVOICE_CURRENCY_CUSTOM) {
        return { ...d, currency: isPresetInvoiceCurrency(d.currency) ? '' : d.currency };
      }
      return { ...d, currency: code };
    });
  };

  const cFld = 'w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:border-indigo-500 text-sm';
  const lbl = 'block text-[13px] font-semibold text-gray-700 mb-1.5';

  // ════════════════════ RENDER ════════════════════
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header / tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><IconInvoice className="w-5 h-5" /></div>
          <h3 className="text-lg font-bold text-gray-800">{t.title}</h3>
          <span className="text-xs text-gray-400">({invoices.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMode('archive'); setDraft(null); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'archive' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t.archive}</button>
          <button onClick={() => { setCompanyForm(template); setMode('company'); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${mode === 'company' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><IconSettings className="w-3.5 h-3.5" />{t.companyInfo}</button>
          {!readonly && <button onClick={startNew} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><IconPlus className="w-4 h-4" />{t.newInvoice}</button>}
        </div>
      </div>

      {/* ───────── ARCHIVE ───────── */}
      {mode === 'archive' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-sm">
              <IconSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
          {invoices.length === 0 ? <div className="py-16 text-center text-sm text-gray-400">{t.empty}</div>
          : filtered.length === 0 ? <div className="py-16 text-center text-sm text-gray-400">{t.noResult}</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr><th className="px-4 py-3 font-medium">{t.number}</th><th className="px-4 py-3 font-medium">{t.customer}</th><th className="px-4 py-3 font-medium">{t.date}</th><th className="px-4 py-3 font-medium">{t.amount}</th><th className="px-4 py-3 font-medium">{t.status}</th><th className="px-4 py-3 font-medium text-center">{t.actions}</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs" dir="ltr">{inv.number}</td>
                      <td className="px-4 py-3"><div className="font-medium text-gray-800">{inv.customerName}</div>{inv.companyName && <div className="text-xs text-gray-400">{inv.companyName}</div>}</td>
                      <td className="px-4 py-3 text-gray-500" dir="ltr">{fmtDate(inv.date)}</td>
                      <td className="px-4 py-3 font-bold text-gray-800" dir="ltr">{formatInvoiceMoney(inv.total, inv.currency || 'OMR')}</td>
                      <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusCls(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                      <td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><button onClick={() => startEdit(inv)} title={t.edit} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"><IconEdit className="w-4 h-4" /></button>{!readonly && <button onClick={() => handleDelete(inv.id)} title={t.del} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><IconTrash className="w-4 h-4" /></button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────── COMPANY INFO ───────── */}
      {mode === 'company' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-5">{t.companyHint}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 flex items-center gap-4">
              <div onClick={() => !logoUploading && logoInputRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer overflow-hidden shrink-0">
                {companyForm.logoUrl ? <img src={companyForm.logoUrl} alt="logo" className="w-full h-full object-contain" /> : <div className="text-center text-gray-400 text-xs px-2"><IconUpload className="w-5 h-5 mx-auto mb-1" />{logoUploading ? t.uploading : t.uploadLogo}</div>}
              </div>
              <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
              <div className="flex-1"><label className={lbl}>{t.cName}</label><input className={cFld} value={companyForm.companyName} onChange={e => setCompanyForm(f => ({ ...f, companyName: e.target.value }))} /></div>
            </div>
            <div className="md:col-span-2"><label className={lbl}>{t.addr}</label><input className={cFld} value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><label className={lbl}>{t.cr}</label><input className={cFld + ' dir-ltr'} value={companyForm.crNumber || ''} onChange={e => setCompanyForm(f => ({ ...f, crNumber: e.target.value }))} /></div>
            <div><label className={lbl}>{t.phone}</label><input className={cFld + ' dir-ltr'} value={companyForm.phone} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label className={lbl}>{t.email}</label><input className={cFld + ' dir-ltr'} value={companyForm.email || ''} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className={lbl}>{t.website}</label><input className={cFld + ' dir-ltr'} value={companyForm.website || ''} onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))} /></div>

            <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-1"><h4 className="font-bold text-gray-700 text-sm">Bank / Payment Details</h4></div>
            <div><label className={lbl}>{t.bankName}</label><input className={cFld} value={companyForm.bankName || ''} onChange={e => setCompanyForm(f => ({ ...f, bankName: e.target.value }))} /></div>
            <div><label className={lbl}>{t.accHolder}</label><input className={cFld} value={companyForm.accountHolder || ''} onChange={e => setCompanyForm(f => ({ ...f, accountHolder: e.target.value }))} /></div>
            <div><label className={lbl}>{t.accNo}</label><input className={cFld + ' dir-ltr'} value={companyForm.accountNumber || ''} onChange={e => setCompanyForm(f => ({ ...f, accountNumber: e.target.value }))} /></div>
            <div><label className={lbl}>{t.swift}</label><input className={cFld + ' dir-ltr'} value={companyForm.swiftCode || ''} onChange={e => setCompanyForm(f => ({ ...f, swiftCode: e.target.value }))} /></div>
            <div className="md:col-span-2"><label className={lbl}>{t.iban}</label><input className={cFld + ' dir-ltr'} value={companyForm.iban || ''} onChange={e => setCompanyForm(f => ({ ...f, iban: e.target.value }))} /></div>

            <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-1"><h4 className="font-bold text-gray-700 text-sm">Defaults</h4></div>
            <div className="md:col-span-2"><label className={lbl}>{t.payTerms}</label><textarea rows={2} className={cFld} value={companyForm.defaultPaymentTerms || ''} onChange={e => setCompanyForm(f => ({ ...f, defaultPaymentTerms: e.target.value }))} placeholder="Advance Payment: 80% to start the project / 20% upon completion." /></div>
            <div className="md:col-span-2"><label className={lbl}>{t.notes}</label><textarea rows={4} className={cFld} value={companyForm.defaultNotes || ''} onChange={e => setCompanyForm(f => ({ ...f, defaultNotes: e.target.value }))} placeholder={'Project Details & Timeline\n• Deliverables: ...\n• Estimated Timeline: ...'} /></div>
            <div><label className={lbl}>{t.footer}</label><input className={cFld} value={companyForm.footerText} onChange={e => setCompanyForm(f => ({ ...f, footerText: e.target.value }))} /></div>
            <div><label className={lbl}>{t.prefix}</label><input className={cFld + ' dir-ltr'} value={companyForm.invoicePrefix || ''} onChange={e => setCompanyForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="SVC" /></div>
            <div>
              <label className={lbl}>Default currency</label>
              <select className={cFld + ' dir-ltr'} value={isPresetInvoiceCurrency(companyForm.defaultCurrency || 'OMR') ? (companyForm.defaultCurrency || 'OMR') : INVOICE_CURRENCY_CUSTOM} onChange={e => {
                const v = e.target.value;
                setCompanyForm(f => ({ ...f, defaultCurrency: v === INVOICE_CURRENCY_CUSTOM ? (isPresetInvoiceCurrency(f.defaultCurrency || '') ? '' : (f.defaultCurrency || '')) : v }));
              }}>
                {INVOICE_PRESET_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value={INVOICE_CURRENCY_CUSTOM}>Custom…</option>
              </select>
              {!isPresetInvoiceCurrency(companyForm.defaultCurrency || 'OMR') && (
                <input className={cFld + ' dir-ltr mt-2'} placeholder="e.g. GBP, SAR" value={companyForm.defaultCurrency || ''} onChange={e => setCompanyForm(f => ({ ...f, defaultCurrency: e.target.value.toUpperCase().slice(0, 12) }))} />
              )}
            </div>
            <div><label className={lbl}>{t.defTax}</label><input type="number" className={cFld} value={companyForm.defaultTaxRate} onChange={e => setCompanyForm(f => ({ ...f, defaultTaxRate: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="flex items-end gap-4 md:col-span-2">
              <div>
                <label className={lbl}>VAT mode</label>
                <div className="flex items-center gap-4 pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="tplVat" className="accent-indigo-600" checked={companyForm.vatInclusive !== false} onChange={() => setCompanyForm(f => ({ ...f, vatInclusive: true }))} />Inclusive</label>
                  <label className="flex items-center gap-2 text-sm text-gray-700"><input type="radio" name="tplVat" className="accent-indigo-600" checked={companyForm.vatInclusive === false} onChange={() => setCompanyForm(f => ({ ...f, vatInclusive: false }))} />Exclusive</label>
                </div>
              </div>
              <div className="flex-1"><label className={lbl}>{t.color}</label><input type="color" className="w-full h-[38px] px-1 py-1 rounded-lg border border-gray-300 cursor-pointer" value={companyForm.colorTheme} onChange={e => setCompanyForm(f => ({ ...f, colorTheme: e.target.value }))} /></div>
            </div>
          </div>
          {!readonly && <div className="mt-6 flex items-center gap-3"><button onClick={handleSaveCompany} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 flex items-center gap-2"><IconCheck className="w-4 h-4" />{t.saveCompany}</button>{companySaved && <span className="text-sm text-emerald-600 font-medium">{t.savedOk}</span>}</div>}
        </div>
      )}

      {/* ───────── EDITOR (matches the official invoice layout) ───────── */}
      {mode === 'editor' && draft && (
        <div>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
            <button onClick={() => { setMode('archive'); setDraft(null); }} className="text-sm text-gray-500 hover:text-gray-800">← {t.back}</button>
            <div className="flex items-center gap-2">
              <select value={draft.status || 'draft'} onChange={e => setField('status', e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none"><option value="draft">{t.draft}</option><option value="issued">{t.issued}</option><option value="paid">{t.paid}</option></select>
              <button onClick={handleExportPdf} disabled={pdfGenerating} className="flex items-center gap-1.5 bg-gray-700 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-gray-800 disabled:opacity-50"><IconPrinter className="w-4 h-4" />{pdfGenerating ? 'PDF…' : 'PDF'}</button>
              {!readonly && <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"><IconCheck className="w-4 h-4" />{t.save}</button>}
            </div>
          </div>

          {/* A4 sheet */}
          <div ref={invoiceSheetRef} className="bg-white mx-auto rounded-lg border border-gray-100 shadow-sm invoice-content text-gray-800" style={{ width: 794, maxWidth: '100%', minHeight: 1123, padding: '36px 40px', boxSizing: 'border-box' }} dir="ltr">
            {/* ── Top: logo + Invoice meta ── */}
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                {template.logoUrl ? <img src={template.logoUrl} alt="logo" className="h-14 object-contain self-start mb-1" /> : <div className="text-2xl font-black" style={{ color: DARK }}>{template.companyName}</div>}
                <span className="text-[8px] text-gray-400 tracking-wide">{template.companyName}</span>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-black tracking-tight" style={{ color: DARK }}>INVOICE</h1>
                <div className="mt-3 text-[12px] space-y-0.5">
                  <div><span className="text-gray-500">Invoice No. </span><span className="font-semibold" style={{ color: accent }}>{draft.number}</span></div>
                  <div><span className="text-gray-500">Date </span><span className="font-medium">{fmtDate(draft.createdAt || draft.date)}</span></div>
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <span className="text-gray-500">Currency </span>
                    <select
                      className="font-medium outline-none bg-transparent border-b border-gray-200 print:border-0 print:appearance-none"
                      value={currencySelectValue}
                      onChange={e => setCurrencyPreset(e.target.value)}
                    >
                      {INVOICE_PRESET_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value={INVOICE_CURRENCY_CUSTOM}>Custom</option>
                    </select>
                    {currencySelectValue === INVOICE_CURRENCY_CUSTOM && (
                      <input
                        className="w-16 font-medium outline-none bg-transparent border-b border-gray-200 uppercase print:border-0"
                        placeholder="GBP"
                        value={draft.currency || ''}
                        onChange={e => setField('currency', e.target.value.toUpperCase().slice(0, 12))}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Company block ── */}
            <div className="mt-4 text-[12px] leading-relaxed">
              <div className="font-bold text-[15px]" style={{ color: DARK }}>{template.companyName}</div>
              {template.address && <div className="text-gray-600 max-w-xs">{template.address}</div>}
              {template.crNumber && <div className="text-gray-600">CR No.: {template.crNumber}</div>}
              <div className="mt-2 space-y-0.5" style={{ color: accent }}>
                {template.phone && <div>{template.phone}</div>}
                {template.email && <div>{template.email}</div>}
                {template.website && <div>{template.website}</div>}
              </div>
            </div>

            <div className="h-[3px] mt-4 mb-5" style={{ backgroundColor: DARK }} />

            {/* ── Bill To + Payment Terms ── */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-bold tracking-wider text-gray-400">BILL TO</p>
                  {!readonly && (
                    <div className="relative print:hidden">
                        <button type="button" onClick={() => setShowCustomerPicker(v => !v)} className="text-[10px] flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"><IconUsers className="w-3 h-3" />Pick Customer</button>
                        {showCustomerPicker && (
                          <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-2 text-left" dir="ltr">
                            <input autoFocus value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search customer..." className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none mb-2" />
                            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                              {filteredCustomers.length === 0 ? <p className="text-xs text-gray-400 py-3 text-center">No results</p> : filteredCustomers.map(c => (
                                <button key={c.id} type="button" onClick={() => pickCustomer(c)} className="w-full text-start px-2 py-2 hover:bg-gray-50 rounded-lg"><div className="text-sm font-medium text-gray-800">{c.fullName}</div><div className="text-[11px] text-gray-400">{c.companyName} {c.phoneNumber && `· ${c.phoneNumber}`}</div></button>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
                <input className="block w-full font-bold text-[14px] outline-none bg-transparent print:border-0 border-b border-transparent focus:border-gray-200" style={{ color: DARK }} placeholder="Mr. Customer Name" value={draft.customerName} onChange={e => setField('customerName', e.target.value)} />
                <input className="block w-full text-[12px] text-gray-700 outline-none bg-transparent print:border-0 border-b border-transparent focus:border-gray-200" placeholder="Company" value={draft.companyName || ''} onChange={e => setField('companyName', e.target.value)} />
                <input className="block w-full text-[11px] text-gray-500 outline-none bg-transparent dir-ltr print:border-0 border-b border-transparent focus:border-gray-200" placeholder="Phone: ..." value={draft.customerPhone ? `Phone: ${draft.customerPhone}` : ''} onChange={e => setField('customerPhone', e.target.value.replace(/^Phone:\s*/i, ''))} />
                <input className="block w-full text-[11px] text-gray-400 outline-none bg-transparent print:border-0 border-b border-transparent focus:border-gray-200" placeholder="Address" value={draft.customerAddress || ''} onChange={e => setField('customerAddress', e.target.value)} />
              </div>
              <div className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-bold tracking-wider text-gray-400">PAYMENT TERMS</p>
                  <SectionPresetControls section="paymentTerms" />
                </div>
                <textarea rows={3} className="w-full text-[12px] text-gray-700 outline-none bg-transparent resize-none" placeholder="Advance Payment: 80% to start / 20% upon completion." value={draft.paymentTerms || ''} onChange={e => setField('paymentTerms', e.target.value)} />
              </div>
            </div>

            {/* ── Items table ── */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] font-bold tracking-wider text-gray-400">LINE ITEMS</p>
              <SectionPresetControls section="items" />
            </div>
            <table className="w-full text-[12px] mb-1">
              <thead>
                <tr className="bg-gray-100 text-gray-500 text-[10px] tracking-wider">
                  <th className="px-2 py-2 text-left w-8">#</th>
                  <th className="px-2 py-2 text-left">DESCRIPTION</th>
                  <th className="px-2 py-2 text-center w-14">QTY</th>
                  <th className="px-2 py-2 text-right w-28">UNIT PRICE ({cur})</th>
                  <th className="px-2 py-2 text-right w-28">AMOUNT ({cur})</th>
                  <th className="print:hidden w-8"></th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 align-top">
                    <td className="px-2 py-2.5 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-2.5">
                      <input className="w-full font-semibold outline-none bg-transparent" style={{ color: accent }} placeholder="Service title" value={item.description.split('\n')[0] || ''} onChange={e => { const rest = item.description.split('\n').slice(1).join('\n'); setItem(idx, 'description', rest ? `${e.target.value}\n${rest}` : e.target.value); }} />
                      <input className="w-full text-gray-500 text-[11px] outline-none bg-transparent" placeholder="Details (sub-line)" value={item.description.split('\n').slice(1).join('\n')} onChange={e => { const first = item.description.split('\n')[0] || ''; setItem(idx, 'description', e.target.value ? `${first}\n${e.target.value}` : first); }} />
                    </td>
                    <td className="px-2 py-2.5 text-center"><input type="number" min="0" className="w-full outline-none bg-transparent text-center" value={item.quantity} onChange={e => setItem(idx, 'quantity', parseInt(e.target.value) || 0)} /></td>
                    <td className="px-2 py-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className="w-full outline-none bg-transparent text-right dir-ltr"
                        placeholder="0"
                        value={item.unitPrice || ''}
                        onChange={e => setItem(idx, 'unitPrice', parseInvoiceAmount(e.target.value))}
                      />
                    </td>
                    <td className="px-2 py-2.5 text-right font-bold" style={{ color: DARK }}>{money(item.total)}</td>
                    <td className="print:hidden text-center">{draft.items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3.5 h-3.5" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!readonly && <button onClick={addItem} className="text-indigo-600 font-bold text-xs flex items-center gap-1 hover:underline print:hidden mb-3"><IconPlus className="w-3.5 h-3.5" />Add row</button>}

            {/* ── Extra charges & VAT ── */}
            <div className="flex items-center justify-between gap-2 mb-2 print:mb-0">
              <p className="text-[10px] font-bold tracking-wider text-gray-400">EXTRA CHARGES &amp; VAT</p>
              <div className="flex items-center gap-2">
                <SectionPresetControls section="adjustments" />
                <SectionPresetControls section="vat" />
              </div>
            </div>
            {!readonly && (
              <div className="flex flex-wrap items-center gap-1.5 mb-3 print:hidden">
                <span className="text-[10px] text-gray-400 mr-1">Quick add:</span>
                {['Shipping', 'Handling', 'Packaging', 'Other fee'].map(label => (
                  <button key={label} type="button" onClick={() => addAdjustment({ label })} className="text-[10px] px-2 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600">{label}</button>
                ))}
                <button type="button" onClick={() => addAdjustment({ label: 'Discount', amount: 0 })} className="text-[10px] px-2 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50">Discount</button>
              </div>
            )}
            {(draft.adjustments || []).length > 0 && (
              <div className="mb-3 space-y-1 print:hidden">
                {(draft.adjustments || []).map(adj => (
                  <div key={adj.id} className="flex items-center justify-end gap-2 text-[12px] print:gap-1">
                    <input
                      className="text-right outline-none bg-transparent text-gray-600 w-40 print:w-auto print:border-0 border-b border-transparent focus:border-gray-200"
                      value={adj.label}
                      onChange={e => setAdjustment(adj.id, 'label', e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.001"
                      className="w-28 text-right outline-none bg-transparent font-semibold dir-ltr print:w-auto print:border-0 border-b border-transparent focus:border-gray-200"
                      placeholder="0"
                      value={adj.amount || ''}
                      onChange={e => setAdjustment(adj.id, 'amount', parseInvoiceAmount(e.target.value))}
                    />
                    <span className="text-gray-400 w-8 print:hidden">{cur}</span>
                    {!readonly && <button type="button" onClick={() => removeAdjustment(adj.id)} className="text-red-400 hover:text-red-600 print:hidden"><IconTrash className="w-3 h-3" /></button>}
                  </div>
                ))}
              </div>
            )}

            {/* ── Totals ── */}
            <div className="flex flex-col items-end gap-0 mb-6 text-[12px]">
              <div className="w-full flex justify-end border-b border-gray-100 py-2"><span className="text-gray-500 mr-6">Subtotal ({cur})</span><span className="font-semibold w-28 text-right" style={{ color: DARK }}>{money(draft.subTotal)}</span></div>
              {(draft.adjustments || []).filter(a => a.amount !== 0).map(adj => (
                <div key={adj.id} className="w-full flex justify-end border-b border-gray-100 py-1.5">
                  <span className="text-gray-500 mr-6">{adj.label} ({cur})</span>
                  <span className={`font-medium w-28 text-right ${adj.amount < 0 ? 'text-red-600' : ''}`} style={adj.amount >= 0 ? { color: DARK } : undefined}>{money(adj.amount)}</span>
                </div>
              ))}
              <div className="w-full flex justify-end border-b border-gray-100 py-2"><span className="text-gray-700 font-semibold mr-6">Net (excl. VAT) ({cur})</span><span className="font-bold w-28 text-right" style={{ color: DARK }}>{money(netAmount(draft))}</span></div>
              <div className="w-full flex justify-end border-b border-gray-100 py-2 items-center gap-3 flex-wrap">
                <div className="print:hidden flex items-center gap-2 mr-auto">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">VAT mode</span>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="radio" name="vatMode" className="accent-indigo-600" checked={draft.vatInclusive === true} onChange={() => setField('vatInclusive', true)} />Inclusive</label>
                  <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="radio" name="vatMode" className="accent-indigo-600" checked={draft.vatInclusive !== true} onChange={() => setField('vatInclusive', false)} />Exclusive</label>
                </div>
                <span className="text-gray-400 mr-6">
                  VAT (
                  <input type="number" className="w-10 text-center border-b border-gray-200 outline-none bg-transparent print:border-0" value={draft.taxRate} onChange={e => setField('taxRate', parseFloat(e.target.value) || 0)} />
                  % — {draft.vatInclusive ? 'inclusive' : 'exclusive'}) ({cur})
                </span>
                <span className="text-gray-500 w-28 text-right">{money(draft.taxAmount)}</span>
              </div>
              <div className="w-full flex justify-end items-center py-3 px-4 mt-2 text-white" style={{ backgroundColor: DARK }}><span className="font-bold mr-6 tracking-wide">TOTAL DUE ({cur})</span><span className="font-black w-28 text-right text-base">{money(draft.total)}</span></div>
            </div>

            {/* ── Payment details + Notes ── */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-gray-200 rounded-md p-3 text-[11px] leading-relaxed">
                <p className="text-[10px] font-bold tracking-wider text-gray-400 mb-1.5">PAYMENT DETAILS</p>
                {template.bankName && <div><span className="text-gray-500">Bank Name:</span> {template.bankName}</div>}
                {template.accountHolder && <div><span className="text-gray-500">Account Holder:</span> {template.accountHolder}</div>}
                {template.accountNumber && <div className="dir-ltr"><span className="text-gray-500">Account Number:</span> {template.accountNumber}</div>}
                {template.swiftCode && <div className="dir-ltr"><span className="text-gray-500">SWIFT Code:</span> {template.swiftCode}</div>}
                {template.iban && <div className="dir-ltr"><span className="text-gray-500">IBAN:</span> {template.iban}</div>}
                {!template.bankName && !template.iban && <span className="text-gray-300">Fill in Company Info</span>}
              </div>
              <div className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-bold tracking-wider text-gray-400">NOTES / TERMS</p>
                  <SectionPresetControls section="notes" />
                </div>
                <textarea rows={6} className="w-full text-[11px] text-gray-600 outline-none bg-transparent resize-none leading-relaxed" placeholder={'Project Details & Timeline\n• ...'} value={draft.note || ''} onChange={e => setField('note', e.target.value)} />
              </div>
            </div>

            {/* ── Authorized signature ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-md p-3 pt-3">
                <p className="text-[10px] font-bold tracking-wider text-gray-400 mb-6">AUTHORIZED SIGNATURE</p>
                <div className="border-t border-gray-300 pt-1 text-center text-[9px] tracking-wider text-gray-400">{(template.companyName || '').toUpperCase()}</div>
              </div>
              <div />
            </div>

            {/* ── Footer ── */}
            <div className="mt-6 text-center text-[9px] text-gray-300">Generated by {template.companyName} — issued {fmtDate(draft.createdAt || draft.date)}</div>
          </div>

          <style>{`
            .pdf-export .print\\:hidden { display: none !important; }
            @media print {
              @page { size: A4 portrait; margin: 12mm; }
              body * { visibility: hidden; }
              .invoice-content, .invoice-content * { visibility: visible; }
              .invoice-content { position: absolute; left: 0; top: 0; width: 210mm !important; max-width: 210mm !important; min-height: auto !important; margin: 0; padding: 12mm !important; border: 0 !important; box-shadow: none !important; }
              .print\\:hidden { display: none !important; }
              .print\\:border-0 { border: 0 !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};
