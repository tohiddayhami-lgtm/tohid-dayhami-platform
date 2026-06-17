import { Invoice, InvoiceReceipt } from '../types';

export const invoiceAmountPaid = (inv: Invoice): number =>
  (inv.receipts || []).reduce((sum, r) => sum + (r.amount || 0), 0);

export const invoiceBalanceDue = (inv: Invoice): number =>
  Math.max(0, (inv.total || 0) - invoiceAmountPaid(inv));

export const invoicePaymentStatus = (inv: Invoice): 'unpaid' | 'partial' | 'paid' => {
  const paid = invoiceAmountPaid(inv);
  const total = inv.total || 0;
  if (total <= 0 || paid <= 0) return 'unpaid';
  if (paid >= total - 0.0001) return 'paid';
  return 'partial';
};

export const withInvoicePaymentMeta = (inv: Invoice): Invoice => {
  const paid = invoiceAmountPaid(inv);
  const balance = invoiceBalanceDue(inv);
  let status = inv.status || 'draft';
  if ((inv.total || 0) > 0 && paid >= inv.total - 0.0001) status = 'paid';
  else if (paid > 0 && status === 'draft') status = 'issued';
  return { ...inv, amountPaid: paid, balanceDue: balance, status };
};

export const addInvoiceReceipt = (
  inv: Invoice,
  input: { amount: number; date: string; method?: string; reference?: string; note?: string },
  recordedBy: string,
): Invoice => {
  const receipt: InvoiceReceipt = {
    id: `rcpt-${Date.now()}`,
    amount: input.amount,
    date: input.date,
    method: input.method?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    note: input.note?.trim() || undefined,
    recordedBy,
    recordedAt: new Date().toISOString(),
  };
  return withInvoicePaymentMeta({ ...inv, receipts: [...(inv.receipts || []), receipt] });
};

export const removeInvoiceReceipt = (inv: Invoice, receiptId: string): Invoice =>
  withInvoicePaymentMeta({ ...inv, receipts: (inv.receipts || []).filter(r => r.id !== receiptId) });
