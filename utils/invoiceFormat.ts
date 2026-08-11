import type { AppConfig, Invoice, InvoiceAdjustment, InvoiceItem, InvoiceTemplate } from '../types';
import { computeInvoiceTotals, invoiceLineTotal } from './invoiceTotals';

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const num = (v: unknown, fallback = 0) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const STATUS: NonNullable<Invoice['status']>[] = ['draft', 'issued', 'paid', 'cancelled'];

export interface InvoiceImportContext {
  actor?: { fullName?: string; id?: string };
  config?: AppConfig;
  existingCount?: number;
}

export function defaultInvoiceTemplate(config?: AppConfig): InvoiceTemplate {
  return config?.invoiceTemplate || {
    companyName: config?.appTitle || 'Company',
    address: '',
    phone: '',
    footerText: 'Thank you for choosing our services.',
    termsConditions: '',
    defaultTaxRate: 5,
    colorTheme: '#0f766e',
  };
}

export function genInvoiceRefNo(template: InvoiceTemplate, count: number): string {
  const prefix = template.invoicePrefix || 'INV';
  const now = new Date();
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const seq = String((count + 1) % 100000 + Math.floor(now.getTime() % 1000)).padStart(5, '0').slice(-5);
  return `${prefix}-${y}-${mm}${dd}-${seq}`;
}

function mapItem(raw: Record<string, unknown>): InvoiceItem {
  const item: InvoiceItem = {
    description: str(raw.description),
    quantity: num(raw.quantity, 1),
    unitPrice: num(raw.unitPrice, 0),
    total: 0,
    ...(raw.priceIncluded ? { priceIncluded: true } : {}),
  };
  item.total = invoiceLineTotal(item);
  return item;
}

function mapAdjustment(raw: Record<string, unknown>, i: number): InvoiceAdjustment {
  return {
    id: str(raw.id, uid('adj')),
    label: str(raw.label, 'Other charge'),
    amount: num(raw.amount, 0),
  };
}

