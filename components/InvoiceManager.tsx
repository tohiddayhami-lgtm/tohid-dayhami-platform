import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Invoice, InvoiceItem, InvoiceAdjustment, InvoiceTemplate, InvoiceSectionKey, InvoiceSectionPreset, Customer, Personnel, AppConfig } from '../types';
import { IconPrinter, IconPlus, IconTrash, IconCheck, IconSearch, IconEdit, IconInvoice, IconUsers, IconSettings, IconUpload, IconMoney, IconArrowRight } from './Icons';
import { uploadFileWithProgress, saveInvoiceSectionPresetToCloud, deleteInvoiceSectionPresetFromCloud, subscribeToInvoiceSectionPresets, saveCustomerToCloud } from '../services/firebaseService';
import { Language } from '../App';
import { StaffIdPicker } from './StaffIdPicker';
import { notifyInvoiceFollowUp } from '../utils/invoiceFollowUpNotify';
import {
  INVOICE_PRESET_CURRENCIES,
  INVOICE_CURRENCY_CUSTOM,
  formatInvoiceMoney,
  formatInvoiceAmount,
  parseInvoiceAmount,
  isPresetInvoiceCurrency,
  resolveInvoiceDecimals,
  getInvoiceAmountDecimals,
} from '../utils/invoiceMoney';
import { exportInvoicePdf } from '../utils/exportInvoicePdf';
import { InvoiceAmountInput } from './InvoiceAmountInput';
import {
  invoiceAmountPaid,
  invoiceBalanceDue,
  invoicePaymentStatus,
  withInvoicePaymentMeta,
  addInvoiceReceipt,
  removeInvoiceReceipt,
} from '../utils/invoicePayments';
import { isInvoiceCancelled, isInvoiceActiveForStats } from '../utils/invoiceCancel';
import { textDirection } from '../utils/textDirection';
import {
  canViewAllInvoices,
  canEditInvoice,
  canDeleteInvoice,
  canIssueInvoices,
  filterInvoicesForUser,
  isInvoiceMasterOrAdmin,
} from '../utils/invoiceAccess';
import { computeInvoiceTotals, invoiceLineTotal, invoiceNetExclVat } from '../utils/invoiceTotals';
import {
  buildInvoiceSampleEnvelope,
  downloadInvoiceJson,
  exportInvoiceEnvelope,
  parseInvoiceJson,
} from '../utils/invoiceFormat';
import { ProposalManager } from './ProposalManager';
import { ContractManager } from './ContractManager';
import { CatalogManager } from './CatalogManager';
import { RealEstateProposalManager } from './RealEstateProposalManager';

const normalizePhone = (p: string) => (p || '').replace(/\D/g, '');

const ARCHIVE_PAGE_SIZE = 10;

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  personnel: Personnel[];
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
    .map(it => ({ ...it, total: invoiceLineTotal(it) }));

const normalizePaymentDetails = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const pd = value as Record<string, string | undefined>;
    return [
      pd.bankName,
      pd.accountHolder,
      pd.accountNumber,
      pd.swiftCode,
      pd.iban,
    ].filter(Boolean).join('\n');
  }
  return '';
};

const emptyDraft = (config: AppConfig, user: Personnel, count: number): Invoice => {
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
    issuedBy: user.fullName,
    issuedByPersonnelId: user.id,
    status: 'draft',
    createdAt: new Date().toISOString(),
    paymentTerms: tpl.defaultPaymentTerms || '',
    paymentDetails: '',
    note: tpl.defaultNotes || '',
    vatInclusive: tpl.vatInclusive ?? true,
    documentTitle: tpl.defaultDocumentTitle || 'INVOICE',
    qtyColumnLabel: tpl.defaultQtyColumnLabel || 'QTY',
    unitPriceColumnLabel: tpl.defaultUnitPriceColumnLabel || 'UNIT PRICE',
    amountDecimals: tpl.amountDecimals,
  };
};

