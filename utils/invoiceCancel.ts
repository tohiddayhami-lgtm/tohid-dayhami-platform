import type { Invoice } from '../types';

export const isInvoiceCancelled = (inv: Invoice): boolean => inv.status === 'cancelled';

/** Active invoices included in revenue / collection stats. */
export const isInvoiceActiveForStats = (inv: Invoice): boolean => !isInvoiceCancelled(inv);
