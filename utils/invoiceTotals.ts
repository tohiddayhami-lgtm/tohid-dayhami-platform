import { Invoice } from '../types';

export const invoiceAdjustmentsSum = (inv: Invoice): number =>
  (inv.adjustments || []).reduce((acc, a) => acc + (a.amount || 0), 0);

/** Line items + adjustments − legacy discount (before VAT split). */
export const invoiceGrossBase = (inv: Invoice): number =>
  inv.subTotal + invoiceAdjustmentsSum(inv) - (inv.discount || 0);

/** Net amount excluding VAT — after discounts/charges, before VAT line. */
export const invoiceNetExclVat = (inv: Invoice): number => {
  const gross = invoiceGrossBase(inv);
  const rate = inv.taxRate || 0;
  if (inv.vatInclusive && rate > 0) {
    return gross / (1 + rate / 100);
  }
  return gross;
};

export const computeInvoiceTotals = (
  inv: Invoice,
): Pick<Invoice, 'subTotal' | 'taxAmount' | 'total'> => {
  const subTotal = inv.items.reduce((acc, it) => acc + (it.total || 0), 0);
  const gross = subTotal + invoiceAdjustmentsSum(inv) - (inv.discount || 0);
  const rate = inv.taxRate || 0;

  if (inv.vatInclusive) {
    const net = rate > 0 ? gross / (1 + rate / 100) : gross;
    return { subTotal, taxAmount: gross - net, total: gross };
  }

  const taxAmount = (gross * rate) / 100;
  return { subTotal, taxAmount, total: gross + taxAmount };
};