export function normalizePaymentDetailsFromJson(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const pd = value as Record<string, string | undefined>;
    return [pd.bankName, pd.accountHolder, pd.accountNumber, pd.swiftCode, pd.iban]
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export function emptyInvoiceImportBase(ctx?: InvoiceImportContext): Invoice {
  const tpl = defaultInvoiceTemplate(ctx?.config);
  const now = new Date().toISOString();
  return {
    id: `inv-${Date.now()}`,
    number: genInvoiceRefNo(tpl, ctx?.existingCount ?? 0),
    date: today(),
    customerName: '',
    companyName: '',
    customerPhone: '',
    customerAddress: '',
    customerEmail: '',
    items: [{ description: '', quantity: 1, unitPrice: 0, total: 0 }],
    adjustments: [],
    currency: tpl.defaultCurrency || 'OMR',
    subTotal: 0,
    taxRate: tpl.defaultTaxRate ?? 5,
    taxAmount: 0,
    discount: 0,
    total: 0,
    issuedBy: ctx?.actor?.fullName || '',
    issuedByPersonnelId: ctx?.actor?.id,
    status: 'draft',
    createdAt: now,
    paymentTerms: tpl.defaultPaymentTerms || '',
    paymentDetails: '',
    note: tpl.defaultNotes || '',
    vatInclusive: tpl.vatInclusive ?? true,
    documentTitle: tpl.defaultDocumentTitle || 'INVOICE',
    qtyColumnLabel: tpl.defaultQtyColumnLabel || 'QTY',
    unitPriceColumnLabel: tpl.defaultUnitPriceColumnLabel || 'UNIT PRICE',
    amountDecimals: tpl.amountDecimals,
  };
}

/** Accepts envelope `{ invoice: {...} }` or flat invoice object (AI-friendly). */
export function parseInvoiceJson(input: unknown, ctx?: InvoiceImportContext): Invoice {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const root = input as Record<string, unknown>;
  const raw = (root.invoice && typeof root.invoice === 'object'
    ? root.invoice
    : root) as Record<string, unknown>;

  if (!str(raw.customerName) && !str(raw.number) && !Array.isArray(raw.items)) {
    throw new Error('missing_fields: need customerName / number / items[]');
  }

  const base = emptyInvoiceImportBase(ctx);
  let items = Array.isArray(raw.items)
    ? (raw.items as Record<string, unknown>[]).map(mapItem)
    : base.items;
  items = items.filter(it => it.description.trim() || it.unitPrice || it.priceIncluded);
  if (!items.length) items = [{ description: '', quantity: 1, unitPrice: 0, total: 0 }];

  const adjustments = Array.isArray(raw.adjustments)
    ? (raw.adjustments as Record<string, unknown>[]).map(mapAdjustment)
    : [];

  const status = STATUS.includes(raw.status as NonNullable<Invoice['status']>)
    ? (raw.status as NonNullable<Invoice['status']>)
    : 'draft';
  const dec = Number(raw.amountDecimals);
  const amountDecimals = [0, 1, 2, 3].includes(dec) ? (dec as 0 | 1 | 2 | 3) : base.amountDecimals;

  const inv: Invoice = {
    ...base,
    id: str(raw.id) || base.id,
    number: str(raw.number) || base.number,
    date: str(raw.date, today()),
    dueDate: str(raw.dueDate) || undefined,
    customerName: str(raw.customerName),
    companyName: str(raw.companyName) || undefined,
    customerId: str(raw.customerId) || undefined,
    customerAddress: str(raw.customerAddress) || undefined,
    customerPhone: str(raw.customerPhone) || undefined,
    customerEmail: str(raw.customerEmail) || undefined,
    items,
    adjustments,
    currency: str(raw.currency, base.currency),
    taxRate: num(raw.taxRate, base.taxRate),
    discount: num(raw.discount, 0),
    note: str(raw.note) || undefined,
    paymentTerms: str(raw.paymentTerms) || base.paymentTerms,
    paymentDetails: normalizePaymentDetailsFromJson(raw.paymentDetails),
    vatInclusive: raw.vatInclusive === false ? false : (raw.vatInclusive === true ? true : base.vatInclusive ?? true),
    documentTitle: str(raw.documentTitle, base.documentTitle || 'INVOICE'),
    qtyColumnLabel: str(raw.qtyColumnLabel, base.qtyColumnLabel || 'QTY'),
    unitPriceColumnLabel: str(raw.unitPriceColumnLabel, base.unitPriceColumnLabel || 'UNIT PRICE'),
    status,
    amountDecimals,
    issuedBy: ctx?.actor?.fullName || str(raw.issuedBy) || base.issuedBy,
    issuedByPersonnelId: ctx?.actor?.id || str(raw.issuedByPersonnelId) || base.issuedByPersonnelId,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt,
    subTotal: 0,
    taxAmount: 0,
    total: 0,
  };

  return { ...inv, ...computeInvoiceTotals(inv) };
}

/** Export envelope for AI / backup — totals are recalculated on import. */
export function exportInvoiceEnvelope(inv: Invoice): Record<string, unknown> {
  return {
    _schema_version: '1.0',
    _about: 'Invoice JSON for Tohid Dayhami Platform — Invoices tab (not Proposals / Contracts).',
    _for_ai_models:
      'Return ONLY valid JSON. Use envelope { "invoice": { ... } } OR a flat object with the same keys. '
      + 'Required: customerName, items[] (each: description, quantity, unitPrice; optional priceIncluded:true for included lines). '
      + 'Optional: number (omit for auto), date & dueDate as YYYY-MM-DD, companyName, customerAddress, customerPhone, customerEmail, '
      + 'currency (OMR|USD|AED|IRR|…), taxRate, vatInclusive (true = line prices include VAT), discount, '
      + 'adjustments[] ({ label, amount } — positive charge / negative discount), paymentTerms, paymentDetails '
      + '(multiline string OR { bankName, accountHolder, accountNumber, swiftCode, iban }), note, documentTitle, '
      + 'qtyColumnLabel, unitPriceColumnLabel, status (draft|issued|paid), amountDecimals (0–3). '
      + 'Do NOT send subTotal, taxAmount, or total — the app recalculates. Omit id and createdAt on import.',
    invoice: {
      number: inv.number,
      date: inv.date,
      dueDate: inv.dueDate || '',
      documentTitle: inv.documentTitle || 'INVOICE',
      customerName: inv.customerName,
      companyName: inv.companyName || '',
      customerAddress: inv.customerAddress || '',
      customerPhone: inv.customerPhone || '',
      customerEmail: inv.customerEmail || '',
      currency: inv.currency,
      taxRate: inv.taxRate,
      vatInclusive: inv.vatInclusive ?? true,
      discount: inv.discount || 0,
      amountDecimals: inv.amountDecimals ?? 3,
      qtyColumnLabel: inv.qtyColumnLabel || 'QTY',
      unitPriceColumnLabel: inv.unitPriceColumnLabel || 'UNIT PRICE',
      items: inv.items.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        ...(it.priceIncluded ? { priceIncluded: true } : {}),
      })),
      adjustments: (inv.adjustments || []).map(a => ({
        id: a.id,
        label: a.label,
        amount: a.amount,
      })),
      paymentTerms: inv.paymentTerms || '',
      paymentDetails: inv.paymentDetails || '',
      note: inv.note || '',
      status: inv.status || 'draft',
    },
  };
}