export const InvoiceManager: React.FC<Props> = ({ invoices, customers, personnel, config, currentUser, lang, onSaveInvoice, onDeleteInvoice, onUpdateConfig, readonly = false }) => {
  const showAllInvoices = canViewAllInvoices(currentUser);
  const visibleInvoices = useMemo(() => filterInvoicesForUser(invoices, currentUser), [invoices, currentUser]);
  const canManageCompany = isInvoiceMasterOrAdmin(currentUser);
  const canCreate = canIssueInvoices(currentUser) && !readonly;
  const [mainTab, setMainTab] = useState<'invoices' | 'proposals' | 'contracts' | 'catalog' | 'real_estate'>('invoices');
  const [mode, setMode] = useState<'archive' | 'editor' | 'company'>('archive');
  const [draft, setDraft] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [archivePage, setArchivePage] = useState(1);
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
  const [paymentModalInv, setPaymentModalInv] = useState<Invoice | null>(null);
  const [followUpModalInv, setFollowUpModalInv] = useState<Invoice | null>(null);
  const [followUpAssigneeIds, setFollowUpAssigneeIds] = useState<string[]>([]);
  const [followUpNote, setFollowUpNote] = useState('');
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, date: new Date().toISOString().split('T')[0], method: '', reference: '', note: '' });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [importErr, setImportErr] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const invoiceSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToInvoiceSectionPresets(setSectionPresets);
    return () => unsub();
  }, []);

  const t = {
    fa: {
      title: 'فاکتورها', archive: 'آرشیو فاکتورها', newInvoice: 'فاکتور جدید', companyInfo: 'اطلاعات شرکت',
      search: 'جستجو شماره فاکتور یا نام مشتری...', empty: 'هنوز فاکتوری ثبت نشده است.', noResult: 'موردی یافت نشد.',
      number: 'شماره', customer: 'مشتری', date: 'تاریخ', amount: 'مبلغ', status: 'وضعیت', issuer: 'صادرکننده', actions: 'عملیات',
      edit: 'ویرایش', del: 'حذف', print: 'چاپ', save: 'ذخیره', cancel: 'انصراف', back: 'بازگشت به آرشیو',
      deleteConfirm: 'این فاکتور حذف شود؟',
      draft: 'پیش‌نویس', issued: 'صادر شده', paid: 'پرداخت شده', cancelled: 'کنسل شده',
      cancelInvoice: 'کنسل فاکتور',
      restoreInvoice: 'بازگردانی فاکتور',
      cancelConfirm: 'این فاکتور کنسل شود؟ در محاسبات مالی لحاظ نمی‌شود.',
      cancelReasonPrompt: 'دلیل کنسل (اختیاری):',
      cancelDone: 'فاکتور کنسل شد.',
      restoreConfirm: 'فاکتور از حالت کنسل خارج شود؟',
      restoreDone: 'فاکتور بازگردانی شد.',
      cancelledStamp: 'کنسل شده',
      cancelledTotal: 'جمع کنسل‌ها',
      cancelledCount: 'تعداد کنسل',
      page: 'صفحه',
      of: 'از',
      prev: 'قبلی',
      next: 'بعدی',
      showing: 'نمایش',
      pickCustomer: 'انتخاب از بانک مشتریان',
      regenNo: 'تولید شماره جدید',
      saveCompany: 'ذخیره اطلاعات شرکت', savedOk: 'ذخیره شد ✓',
      companyHint: 'این اطلاعات یک‌بار ذخیره می‌شود و در همه فاکتورهای جدید به‌صورت سربرگ استفاده می‌گردد.',
      // company fields
      cName: 'نام شرکت', logo: 'لوگو', uploadLogo: 'آپلود لوگو', uploading: 'در حال آپلود...',
      addr: 'آدرس', cr: 'CR No.', phone: 'تلفن', email: 'ایمیل', website: 'وب‌سایت',
      bankName: 'نام بانک', accHolder: 'صاحب حساب', accNo: 'شماره حساب', swift: 'کد سوئیفت', iban: 'IBAN',
      payTerms: 'شرایط پرداخت پیش‌فرض', notes: 'یادداشت/شرایط پیش‌فرض', footer: 'متن پایانی', defTax: 'مالیات پیش‌فرض (٪)', vatInc: 'مالیات به‌صورت تجمیعی (داخل قیمت)', color: 'رنگ قالب', prefix: 'پیشوند شماره فاکتور', docTitle: 'عنوان سند پیش‌فرض', colQty: 'عنوان ستون تعداد', colUnitPrice: 'عنوان ستون قیمت واحد',
      amountDecimals: 'تعداد اعشار مبالغ', amountDecimalsHint: 'پیش‌فرض فاکتورهای جدید',
      invAmountDecimals: 'اعشار مبالغ',
      type: 'نوع', terms: 'شرایط و قوانین',
      jsonHint: 'صدور سریع با JSON — دانلود سمپل برای هوش مصنوعی، آپلود و ویرایش',
      downloadJsonSample: 'دانلود سمپل JSON',
      uploadJson: 'آپلود JSON',
      exportJson: 'خروجی JSON',
      jsonImportErr: 'فایل JSON نامعتبر است. فرمت سمپل فاکتور را رعایت کنید.',
      followUp: 'پیگیری',
      followUpTitle: 'ارجاع پیگیری فاکتور',
      followUpAssignee: 'مسئول پیگیری',
      followUpNote: 'یادداشت پیگیری (اختیاری)',
      followUpSubmit: 'ارجاع و ارسال نوتیف',
      followUpDone: 'ارجاع پیگیری انجام شد.',
      followUpCol: 'پیگیری',
      followUpHint: 'پیام داخلی و واتساپ (در صورت فعال بودن) برای پرسنل ارسال می‌شود.',
      followUpPick: 'یک پرسنل برای پیگیری انتخاب کنید.',
    },
    en: {
      title: 'Invoices', archive: 'Invoice Archive', newInvoice: 'New Invoice', companyInfo: 'Company Info',
      search: 'Search invoice no. or customer...', empty: 'No invoices yet.', noResult: 'No results.',
      number: 'No.', customer: 'Customer', date: 'Date', amount: 'Amount', status: 'Status', issuer: 'Issued by', actions: 'Actions',
      edit: 'Edit', del: 'Delete', print: 'Print', save: 'Save', cancel: 'Cancel', back: 'Back to archive',
      deleteConfirm: 'Delete this invoice?',
      draft: 'Draft', issued: 'Issued', paid: 'Paid', cancelled: 'Cancelled',
      cancelInvoice: 'Cancel invoice',
      restoreInvoice: 'Restore invoice',
      cancelConfirm: 'Cancel this invoice? It will be excluded from financial totals.',
      cancelReasonPrompt: 'Cancellation reason (optional):',
      cancelDone: 'Invoice cancelled.',
      restoreConfirm: 'Restore this invoice from cancelled status?',
      restoreDone: 'Invoice restored.',
      cancelledStamp: 'CANCELLED',
      cancelledTotal: 'Cancelled total',
      cancelledCount: 'Cancelled count',
      page: 'Page',
      of: 'of',
      prev: 'Previous',
      next: 'Next',
      showing: 'Showing',
      pickCustomer: 'Pick from Customer Bank',
      regenNo: 'New number',
      saveCompany: 'Save company info', savedOk: 'Saved ✓',
      companyHint: 'Saved once and reused as the header on every new invoice.',
      cName: 'Company name', logo: 'Logo', uploadLogo: 'Upload logo', uploading: 'Uploading...',
      addr: 'Address', cr: 'CR No.', phone: 'Phone', email: 'Email', website: 'Website',
      bankName: 'Bank name', accHolder: 'Account holder', accNo: 'Account number', swift: 'SWIFT code', iban: 'IBAN',
      payTerms: 'Default payment terms', notes: 'Default notes / terms', footer: 'Footer text', defTax: 'Default tax (%)', vatInc: 'VAT inclusive in prices', color: 'Theme color', prefix: 'Invoice number prefix', docTitle: 'Default document title', colQty: 'Default QTY column title', colUnitPrice: 'Default unit price column title',
      amountDecimals: 'Amount decimal places', amountDecimalsHint: 'Default for new invoices',
      invAmountDecimals: 'Decimals',
      type: 'Type', terms: 'Terms',
      jsonHint: 'Fast invoicing via JSON — download sample for AI, upload and edit',
      downloadJsonSample: 'Download sample JSON',
      uploadJson: 'Upload JSON',
      exportJson: 'Export JSON',
      jsonImportErr: 'Invalid JSON file. Use the invoice sample format.',
      followUp: 'Follow up',
      followUpTitle: 'Assign invoice follow-up',
      followUpAssignee: 'Follow-up assignee',
      followUpNote: 'Follow-up note (optional)',
      followUpSubmit: 'Assign & notify',
      followUpDone: 'Follow-up assigned.',
      followUpCol: 'Follow-up',
      followUpHint: 'Sends an internal message and WhatsApp (if enabled) to the assignee.',
      followUpPick: 'Select one person for follow-up.',
    },
  }[lang];

  const statusLabel = (s?: Invoice['status']) =>
    s === 'cancelled' ? t.cancelled : s === 'paid' ? t.paid : s === 'issued' ? t.issued : t.draft;
  const statusCls = (s?: Invoice['status']) =>
    s === 'cancelled' ? 'bg-red-100 text-red-700 line-through decoration-red-400/60' :
    s === 'paid' ? 'bg-emerald-100 text-emerald-700' :
    s === 'issued' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500';
  const archiveStatusLabel = (inv: Invoice) => {
    if (isInvoiceCancelled(inv)) return t.cancelled;
    const ps = invoicePaymentStatus(inv);
    if (ps === 'paid') return t.paid;
    if (ps === 'partial') return lang === 'fa' ? 'پرداخت جزئی' : 'Partial';
    return statusLabel(inv.status);
  };
  const archiveStatusCls = (inv: Invoice) => {
    if (isInvoiceCancelled(inv)) return 'bg-red-100 text-red-700';
    const ps = invoicePaymentStatus(inv);
    if (ps === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (ps === 'partial') return 'bg-amber-100 text-amber-700';
    return statusCls(inv.status);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = !q ? visibleInvoices : visibleInvoices.filter(i =>
      i.number.toLowerCase().includes(q)
      || (i.customerName || '').toLowerCase().includes(q)
      || (i.companyName || '').toLowerCase().includes(q)
      || (i.issuedBy || '').toLowerCase().includes(q));
    return [...base].sort((a, b) =>
      new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [visibleInvoices, search]);

  const archivePageCount = Math.max(1, Math.ceil(filtered.length / ARCHIVE_PAGE_SIZE));
  const paginatedFiltered = useMemo(() => {
    const page = Math.min(archivePage, archivePageCount);
    const start = (page - 1) * ARCHIVE_PAGE_SIZE;
    return filtered.slice(start, start + ARCHIVE_PAGE_SIZE);
  }, [filtered, archivePage, archivePageCount]);

  useEffect(() => {
    setArchivePage(1);
  }, [search]);

  useEffect(() => {
    if (archivePage > archivePageCount) setArchivePage(archivePageCount);
  }, [archivePage, archivePageCount]);

  const archiveStats = useMemo(() => {
    const byCur: Record<string, {
      count: number; invoiced: number; paid: number; due: number;
      cancelledCount: number; cancelledTotal: number;
    }> = {};
    for (const inv of visibleInvoices) {
      const c = inv.currency || 'OMR';
      if (!byCur[c]) {
        byCur[c] = { count: 0, invoiced: 0, paid: 0, due: 0, cancelledCount: 0, cancelledTotal: 0 };
      }
      if (isInvoiceCancelled(inv)) {
        byCur[c].cancelledCount += 1;
        byCur[c].cancelledTotal += inv.total || 0;
        continue;
      }
      byCur[c].count += 1;
      byCur[c].invoiced += inv.total || 0;
      byCur[c].paid += invoiceAmountPaid(inv);
      byCur[c].due += invoiceBalanceDue(inv);
    }
    return byCur;
  }, [visibleInvoices]);

  const denyAccess = () => alert(lang === 'fa' ? 'شما مجوز ویرایش این فاکتور را ندارید.' : 'You do not have permission to edit this invoice.');

  // ── Calculations: Subtotal → adjustments → Net (excl. VAT) → VAT → Total ──
  const recompute = (inv: Invoice): Invoice =>
    withInvoicePaymentMeta({ ...inv, ...computeInvoiceTotals(inv) });

  const netAmount = (inv: Invoice) => invoiceNetExclVat(inv);

  const startNew = () => {
    if (!canCreate) return;
    setImportErr('');
    setDraft(recompute(emptyDraft(config, currentUser, visibleInvoices.length)));
    setMode('editor');
  };
  const startEdit = (inv: Invoice) => {
    if (!visibleInvoices.some(i => i.id === inv.id)) { denyAccess(); return; }
    if (!readonly && !canEditInvoice(currentUser, inv)) { denyAccess(); return; }
    setImportErr('');
    setDraft(recompute({
      ...inv,
      items: inv.items.map(it => ({ ...it, total: invoiceLineTotal(it) })),
      adjustments: inv.adjustments || [],
      paymentDetails: normalizePaymentDetails(inv.paymentDetails),
      receipts: inv.receipts || [],
    }));
    setMode('editor');
  };

  const invoiceImportCtx = () => ({
    actor: currentUser,
    config,
    existingCount: visibleInvoices.length,
  });

  const downloadSampleJson = () => {
    downloadInvoiceJson(buildInvoiceSampleEnvelope(invoiceImportCtx()), 'invoice_sample.json');
  };

  const importJsonFile = (file: File) => {
    if (!canCreate) return;
    setImportErr('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let text = String(reader.result || '');
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
        const parsed = JSON.parse(text);
        // Reject common mix-ups early with a clear message
        if (parsed && typeof parsed === 'object') {
          const root = parsed as Record<string, unknown>;
          if (root.proposal || root.contract || root.catalog || root.realEstateProposal) {
            throw new Error(lang === 'fa'
              ? 'این فایل مربوط به پروپوزال/قرارداد/کاتالوگ است؛ در تب فاکتورها فقط فرمت invoice را آپلود کنید.'
              : 'This file is a proposal/contract/catalog — use invoice JSON in the Invoices tab.');
          }
        }
        const invoice = parseInvoiceJson(parsed, invoiceImportCtx());
        invoice.id = `inv-${Date.now()}`;
        invoice.createdAt = new Date().toISOString();
        invoice.issuedBy = currentUser.fullName;
        invoice.issuedByPersonnelId = currentUser.id;
        setDraft(recompute({
          ...invoice,
          paymentDetails: normalizePaymentDetails(invoice.paymentDetails),
          receipts: [],
        }));
        setMode('editor');
      } catch (e) {
        if (e instanceof SyntaxError) setImportErr(t.jsonImportErr);
        else setImportErr(e instanceof Error && e.message ? e.message : t.jsonImportErr);
      }
    };
    reader.onerror = () => setImportErr(t.jsonImportErr);
    reader.readAsText(file);
  };

  const exportCurrentJson = () => {
    if (!draft) return;
    downloadInvoiceJson(exportInvoiceEnvelope(draft), `invoice_${draft.number || 'draft'}.json`);
  };

  const setItem = (idx: number, field: keyof InvoiceItem, value: any) => setDraft(d => {
    if (!d) return d;
    const items = [...d.items];
    const item = { ...items[idx], [field]: value };
    if (field === 'quantity' || field === 'unitPrice' || field === 'priceIncluded') {
      item.total = invoiceLineTotal(item);
    }
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
    } else if (section === 'paymentDetails') {
      base.paymentDetails = draft.paymentDetails || '';
    } else if (section === 'items') {
      base.items = draft.items.map(it => ({ ...it }));
      base.qtyColumnLabel = draft.qtyColumnLabel;
      base.unitPriceColumnLabel = draft.unitPriceColumnLabel;
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
      } else if (preset.section === 'paymentDetails') {
        next = { ...next, paymentDetails: normalizePaymentDetails(preset.paymentDetails) };
      } else if (preset.section === 'items' && preset.items?.length) {
        next = {
          ...next,
          items: preset.items.map(it => ({ ...it, total: invoiceLineTotal(it) })),
          qtyColumnLabel: preset.qtyColumnLabel ?? next.qtyColumnLabel,
          unitPriceColumnLabel: preset.unitPriceColumnLabel ?? next.unitPriceColumnLabel,
        };
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
      email: inv.customerEmail || '',
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
    const existing = invoices.find(i => i.id === draft.id);
    if (existing && !canEditInvoice(currentUser, existing)) { denyAccess(); return; }
    if (!existing && !canCreate) { denyAccess(); return; }
    if (!draft.customerName.trim()) { alert(lang === 'fa' ? 'نام مشتری را وارد کنید.' : 'Enter customer name.'); return; }
    setSaving(true);
    try {
      let customerId = draft.customerId;
      try {
        customerId = await upsertCustomerFromInvoice(draft) || draft.customerId;
      } catch (custErr) {
        console.warn('Invoice customer upsert failed', custErr);
        // Continue — invoice save must not depend on CRM customer sync
      }
      const toSave = recompute({
        ...draft,
        customerId: customerId || draft.customerId,
        createdAt: draft.createdAt || new Date().toISOString(),
        issuedBy: existing?.issuedBy || draft.issuedBy || currentUser.fullName,
        issuedByPersonnelId: existing?.issuedByPersonnelId || draft.issuedByPersonnelId || currentUser.id,
      });
      await onSaveInvoice(toSave);
      setMode('archive'); setDraft(null);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      alert(lang === 'fa' ? `خطا در ذخیره فاکتور:\n${detail}` : `Failed to save invoice:\n${detail}`);
    }
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

  const openPaymentModal = (inv: Invoice) => {
    if (isInvoiceCancelled(inv)) return;
    setPaymentModalInv(inv);
    const balance = invoiceBalanceDue(inv);
    setPaymentForm({
      amount: balance > 0 ? balance : 0,
      date: new Date().toISOString().split('T')[0],
      method: '',
      reference: '',
      note: '',
    });
  };

  const handleRecordPayment = async () => {
    if (!paymentModalInv || readonly) return;
    if (!canEditInvoice(currentUser, paymentModalInv)) { denyAccess(); return; }
    const amount = paymentForm.amount;
    if (amount <= 0) { alert(lang === 'fa' ? 'مبلغ واریز را وارد کنید.' : 'Enter payment amount.'); return; }
    const balance = invoiceBalanceDue(paymentModalInv);
    if (amount > balance + 0.0001) { alert(lang === 'fa' ? 'مبلغ بیشتر از مانده است.' : 'Amount exceeds balance due.'); return; }
    setPaymentSaving(true);
    try {
      const updated = addInvoiceReceipt(paymentModalInv, {
        amount,
        date: paymentForm.date,
        method: paymentForm.method,
        reference: paymentForm.reference,
        note: paymentForm.note,
      }, currentUser.fullName);
      await onSaveInvoice(updated);
      setPaymentModalInv(null);
    } catch {
      alert(lang === 'fa' ? 'خطا در ثبت واریز' : 'Failed to record payment');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleRemoveReceipt = async (inv: Invoice, receiptId: string) => {
    if (readonly) return;
    if (!canEditInvoice(currentUser, inv)) { denyAccess(); return; }
    if (!window.confirm(lang === 'fa' ? 'این واریز حذف شود؟' : 'Remove this payment?')) return;
    try {
      await onSaveInvoice(removeInvoiceReceipt(inv, receiptId));
      if (paymentModalInv?.id === inv.id) {
        setPaymentModalInv(removeInvoiceReceipt(inv, receiptId));
      }
    } catch {
      alert(lang === 'fa' ? 'خطا در حذف' : 'Delete failed');
    }
  };

  const openFollowUpModal = (inv: Invoice) => {
    if (readonly || isInvoiceCancelled(inv)) return;
    if (!canEditInvoice(currentUser, inv)) { denyAccess(); return; }
    setFollowUpModalInv(inv);
    setFollowUpAssigneeIds(inv.followUpAssigneeId ? [inv.followUpAssigneeId] : []);
    setFollowUpNote(inv.followUpNote || '');
  };

  const handleFollowUpAssign = async () => {
    if (!followUpModalInv || readonly) return;
    const assigneeId = followUpAssigneeIds[0];
    if (!assigneeId) {
      alert(t.followUpPick);
      return;
    }
    const assignee = personnel.find(p => p.id === assigneeId);
    if (!assignee) {
      alert(lang === 'fa' ? 'پرسنل یافت نشد.' : 'Personnel not found.');
      return;
    }
    setFollowUpSaving(true);
    try {
      const linked = followUpModalInv.customerId
        ? customers.find(c => c.id === followUpModalInv.customerId)
        : undefined;
      const phone = followUpModalInv.customerPhone?.trim()
        || linked?.phoneNumber?.trim()
        || linked?.whatsappNumber?.trim()
        || '';
      const email = followUpModalInv.customerEmail?.trim() || linked?.email?.trim() || '';
      const updated = recompute({
        ...followUpModalInv,
        customerPhone: phone || followUpModalInv.customerPhone,
        customerEmail: email || followUpModalInv.customerEmail,
        followUpAssigneeId: assignee.id,
        followUpAssigneeName: assignee.fullName,
        followUpNote: followUpNote.trim() || undefined,
        followUpAt: new Date().toISOString(),
        followUpBy: currentUser.fullName,
        followUpByPersonnelId: currentUser.id,
      });
      await onSaveInvoice(updated);
      await notifyInvoiceFollowUp({
        invoice: updated,
        assignee,
        assigner: currentUser,
        note: followUpNote.trim() || undefined,
        config,
        personnel,
        lang,
      });
      setFollowUpModalInv(null);
      setFollowUpAssigneeIds([]);
      setFollowUpNote('');
      alert(t.followUpDone);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      alert(lang === 'fa' ? `خطا در ارجاع پیگیری:\n${detail}` : `Follow-up failed:\n${detail}`);
    } finally {
      setFollowUpSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (readonly) return;
    const inv = invoices.find(i => i.id === id);
    if (inv && !canDeleteInvoice(currentUser, inv)) { denyAccess(); return; }
    if (!id) {
      alert(lang === 'fa' ? 'شناسه فاکتور نامعتبر است.' : 'Invalid invoice id.');
      return;
    }
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      await onDeleteInvoice(id);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      alert(lang === 'fa' ? `خطا در حذف فاکتور:\n${detail}` : `Failed to delete invoice:\n${detail}`);
    }
  };

  const handleCancelInvoice = async (inv: Invoice) => {
    if (readonly) return;
    if (!canEditInvoice(currentUser, inv)) { denyAccess(); return; }
    if (isInvoiceCancelled(inv)) return;
    if (!window.confirm(t.cancelConfirm)) return;
    const reason = window.prompt(t.cancelReasonPrompt) ?? '';
    try {
      const updated = recompute({
        ...inv,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: currentUser.fullName,
        cancelledByPersonnelId: currentUser.id,
        cancelReason: reason.trim() || undefined,
      });
      await onSaveInvoice(updated);
      if (draft?.id === inv.id) setDraft(updated);
      alert(t.cancelDone);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      alert(lang === 'fa' ? `خطا در کنسل:\n${detail}` : `Cancel failed:\n${detail}`);
    }
  };

  const handleRestoreInvoice = async (inv: Invoice) => {
    if (readonly) return;
    if (!canEditInvoice(currentUser, inv)) { denyAccess(); return; }
    if (!isInvoiceCancelled(inv)) return;
    if (!window.confirm(t.restoreConfirm)) return;
    try {
      const restoredStatus: Invoice['status'] =
        invoiceAmountPaid(inv) >= (inv.total || 0) - 0.0001 ? 'paid'
        : invoiceAmountPaid(inv) > 0 ? 'issued' : 'draft';
      const updated = recompute({
        ...inv,
        status: restoredStatus,
        cancelledAt: undefined,
        cancelledBy: undefined,
        cancelledByPersonnelId: undefined,
        cancelReason: undefined,
      });
      await onSaveInvoice(updated);
      if (draft?.id === inv.id) setDraft(updated);
      alert(t.restoreDone);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      alert(lang === 'fa' ? `خطا در بازگردانی:\n${detail}` : `Restore failed:\n${detail}`);
    }
  };
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
  const templateDefaultDecimals = resolveInvoiceDecimals(template.amountDecimals);
  const draftAmountDecimals = draft
    ? getInvoiceAmountDecimals(draft, template)
    : templateDefaultDecimals;
  const invDecimals = (inv: Invoice) => getInvoiceAmountDecimals(inv, template);
  const money = (n: number, currency = cur) => formatInvoiceMoney(n, currency, draftAmountDecimals);
  const fmtMoney = (n: number, currency: string, inv?: Invoice) =>
    formatInvoiceMoney(n, currency, inv ? invDecimals(inv) : templateDefaultDecimals);
  const paymentDecimals = paymentModalInv ? invDecimals(paymentModalInv) : templateDefaultDecimals;
  const decimalOptions = (
    <>
      <option value={0}>{lang === 'fa' ? 'بدون اعشار' : 'None'}</option>
      <option value={1}>{lang === 'fa' ? '۱ رقم' : '1'}</option>
      <option value={2}>{lang === 'fa' ? '۲ رقم' : '2'}</option>
      <option value={3}>{lang === 'fa' ? '۳ رقم' : '3'}</option>
    </>
  );
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
      {/* Top-level: Invoices | Proposals */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit print:hidden">
        <button
          type="button"
          onClick={() => setMainTab('invoices')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mainTab === 'invoices' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
        >
          {lang === 'fa' ? 'فاکتورها' : 'Invoices'}
        </button>
        <button
          type="button"
          onClick={() => setMainTab('proposals')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mainTab === 'proposals' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
        >
          Proposals
        </button>
        <button
          type="button"
          onClick={() => setMainTab('contracts')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mainTab === 'contracts' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
        >
          Contracts
        </button>
        <button
          type="button"
          onClick={() => setMainTab('catalog')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mainTab === 'catalog' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
        >
          {lang === 'fa' ? 'کاتالوگ شرکت' : 'Company Catalog'}
        </button>
        <button
          type="button"
          onClick={() => setMainTab('real_estate')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${mainTab === 'real_estate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
        >
          {lang === 'fa' ? 'صورت پروپوزال املاک' : 'RE Proposals'}
        </button>
      </div>

      {mainTab === 'catalog' && (
        <CatalogManager currentUser={currentUser} lang={lang} readonly={readonly} />
      )}

      {mainTab === 'real_estate' && (
        <RealEstateProposalManager currentUser={currentUser} lang={lang} readonly={readonly} />
      )}

      {mainTab === 'proposals' && (
        <ProposalManager currentUser={currentUser} lang={lang} readonly={readonly} />
      )}

      {mainTab === 'contracts' && (
        <ContractManager currentUser={currentUser} lang={lang} readonly={readonly} />
      )}

      {mainTab === 'invoices' && (<>
      {/* Header / tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><IconInvoice className="w-5 h-5" /></div>
            <h3 className="text-lg font-bold text-gray-800">{t.title}</h3>
            <span className="text-xs text-gray-400">({visibleInvoices.length}{showAllInvoices && invoices.length !== visibleInvoices.length ? ` / ${invoices.length}` : ''})</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 ms-11">{t.jsonHint}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={downloadSampleJson} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            {t.downloadJsonSample}
          </button>
          {canCreate && (
            <>
              <button type="button" onClick={() => jsonFileRef.current?.click()} className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1">
                <IconUpload className="w-3.5 h-3.5" />{t.uploadJson}
              </button>
              <input
                ref={jsonFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) importJsonFile(f);
                  e.target.value = '';
                }}
              />
            </>
          )}
          <button onClick={() => { setMode('archive'); setDraft(null); setImportErr(''); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === 'archive' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t.archive}</button>
          {canManageCompany && <button onClick={() => { setCompanyForm(template); setMode('company'); }} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${mode === 'company' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}><IconSettings className="w-3.5 h-3.5" />{t.companyInfo}</button>}
          {canCreate && <button onClick={startNew} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"><IconPlus className="w-4 h-4" />{t.newInvoice}</button>}
        </div>
      </div>
      {importErr && mode === 'archive' && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 print:hidden">{importErr}</p>
      )}

      {/* ───────── ARCHIVE ───────── */}
      {mode === 'archive' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {visibleInvoices.length > 0 && (
            <div className="p-4 border-b border-gray-100 bg-gradient-to-l from-slate-50 to-white" dir="ltr">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">Invoice Summary</p>
              {Object.entries(archiveStats).map(([currency, s]) => (
                <div key={currency} className={Object.keys(archiveStats).length > 1 ? 'mb-4 last:mb-0' : ''}>
                  {Object.keys(archiveStats).length > 1 && (
                    <p className="text-xs font-bold text-gray-500 mb-2">{currency}</p>
                  )}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{lang === 'fa' ? 'جمع فاکتورها' : 'Total Invoiced'}</p>
                      <p className="text-lg font-black text-gray-900 mt-0.5">{fmtMoney(s.invoiced, currency)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.count} {lang === 'fa' ? 'فاکتور فعال' : 'active invoice(s)'}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                      <p className="text-[10px] text-emerald-600 uppercase tracking-wide">{lang === 'fa' ? 'دریافت‌شده' : 'Total Received'}</p>
                      <p className="text-lg font-black text-emerald-700 mt-0.5">{fmtMoney(s.paid, currency)}</p>
                      <p className="text-[10px] text-emerald-600/70 mt-0.5">{s.invoiced > 0 ? `${Math.round((s.paid / s.invoiced) * 100)}% collected` : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                      <p className="text-[10px] text-amber-600 uppercase tracking-wide">{lang === 'fa' ? 'مانده' : 'Outstanding'}</p>
                      <p className="text-lg font-black text-amber-700 mt-0.5">{fmtMoney(s.due, currency)}</p>
                      <p className="text-[10px] text-amber-600/70 mt-0.5">{lang === 'fa' ? 'قابل وصول' : 'Balance due'}</p>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                      <p className="text-[10px] text-indigo-600 uppercase tracking-wide">{t.status}</p>
                      <p className="text-lg font-black text-indigo-800 mt-0.5">{visibleInvoices.filter(i => (i.currency || 'OMR') === currency && isInvoiceActiveForStats(i) && invoicePaymentStatus(i) === 'paid').length} paid</p>
                      <p className="text-[10px] text-indigo-600/70 mt-0.5">{visibleInvoices.filter(i => (i.currency || 'OMR') === currency && isInvoiceActiveForStats(i) && invoicePaymentStatus(i) === 'partial').length} partial · {visibleInvoices.filter(i => (i.currency || 'OMR') === currency && isInvoiceActiveForStats(i) && invoicePaymentStatus(i) === 'unpaid').length} open</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                      <p className="text-[10px] text-red-600 uppercase tracking-wide">{t.cancelledTotal}</p>
                      <p className="text-lg font-black text-red-700 mt-0.5 line-through decoration-red-400/70">{fmtMoney(s.cancelledTotal, currency)}</p>
                      <p className="text-[10px] text-red-600/80 mt-0.5">{s.cancelledCount} {lang === 'fa' ? 'فاکتور کنسل' : 'cancelled'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="p-4 border-b border-gray-100">
            <div className="relative max-w-sm">
              <IconSearch className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500" />
            </div>
          </div>
          {visibleInvoices.length === 0 ? <div className="py-16 text-center text-sm text-gray-400">{t.empty}</div>
          : filtered.length === 0 ? <div className="py-16 text-center text-sm text-gray-400">{t.noResult}</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t.number}</th>
                    <th className="px-4 py-3 font-medium">{t.customer}</th>
                    {showAllInvoices && <th className="px-4 py-3 font-medium">{t.issuer}</th>}
                    <th className="px-4 py-3 font-medium">{t.date}</th>
                    <th className="px-4 py-3 font-medium">{t.amount}</th>
                    <th className="px-4 py-3 font-medium">{t.status}</th>
                    <th className="px-4 py-3 font-medium">{t.followUpCol}</th>
                    <th className="px-4 py-3 font-medium text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedFiltered.map(inv => {
                    const paid = invoiceAmountPaid(inv);
                    const balance = invoiceBalanceDue(inv);
                    const curInv = inv.currency || 'OMR';
                    const editable = canEditInvoice(currentUser, inv);
                    const cancelled = isInvoiceCancelled(inv);
                    return (
                    <tr key={inv.id} className={`hover:bg-gray-50/60 ${cancelled ? 'bg-red-50/30 opacity-80' : ''}`}>
                      <td className="px-4 py-3 font-mono text-gray-700 text-xs" dir="ltr">
                        <span className={cancelled ? 'line-through text-red-600/80' : ''}>{inv.number}</span>
                      </td>
                      <td className="px-4 py-3"><div className={`font-medium ${cancelled ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{inv.customerName}</div>{inv.companyName && <div className="text-xs text-gray-400">{inv.companyName}</div>}</td>
                      {showAllInvoices && <td className="px-4 py-3 text-gray-600 text-xs">{inv.issuedBy || '—'}</td>}
                      <td className="px-4 py-3 text-gray-500" dir="ltr">{fmtDate(inv.date)}</td>
                      <td className="px-4 py-3" dir="ltr">
                        <div className={`font-bold ${cancelled ? 'text-red-600 line-through' : 'text-gray-800'}`}>{fmtMoney(inv.total, curInv, inv)}</div>
                        {!cancelled && paid > 0 && (
                          <div className="text-[10px] mt-0.5 text-emerald-600">Paid {fmtMoney(paid, curInv, inv)}</div>
                        )}
                        {!cancelled && balance > 0 && paid > 0 && (
                          <div className="text-[10px] text-amber-600">Due {fmtMoney(balance, curInv, inv)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${archiveStatusCls(inv)}`}>{archiveStatusLabel(inv)}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {inv.followUpAssigneeName ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-medium">
                              {inv.followUpAssigneeName}
                            </span>
                            {inv.followUpAt && (
                              <div className="text-[10px] text-gray-400 mt-0.5" dir="ltr">{fmtDate(inv.followUpAt.slice(0, 10))}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {editable && !cancelled && (
                            <button onClick={() => openFollowUpModal(inv)} title={t.followUp} className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg"><IconArrowRight className="w-4 h-4" /></button>
                          )}
                          {editable && !cancelled && balance > 0 && (
                            <button onClick={() => openPaymentModal(inv)} title={lang === 'fa' ? 'ثبت واریز' : 'Record payment'} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><IconMoney className="w-4 h-4" /></button>
                          )}
                          {editable && !cancelled && (
                            <button onClick={() => handleCancelInvoice(inv)} title={t.cancelInvoice} className="px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200">{lang === 'fa' ? 'کنسل' : 'Cancel'}</button>
                          )}
                          {editable && cancelled && (
                            <button onClick={() => handleRestoreInvoice(inv)} title={t.restoreInvoice} className="px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200">{lang === 'fa' ? 'بازگردانی' : 'Restore'}</button>
                          )}
                          <button onClick={() => startEdit(inv)} title={editable ? t.edit : (lang === 'fa' ? 'مشاهده' : 'View')} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"><IconEdit className="w-4 h-4" /></button>
                          {editable && <button onClick={() => handleDelete(inv.id)} title={t.del} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><IconTrash className="w-4 h-4" /></button>}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > ARCHIVE_PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/80">
              <p className="text-xs text-gray-500">
                {t.showing} {Math.min((archivePage - 1) * ARCHIVE_PAGE_SIZE + 1, filtered.length)}–{Math.min(archivePage * ARCHIVE_PAGE_SIZE, filtered.length)} {lang === 'fa' ? 'از' : 'of'} {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={archivePage <= 1}
                  onClick={() => setArchivePage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                >
                  {t.prev}
                </button>
                <span className="text-xs font-semibold text-gray-600 px-2">
                  {t.page} {archivePage} {t.of} {archivePageCount}
                </span>
                <button
                  type="button"
                  disabled={archivePage >= archivePageCount}
                  onClick={() => setArchivePage(p => Math.min(archivePageCount, p + 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                >
                  {t.next}
                </button>
              </div>
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
            <div><label className={lbl}>{t.docTitle}</label><input className={cFld + ' dir-ltr'} value={companyForm.defaultDocumentTitle || ''} onChange={e => setCompanyForm(f => ({ ...f, defaultDocumentTitle: e.target.value }))} placeholder="INVOICE" /></div>
            <div><label className={lbl}>{t.colQty}</label><input className={cFld + ' dir-ltr'} value={companyForm.defaultQtyColumnLabel || ''} onChange={e => setCompanyForm(f => ({ ...f, defaultQtyColumnLabel: e.target.value }))} placeholder="QTY" /></div>
            <div><label className={lbl}>{t.colUnitPrice}</label><input className={cFld + ' dir-ltr'} value={companyForm.defaultUnitPriceColumnLabel || ''} onChange={e => setCompanyForm(f => ({ ...f, defaultUnitPriceColumnLabel: e.target.value }))} placeholder="UNIT PRICE" /></div>
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
            <div>
              <label className={lbl}>{t.amountDecimals}</label>
              <select
                className={cFld + ' dir-ltr'}
                value={resolveInvoiceDecimals(companyForm.amountDecimals)}
                onChange={e => setCompanyForm(f => ({ ...f, amountDecimals: Number(e.target.value) as 0 | 1 | 2 | 3 }))}
              >
                <option value={0}>{lang === 'fa' ? 'بدون اعشار' : 'No decimals'}</option>
                <option value={1}>{lang === 'fa' ? '۱ رقم اعشار' : '1 decimal'}</option>
                <option value={2}>{lang === 'fa' ? '۲ رقم اعشار' : '2 decimals'}</option>
                <option value={3}>{lang === 'fa' ? '۳ رقم اعشار' : '3 decimals'}</option>
              </select>
              <p className="text-[11px] text-gray-400 mt-1">{t.amountDecimalsHint}</p>
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
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-sm">
                <span className="text-indigo-700 text-xs font-semibold whitespace-nowrap">{t.invAmountDecimals}</span>
                <select
                  className="outline-none bg-transparent font-bold text-indigo-900 dir-ltr cursor-pointer"
                  value={draftAmountDecimals}
                  onChange={e => setField('amountDecimals', Number(e.target.value) as 0 | 1 | 2 | 3)}
                  disabled={readonly}
                >
                  {decimalOptions}
                </select>
              </div>
              <select value={draft.status === 'cancelled' ? 'cancelled' : (draft.status || 'draft')} onChange={e => { if (e.target.value !== 'cancelled') setField('status', e.target.value); }} disabled={isInvoiceCancelled(draft) || readonly} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none disabled:opacity-60">
                <option value="draft">{t.draft}</option>
                <option value="issued">{t.issued}</option>
                <option value="paid">{t.paid}</option>
                {isInvoiceCancelled(draft) && <option value="cancelled">{t.cancelled}</option>}
              </select>
              {!readonly && !isInvoiceCancelled(draft) && (
                <button type="button" onClick={() => handleCancelInvoice(draft)} className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-bold hover:bg-red-100">
                  {t.cancelInvoice}
                </button>
              )}
              {!readonly && isInvoiceCancelled(draft) && (
                <button type="button" onClick={() => handleRestoreInvoice(draft)} className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-bold hover:bg-emerald-100">
                  {t.restoreInvoice}
                </button>
              )}
              <button type="button" onClick={exportCurrentJson} className="text-xs px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">{t.exportJson}</button>
              <button onClick={handleExportPdf} disabled={pdfGenerating} className="flex items-center gap-1.5 bg-gray-700 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-gray-800 disabled:opacity-50"><IconPrinter className="w-4 h-4" />{pdfGenerating ? 'PDF…' : 'PDF'}</button>
              {!readonly && <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"><IconCheck className="w-4 h-4" />{t.save}</button>}
            </div>
          </div>
          {importErr && mode === 'editor' && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4 print:hidden">{importErr}</p>
          )}

          {/* Density / empty-space controls */}
          <div className="print:hidden mb-3 bg-white border border-gray-100 rounded-xl p-3 flex flex-wrap items-center gap-4">
            <div className="min-w-[180px] flex-1">
              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                <span>{lang === 'fa' ? 'فشرده‌سازی فضاهای خالی' : 'Tighten empty space'}</span>
                <span>{draft.printDensity ?? 0}%</span>
              </div>
              <input
                type="range" min={0} max={70} step={5}
                value={draft.printDensity ?? 0}
                disabled={readonly}
                onChange={e => setField('printDensity', Number(e.target.value))}
                className="w-full accent-gray-900"
              />
            </div>
            <div className="min-w-[140px] w-40">
              <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                <span>{lang === 'fa' ? 'حاشیه صفحه' : 'Page padding'}</span>
                <span>{draft.printPadding ?? 26}px</span>
              </div>
              <input
                type="range" min={12} max={36} step={2}
                value={draft.printPadding ?? 26}
                disabled={readonly}
                onChange={e => setField('printPadding', Number(e.target.value))}
                className="w-full accent-gray-900"
              />
            </div>
            <div className="flex gap-1.5">
              {[
                { d: 0, p: 26, label: lang === 'fa' ? 'باز' : 'Open' },
                { d: 30, p: 20, label: lang === 'fa' ? 'فشرده' : 'Compact' },
                { d: 55, p: 14, label: lang === 'fa' ? 'خیلی فشرده' : 'Tight' },
              ].map(pr => (
                <button
                  key={pr.label}
                  type="button"
                  disabled={readonly}
                  onClick={() => { setField('printDensity', pr.d); setField('printPadding', pr.p); }}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-bold border border-gray-200 hover:border-gray-400 disabled:opacity-50"
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </div>

          {/* A4 sheet */}
          <div
            ref={invoiceSheetRef}
            className="bg-white mx-auto rounded-lg border border-gray-100 shadow-sm invoice-content text-gray-800"
            style={{
              width: 794,
              maxWidth: '100%',
              padding: `${draft.printPadding ?? 26}px ${Math.max(18, (draft.printPadding ?? 26) + 4)}px`,
              boxSizing: 'border-box',
              fontFamily: "'Vazirmatn', Tahoma, 'Segoe UI', sans-serif",
              ['--inv-density' as string]: String(draft.printDensity ?? 0),
              ['--inv-gap' as string]: `${Math.max(4, Math.round(12 * (1 - (draft.printDensity ?? 0) / 100 * 0.7)))}px`,
              ['--inv-block-pad' as string]: `${Math.max(6, Math.round(12 * (1 - (draft.printDensity ?? 0) / 100 * 0.65)))}px`,
              ['--inv-mb' as string]: `${Math.max(4, Math.round(12 * (1 - (draft.printDensity ?? 0) / 100 * 0.75)))}px`,
            }}
            dir="ltr"
          >

            <div className="invoice-pdf-sheet relative overflow-hidden">
              {isInvoiceCancelled(draft) && (
                <div className="invoice-cancelled-stamp pointer-events-none absolute inset-0 z-20 flex items-center justify-center" aria-hidden>
                  <div
                    className="select-none font-black uppercase tracking-[0.2em] text-red-600/22 border-[6px] border-red-500/25 rounded-2xl px-10 py-6 rotate-[-18deg] text-5xl"
                    style={{ textShadow: '0 0 1px rgba(220,38,38,0.15)' }}
                  >
                    {t.cancelledStamp}
                  </div>
                </div>
              )}
              {isInvoiceCancelled(draft) && draft.cancelReason && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800 print:border-red-300">
                  <span className="font-bold">{lang === 'fa' ? 'دلیل کنسل:' : 'Cancellation reason:'}</span> {draft.cancelReason}
                </div>
              )}
              <div className="flex justify-between items-start gap-5">
                <div className="min-w-0">
                  {template.logoUrl && (
                    <img src={template.logoUrl} alt="logo" className="h-14 object-contain object-left block" />
                  )}
                  <div className={`text-[11px] leading-relaxed ${template.logoUrl ? 'mt-1' : ''}`}>
                    <div className="font-bold text-[14px]" style={{ color: DARK }}>{template.companyName}</div>
                    {template.address && <div className="text-gray-600 max-w-md mt-0.5">{template.address}</div>}
                    {template.crNumber && <div className="text-gray-600">CR No.: {template.crNumber}</div>}
                    <div className="mt-1 space-y-0.5" style={{ color: accent }}>
                      {template.phone && <div>{template.phone}</div>}
                      {template.email && <div>{template.email}</div>}
                      {template.website && <div>{template.website}</div>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 w-full max-w-[300px]">
                  <input
                    className="invoice-block-field w-full text-2xl font-black tracking-tight text-right uppercase outline-none bg-transparent border-b border-transparent focus:border-gray-200 print:border-0"
                    style={{ color: DARK }}
                    placeholder="INVOICE"
                    value={draft.documentTitle || 'INVOICE'}
                    onChange={e => setField('documentTitle', e.target.value)}
                    readOnly={readonly}
                  />
                  <div className="mt-2 text-[12px] space-y-1.5">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <span className="text-gray-500 shrink-0">Invoice No.</span>
                      {readonly ? (
                        <span className="font-semibold" style={{ color: accent }}>{draft.number}</span>
                      ) : (
                        <>
                          <input
                            type="text"
                            dir="ltr"
                            className="invoice-inline-field font-semibold text-right outline-none bg-transparent border-b border-gray-200 focus:border-indigo-300 min-w-[120px] max-w-[200px] print:border-0"
                            style={{ color: accent }}
                            value={draft.number}
                            onChange={e => setField('number', e.target.value.slice(0, 48))}
                          />
                          <button
                            type="button"
                            title={t.regenNo}
                            onClick={() => setField('number', genInvoiceNumber(template, visibleInvoices.length + 1))}
                            className="text-[9px] text-indigo-600 hover:underline print:hidden shrink-0"
                          >
                            {t.regenNo}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-gray-500 shrink-0">Date</span>
                      {readonly ? (
                        <span className="font-medium">{fmtDate(draft.date)}</span>
                      ) : (
                        <input
                          type="date"
                          dir="ltr"
                          className="invoice-inline-field font-medium outline-none bg-transparent border-b border-gray-200 focus:border-indigo-300 print:border-0"
                          value={draft.date || ''}
                          onChange={e => setField('date', e.target.value)}
                        />
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Currency </span>
                      <select className="invoice-inline-field font-medium outline-none bg-transparent border-b border-gray-200 print:border-0 print:appearance-none" value={currencySelectValue} onChange={e => setCurrencyPreset(e.target.value)}>
                        {INVOICE_PRESET_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value={INVOICE_CURRENCY_CUSTOM}>Custom</option>
                      </select>
                      {currencySelectValue === INVOICE_CURRENCY_CUSTOM && (
                        <input className="invoice-inline-field w-14 font-medium outline-none bg-transparent border-b border-gray-200 uppercase print:border-0 ml-1" placeholder="GBP" value={draft.currency || ''} onChange={e => setField('currency', e.target.value.toUpperCase().slice(0, 12))} />
                      )}
                    </div>
                    <div className="print:hidden">
                      <span className="text-gray-500">{t.invAmountDecimals} </span>
                      <select
                        className="invoice-inline-field font-medium outline-none bg-transparent border-b border-gray-200 dir-ltr"
                        value={draftAmountDecimals}
                        onChange={e => setField('amountDecimals', Number(e.target.value) as 0 | 1 | 2 | 3)}
                        disabled={readonly}
                      >
                        {decimalOptions}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-[2px] mt-3 mb-3" style={{ backgroundColor: DARK }} />

              <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
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
                <div className="space-y-1">
                  <input className="invoice-block-field block w-full font-bold text-[14px] outline-none bg-transparent print:border-0 border-b border-transparent focus:border-gray-200" style={{ color: DARK }} placeholder="Mr. Customer Name" value={draft.customerName} onChange={e => setField('customerName', e.target.value)} />
                  <input className="invoice-block-field block w-full text-[12px] text-gray-700 outline-none bg-transparent print:border-0 border-b border-transparent focus:border-gray-200" placeholder="Company" value={draft.companyName || ''} onChange={e => setField('companyName', e.target.value)} />
                  <input className="invoice-block-field block w-full text-[11px] text-gray-500 outline-none bg-transparent dir-ltr print:border-0 border-b border-transparent focus:border-gray-200" placeholder="Phone: ..." value={draft.customerPhone ? `Phone: ${draft.customerPhone}` : ''} onChange={e => setField('customerPhone', e.target.value.replace(/^Phone:\s*/i, ''))} />
                  <input className="invoice-block-field block w-full text-[11px] text-gray-400 outline-none bg-transparent print:border-0 border-b border-transparent focus:border-gray-200" placeholder="Address" value={draft.customerAddress || ''} onChange={e => setField('customerAddress', e.target.value)} />
                </div>
              </div>
              <div className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-bold tracking-wider text-gray-400">PAYMENT TERMS</p>
                  <SectionPresetControls section="paymentTerms" />
                </div>
                <textarea rows={3} className="w-full text-[12px] text-gray-700 outline-none bg-transparent resize-none leading-relaxed" placeholder="Advance Payment: 80% to start / 20% upon completion." value={draft.paymentTerms || ''} onChange={e => setField('paymentTerms', e.target.value)} />
              </div>
            </div>

            {/* ── Items table ── */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-[10px] font-bold tracking-wider text-gray-400">LINE ITEMS</p>
              <SectionPresetControls section="items" />
            </div>
            <table className="w-full text-[12px] mb-2 border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-500 text-[10px] tracking-wider">
                  <th className="px-2 py-2 text-left w-8">#</th>
                  <th className="px-2 py-2 text-left">DESCRIPTION</th>
                  <th className="px-2 py-2 text-center w-20">
                    <input
                      className="invoice-inline-field w-full text-center uppercase outline-none bg-transparent text-[10px] font-bold tracking-wider text-gray-500 print:border-0"
                      value={draft.qtyColumnLabel || 'QTY'}
                      onChange={e => setField('qtyColumnLabel', e.target.value.slice(0, 24))}
                      readOnly={readonly}
                    />
                  </th>
                  <th className="px-2 py-2 text-right w-32">
                    <input
                      className="invoice-inline-field uppercase outline-none bg-transparent text-[10px] font-bold tracking-wider text-gray-500 print:border-0 text-right w-auto max-w-[120px]"
                      value={draft.unitPriceColumnLabel || 'UNIT PRICE'}
                      onChange={e => setField('unitPriceColumnLabel', e.target.value.slice(0, 32))}
                      readOnly={readonly}
                    />
                    {' '}({cur})
                  </th>
                  <th className="px-2 py-2 text-right w-28">AMOUNT ({cur})</th>
                  <th className="print:hidden w-8"></th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 align-top">
                    <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <input
                        className="invoice-block-field w-full font-semibold outline-none bg-transparent leading-snug"
                        style={{ color: accent, unicodeBidi: 'isolate' }}
                        dir={textDirection(item.description.split('\n')[0] || '')}
                        placeholder="Service title"
                        value={item.description.split('\n')[0] || ''}
                        onChange={e => {
                          const rest = item.description.split('\n').slice(1).join('\n');
                          setItem(idx, 'description', rest ? `${e.target.value}\n${rest}` : e.target.value);
                        }}
                        readOnly={readonly}
                      />
                      <textarea
                        className="invoice-block-field w-full text-[10px] text-gray-500 outline-none bg-transparent leading-snug mt-0.5 print:border-0 resize-none"
                        style={{ unicodeBidi: 'plaintext' }}
                        dir={textDirection(item.description.split('\n').slice(1).join('\n'))}
                        rows={Math.min(6, Math.max(2, item.description.split('\n').slice(1).filter(Boolean).length || 2))}
                        placeholder="Details (EN / فارسی)"
                        value={item.description.split('\n').slice(1).join('\n')}
                        onChange={e => {
                          const first = item.description.split('\n')[0] || '';
                          setItem(idx, 'description', e.target.value ? `${first}\n${e.target.value}` : first);
                        }}
                        readOnly={readonly}
                      />
                    </td>
                    <td className="px-2 py-2 text-center"><input type="number" min="0" className="invoice-inline-field w-full outline-none bg-transparent text-center" value={item.quantity} onChange={e => setItem(idx, 'quantity', parseInt(e.target.value) || 0)} readOnly={readonly} /></td>
                    <td className="px-2 py-2 text-right">
                      {!readonly && (
                        <label className="flex items-center justify-end gap-1 text-[9px] text-gray-500 print:hidden mb-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="accent-emerald-600"
                            checked={!!item.priceIncluded}
                            onChange={e => setItem(idx, 'priceIncluded', e.target.checked)}
                          />
                          {lang === 'fa' ? 'شامل (Included)' : 'Included'}
                        </label>
                      )}
                      {item.priceIncluded ? (
                        <span className="text-emerald-700 font-bold italic text-[11px] tracking-wide">Included</span>
                      ) : (
                        <InvoiceAmountInput
                          className="invoice-inline-field w-full outline-none bg-transparent text-right dir-ltr"
                          placeholder="0"
                          value={item.unitPrice || 0}
                          maxDecimals={draftAmountDecimals}
                          onChange={n => setItem(idx, 'unitPrice', n)}
                          readOnly={readonly}
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-bold" style={{ color: DARK }}>
                      {item.priceIncluded ? (
                        <span className="text-emerald-700 font-bold italic text-[11px]">Included</span>
                      ) : (
                        money(item.total)
                      )}
                    </td>
                    <td className="print:hidden text-center">{draft.items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><IconTrash className="w-3.5 h-3.5" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!readonly && <button onClick={addItem} className="text-indigo-600 font-bold text-xs flex items-center gap-1 hover:underline print:hidden mb-2"><IconPlus className="w-3.5 h-3.5" />Add row</button>}

            {/* ── Extra charges & VAT (editor only) ── */}
            <div className="flex items-center justify-between gap-2 mb-2 print:hidden">
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
                    <InvoiceAmountInput
                      className="w-28 text-right outline-none bg-transparent font-semibold dir-ltr print:w-auto print:border-0 border-b border-transparent focus:border-gray-200"
                      placeholder="0"
                      value={adj.amount || 0}
                      allowNegative
                      maxDecimals={draftAmountDecimals}
                      onChange={n => setAdjustment(adj.id, 'amount', n)}
                    />
                    <span className="text-gray-400 w-8 print:hidden">{cur}</span>
                    {!readonly && <button type="button" onClick={() => removeAdjustment(adj.id)} className="text-red-400 hover:text-red-600 print:hidden"><IconTrash className="w-3 h-3" /></button>}
                  </div>
                ))}
              </div>
            )}

            {/* ── Totals (Subtotal → discounts/charges → Net → VAT → Total) ── */}
            <div className="flex flex-col items-end gap-0 mb-3 text-[12px]">
              <div className="w-full flex justify-end border-b border-gray-100 py-1.5"><span className="text-gray-500 mr-6">Subtotal ({cur})</span><span className="font-semibold w-28 text-right" style={{ color: DARK }}>{money(draft.subTotal)}</span></div>
              {(draft.adjustments || []).filter(a => a.amount !== 0).map(adj => (
                <div key={adj.id} className={`w-full flex justify-end border-b py-1.5 ${adj.amount < 0 ? 'bg-amber-50/80 border-amber-100' : 'border-gray-100'}`}>
                  <span className="text-gray-500 mr-6">{adj.label} ({cur})</span>
                  <span className={`font-medium w-28 text-right ${adj.amount < 0 ? 'text-red-600' : ''}`} style={adj.amount >= 0 ? { color: DARK } : undefined}>{money(adj.amount)}</span>
                </div>
              ))}
              <div className="w-full flex justify-end border-b border-sky-100 bg-sky-50/70 py-1.5"><span className="text-gray-700 font-semibold mr-6">Net (excl. VAT) ({cur})</span><span className="font-bold w-28 text-right" style={{ color: DARK }}>{money(netAmount(draft))}</span></div>
              <div className="print:hidden flex items-center gap-2 mb-1.5 w-full">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">VAT mode</span>
                <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="radio" name="vatMode" className="accent-indigo-600" checked={draft.vatInclusive === true} onChange={() => setField('vatInclusive', true)} />Inclusive</label>
                <label className="flex items-center gap-1 text-[11px] cursor-pointer"><input type="radio" name="vatMode" className="accent-indigo-600" checked={draft.vatInclusive !== true} onChange={() => setField('vatInclusive', false)} />Exclusive</label>
              </div>
              <div className="w-full flex justify-end border-b border-gray-100 py-1.5">
                <span className="text-gray-400 mr-6 whitespace-nowrap">
                  VAT (
                  <input type="number" className="invoice-inline-field w-7 text-center border-b border-gray-200 outline-none bg-transparent print:border-0" value={draft.taxRate} onChange={e => setField('taxRate', parseFloat(e.target.value) || 0)} />
                  % — {draft.vatInclusive ? 'incl.' : 'excl.'}) ({cur})
                </span>
                <span className="text-gray-500 w-28 text-right shrink-0">{money(draft.taxAmount)}</span>
              </div>
              <div
                className="w-full flex justify-between items-center gap-6 py-2.5 px-4 mt-1 text-white"
                style={{ backgroundColor: DARK }}
              >
                <span className="font-bold tracking-wide shrink-0">TOTAL DUE</span>
                <div className="text-right shrink-0 min-w-[6rem]">
                  <div className="text-[10px] font-semibold tracking-wider opacity-85 leading-none mb-0.5">{cur}</div>
                  <div className="font-black text-base sm:text-lg leading-tight tabular-nums whitespace-nowrap">
                    {formatInvoiceAmount(draft.total, draftAmountDecimals)}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Payment receipt (when partial / full payments recorded) ── */}
            {invoiceAmountPaid(draft) > 0 && (
              <div className="mb-3 border border-emerald-200 rounded-md overflow-hidden text-[11px]">
                <div className="bg-emerald-50 px-3 py-1.5 border-b border-emerald-100">
                  <p className="text-[9px] font-bold tracking-wider text-emerald-800">PAYMENT RECEIPT</p>
                </div>
                <div className="px-3 py-2">
                  <div className="flex justify-end border-b border-gray-100 py-1"><span className="text-gray-500 mr-6">Invoice Total ({cur})</span><span className="font-semibold w-28 text-right">{money(draft.total)}</span></div>
                  <div className="flex justify-end border-b border-gray-100 py-1"><span className="text-gray-500 mr-6">Amount Received ({cur})</span><span className="font-semibold w-28 text-right text-emerald-700">{money(invoiceAmountPaid(draft))}</span></div>
                  <div className="flex justify-end py-1"><span className="font-bold text-gray-800 mr-6">Balance Due ({cur})</span><span className="font-black w-28 text-right" style={{ color: invoiceBalanceDue(draft) > 0 ? '#b45309' : DARK }}>{money(invoiceBalanceDue(draft))}</span></div>
                  {(draft.receipts || []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[9px] font-bold tracking-wider text-gray-400 mb-1">PAYMENT HISTORY</p>
                      {(draft.receipts || []).map(r => (
                        <div key={r.id} className="flex justify-between text-[11px] py-0.5 text-gray-600">
                          <span>{fmtDate(r.date)}{r.method ? ` · ${r.method}` : ''}{r.reference ? ` · Ref: ${r.reference}` : ''}</span>
                          <span className="font-semibold text-emerald-700 shrink-0 ml-2">{money(r.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Payment details + Notes ── */}
            <div className="grid grid-cols-2 gap-3 invoice-payment-notes-row invoice-keep-together" style={{ marginBottom: 'var(--inv-mb, 12px)', gap: 'var(--inv-gap, 12px)' }}>
              <div className="border border-gray-200 rounded-md invoice-keep-together text-[11px] leading-relaxed" style={{ padding: 'var(--inv-block-pad, 12px)' }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-bold tracking-wider text-gray-400">PAYMENT DETAILS</p>
                  <SectionPresetControls section="paymentDetails" />
                </div>
                <textarea
                  rows={3}
                  className="w-full text-[11px] text-gray-700 outline-none bg-transparent resize-none leading-snug whitespace-pre-wrap"
                  style={{ unicodeBidi: 'plaintext' }}
                  dir={textDirection(draft.paymentDetails || '')}
                  placeholder="Paste or type your bank / payment details here…"
                  value={draft.paymentDetails || ''}
                  onChange={e => setField('paymentDetails', e.target.value)}
                />
              </div>
              <div className="border border-gray-200 rounded-md invoice-notes-box invoice-keep-together" style={{ padding: 'var(--inv-block-pad, 12px)' }}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-bold tracking-wider text-gray-400">NOTES / TERMS</p>
                  <SectionPresetControls section="notes" />
                </div>
                <textarea
                  rows={4}
                  className="w-full text-[11px] text-gray-600 outline-none bg-transparent resize-none leading-relaxed whitespace-pre-wrap"
                  style={{ unicodeBidi: 'plaintext' }}
                  dir={textDirection(draft.note || '')}
                  placeholder={'Project Details & Timeline\n• ...'}
                  value={draft.note || ''}
                  onChange={e => setField('note', e.target.value)}
                />
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="invoice-footer-block invoice-keep-together" style={{ marginTop: 'var(--inv-mb, 12px)', paddingTop: 'var(--inv-block-pad, 12px)' }}>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="border border-gray-200 rounded-md p-3">
                  <p className="text-[9px] font-bold tracking-wider text-gray-400 mb-4">AUTHORIZED SIGNATURE</p>
                  <div className="border-t border-gray-400 pt-1 text-center text-[9px] tracking-wider text-gray-500">{(template.companyName || '').toUpperCase()}</div>
                </div>
                <div />
              </div>
              <div className="text-center text-[9px] text-gray-400">Generated by {template.companyName} — issued {fmtDate(draft.date)}</div>
            </div>
            </div>{/* end invoice-pdf-sheet */}
          </div>

          <style>{`
            .pdf-export .print\\:hidden { display: none !important; }
            .pdf-export .invoice-pdf-capture-host,
            .pdf-export .invoice-pdf-capture-root {
              width: 794px !important;
              max-width: 794px !important;
              min-width: 794px !important;
            }
            .pdf-export .invoice-content,
            .pdf-export .invoice-pdf-capture-root {
              box-shadow: none !important;
              border: 0 !important;
              box-sizing: border-box !important;
            }
            .pdf-export .invoice-pdf-sheet { overflow: visible !important; }
            .invoice-keep-together { break-inside: avoid; page-break-inside: avoid; }
            .invoice-notes-box { break-inside: avoid; page-break-inside: avoid; }
            .invoice-cancelled-stamp { break-inside: avoid; page-break-inside: avoid; }
            .invoice-content textarea,
            .invoice-content input[dir="rtl"] {
              unicode-bidi: plaintext;
            }
            @media print {
              @page { size: A4 portrait; margin: 12mm; }
              body * { visibility: hidden; }
              .invoice-content, .invoice-content * { visibility: visible; }
              .invoice-content { position: absolute; left: 0; top: 0; width: 210mm !important; max-width: 210mm !important; min-height: auto !important; margin: 0; border: 0 !important; box-shadow: none !important; }
              .invoice-keep-together, .invoice-notes-box, .invoice-payment-notes-row, .invoice-footer-block { break-inside: avoid; page-break-inside: avoid; }
              .print\\:hidden { display: none !important; }
              .print\\:border-0 { border: 0 !important; }
            }
          `}</style>
        </div>
      )}

      {/* ── Record payment modal (from archive) ── */}
      {paymentModalInv && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:hidden" onClick={() => setPaymentModalInv(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir="ltr">
            <h4 className="font-bold text-gray-900 mb-1">Record Payment</h4>
            <p className="text-xs text-gray-500 mb-4">{paymentModalInv.number} · {paymentModalInv.customerName}</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Invoice Total</span><span className="font-bold">{fmtMoney(paymentModalInv.total, paymentModalInv.currency || 'OMR', paymentModalInv)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Already Paid</span><span className="font-semibold text-emerald-600">{fmtMoney(invoiceAmountPaid(paymentModalInv), paymentModalInv.currency || 'OMR', paymentModalInv)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="font-semibold text-gray-700">Balance Due</span><span className="font-bold text-amber-600">{fmtMoney(invoiceBalanceDue(paymentModalInv), paymentModalInv.currency || 'OMR', paymentModalInv)}</span></div>
            </div>
            <div className="space-y-3">
              <div><label className={lbl}>Amount</label><InvoiceAmountInput className={cFld + ' dir-ltr'} value={paymentForm.amount} maxDecimals={paymentDecimals} onChange={n => setPaymentForm(f => ({ ...f, amount: n }))} /></div>
              <div><label className={lbl}>Date</label><input type="date" className={cFld + ' dir-ltr'} value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label className={lbl}>Method <span className="text-gray-400 font-normal">(optional)</span></label><input className={cFld} placeholder="Bank Transfer, Cash…" value={paymentForm.method} onChange={e => setPaymentForm(f => ({ ...f, method: e.target.value }))} /></div>
              <div><label className={lbl}>Reference <span className="text-gray-400 font-normal">(optional)</span></label><input className={cFld + ' dir-ltr'} placeholder="Transaction ID" value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} /></div>
              <div><label className={lbl}>Note <span className="text-gray-400 font-normal">(optional)</span></label><input className={cFld} value={paymentForm.note} onChange={e => setPaymentForm(f => ({ ...f, note: e.target.value }))} /></div>
            </div>
            {(paymentModalInv.receipts || []).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 mb-2">Previous Payments</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(paymentModalInv.receipts || []).map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5">
                      <span>{fmtDate(r.date)} · {fmtMoney(r.amount, paymentModalInv.currency || 'OMR', paymentModalInv)}{r.method ? ` · ${r.method}` : ''}</span>
                      {!readonly && <button type="button" onClick={() => handleRemoveReceipt(paymentModalInv, r.id)} className="text-red-400 hover:text-red-600 p-0.5"><IconTrash className="w-3 h-3" /></button>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={() => setPaymentModalInv(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="button" disabled={paymentSaving} onClick={handleRecordPayment} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">Record Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Follow-up assignment modal ── */}
      {followUpModalInv && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:hidden" onClick={() => !followUpSaving && setFollowUpModalInv(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
            <h4 className="font-bold text-gray-900 mb-1">{t.followUpTitle}</h4>
            <p className="text-xs text-gray-500 mb-1">{followUpModalInv.number} · {followUpModalInv.customerName}</p>
            <p className="text-[11px] text-violet-600/80 mb-4">{t.followUpHint}</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <div className="flex justify-between gap-4"><span className="text-gray-500">{t.amount}</span><span className="font-bold" dir="ltr">{fmtMoney(followUpModalInv.total, followUpModalInv.currency || 'OMR', followUpModalInv)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-gray-500">{lang === 'fa' ? 'مانده' : 'Balance due'}</span><span className="font-bold text-amber-600" dir="ltr">{fmtMoney(invoiceBalanceDue(followUpModalInv), followUpModalInv.currency || 'OMR', followUpModalInv)}</span></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">{t.followUpAssignee}</label>
                <StaffIdPicker
                  personnel={personnel.filter(p => p.isActive !== false)}
                  selectedIds={followUpAssigneeIds}
                  onChange={ids => setFollowUpAssigneeIds(ids.slice(-1))}
                  lang={lang}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">{t.followUpNote}</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-violet-400 min-h-[80px] resize-y"
                  value={followUpNote}
                  onChange={e => setFollowUpNote(e.target.value)}
                  placeholder={lang === 'fa' ? 'مثلاً: تماس با مشتری برای وصول مانده تا پایان هفته' : 'e.g. Call customer about balance due by end of week'}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" disabled={followUpSaving} onClick={() => setFollowUpModalInv(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">{t.cancel}</button>
              <button type="button" disabled={followUpSaving || followUpAssigneeIds.length === 0} onClick={handleFollowUpAssign} className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <IconArrowRight className="w-4 h-4" />
                {followUpSaving ? (lang === 'fa' ? 'در حال ارسال…' : 'Sending…') : t.followUpSubmit}
              </button>
            </div>
          </div>
        </div>
      )}
      </>)}
    </div>
  );
};
