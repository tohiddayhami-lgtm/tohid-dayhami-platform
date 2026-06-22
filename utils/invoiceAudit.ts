import { Invoice, InvoiceAdjustment, InvoiceItem, InvoiceReceipt } from '../types';
import { formatInvoiceMoney } from './invoiceMoney';

const eq = (a: unknown, b: unknown) => String(a ?? '') === String(b ?? '');

const itemsSummary = (items: InvoiceItem[]) =>
  items.map((it, i) => `#${i + 1} ${(it.description || '').split('\n')[0] || '—'} ×${it.quantity} ${it.priceIncluded ? '@ Included' : `@ ${it.unitPrice}`}`).join('; ');

const adjustmentsSummary = (adj: InvoiceAdjustment[]) =>
  adj.filter(a => a.amount !== 0).map(a => `${a.label}: ${a.amount}`).join('; ') || '—';

const receiptsSummary = (receipts: InvoiceReceipt[]) =>
  receipts.map(r => `${r.date}: ${r.amount}${r.method ? ` (${r.method})` : ''}`).join('; ') || '—';

/** Human-readable change summary for system audit logs. */
export function summarizeInvoiceChanges(prev: Invoice | null, next: Invoice): string {
  if (!prev) {
    return `Created ${next.documentTitle || 'INVOICE'} ${next.number} for ${next.customerName || '—'} — total ${formatInvoiceMoney(next.total, next.currency)}`;
  }

  const changes: string[] = [];
  const track = (label: string, oldVal: unknown, newVal: unknown) => {
    if (!eq(oldVal, newVal)) changes.push(`${label}: "${oldVal ?? ''}" → "${newVal ?? ''}"`);
  };

  track('Title', prev.documentTitle || 'INVOICE', next.documentTitle || 'INVOICE');
  track('Invoice No.', prev.number, next.number);
  track('Date', prev.date, next.date);
  track('Customer', prev.customerName, next.customerName);
  track('Company', prev.companyName, next.companyName);
  track('Phone', prev.customerPhone, next.customerPhone);
  track('Address', prev.customerAddress, next.customerAddress);
  track('Currency', prev.currency, next.currency);
  track('Status', prev.status, next.status);
  track('Payment terms', prev.paymentTerms, next.paymentTerms);
  track('Payment details', prev.paymentDetails, next.paymentDetails);
  track('Notes', prev.note, next.note);
  track('VAT rate', prev.taxRate, next.taxRate);
  track('VAT mode', prev.vatInclusive ? 'inclusive' : 'exclusive', next.vatInclusive ? 'inclusive' : 'exclusive');

  if (!eq(prev.subTotal, next.subTotal) || !eq(prev.total, next.total) || !eq(prev.taxAmount, next.taxAmount)) {
    changes.push(`Totals: ${formatInvoiceMoney(prev.total, prev.currency)} → ${formatInvoiceMoney(next.total, next.currency)} (VAT ${prev.taxAmount} → ${next.taxAmount})`);
  }

  if (itemsSummary(prev.items) !== itemsSummary(next.items)) {
    changes.push(`Line items: ${itemsSummary(prev.items)} → ${itemsSummary(next.items)}`);
  }

  if (adjustmentsSummary(prev.adjustments || []) !== adjustmentsSummary(next.adjustments || [])) {
    changes.push(`Adjustments: ${adjustmentsSummary(prev.adjustments || [])} → ${adjustmentsSummary(next.adjustments || [])}`);
  }

  const prevReceipts = prev.receipts || [];
  const nextReceipts = next.receipts || [];
  if (receiptsSummary(prevReceipts) !== receiptsSummary(nextReceipts)) {
    changes.push(`Payments: ${receiptsSummary(prevReceipts)} → ${receiptsSummary(nextReceipts)}`);
  }

  if (changes.length === 0) {
    return `Updated invoice ${next.number} (no field changes detected)`;
  }

  return `Updated invoice ${next.number}: ${changes.join(' | ')}`;
}