/** Ready-to-download sample for AI prompts and quick import tests. */
export function buildInvoiceSampleEnvelope(ctx?: InvoiceImportContext): Record<string, unknown> {
  const base = emptyInvoiceImportBase(ctx);
  const sample: Invoice = {
    ...base,
    documentTitle: 'INVOICE',
    date: today(),
    dueDate: plusDays(14),
    customerName: 'Ali Rezaei',
    companyName: 'Gulf Trading LLC',
    customerAddress: 'Muscat, Sultanate of Oman',
    customerPhone: '+968 9123 4567',
    customerEmail: 'ali@example.com',
    currency: 'OMR',
    taxRate: 5,
    vatInclusive: true,
    amountDecimals: 3,
    paymentTerms: 'Advance Payment: 50% to start the project\nBalance: 50% upon delivery.',
    paymentDetails: [
      'Bank: Bank Muscat',
      'Account Holder: Tohid Dayhami Business Solutions Center SPC',
      'Account No.: XXXXXXXXXXXX',
      'SWIFT: BMUSOMRXXXX',
      'IBAN: OMXX XXXX XXXX XXXX XXXX XXXX',
    ].join('\n'),
    note:
      'Project Details & Timeline\n'
      + '• Deliverables: Export documentation package + brand assets\n'
      + '• Estimated Timeline: 2–3 weeks from advance payment',
    items: [
      { description: 'Export Consultancy — Market entry assessment', quantity: 1, unitPrice: 350, total: 350 },
      { description: 'Company registration support (included in package)', quantity: 1, unitPrice: 0, total: 0, priceIncluded: true },
      { description: 'MetaShop setup — 10 SKU catalog', quantity: 1, unitPrice: 150, total: 150 },
    ],
    adjustments: [{ id: 'adj_sample1', label: 'Rush processing fee', amount: 25 }],
    discount: 0,
    status: 'draft',
    subTotal: 0,
    taxAmount: 0,
    total: 0,
  };
  const computed = { ...sample, ...computeInvoiceTotals(sample) };
  const env = exportInvoiceEnvelope(computed);
  const inv = env.invoice as Record<string, unknown>;
  inv.paymentDetails = {
    bankName: 'Bank Muscat',
    accountHolder: 'Tohid Dayhami Business Solutions Center SPC',
    accountNumber: 'XXXXXXXXXXXX',
    swiftCode: 'BMUSOMRXXXX',
    iban: 'OMXX XXXX XXXX XXXX XXXX XXXX',
  };
  return env;
}

export function downloadInvoiceJson(data: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
