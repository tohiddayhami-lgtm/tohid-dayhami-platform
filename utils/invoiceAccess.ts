import { Invoice, Personnel } from '../types';

export const isInvoiceMasterOrAdmin = (user: Personnel): boolean =>
  user.username === 'master' || (user.roles || []).includes('مدیر');

/** View every invoice in the archive (master, admin, or explicit permission). */
export const canViewAllInvoices = (user: Personnel): boolean =>
  isInvoiceMasterOrAdmin(user) || user.permissions?.canViewAllInvoices === true;

/** Access the Invoices module at all. */
export const canAccessInvoices = (user: Personnel): boolean =>
  isInvoiceMasterOrAdmin(user)
  || user.permissions?.canIssueInvoices === true
  || user.permissions?.canViewAllInvoices === true;

/** Create new invoices and edit own (or all for master/admin). */
export const canIssueInvoices = (user: Personnel): boolean =>
  isInvoiceMasterOrAdmin(user) || user.permissions?.canIssueInvoices === true;

export const isInvoiceOwnedBy = (user: Personnel, invoice: Invoice): boolean => {
  if (invoice.issuedByPersonnelId && invoice.issuedByPersonnelId === user.id) return true;
  const name = (invoice.issuedBy || '').trim();
  if (!name) return false;
  return name === user.fullName || name === user.username;
};

export const canEditInvoice = (user: Personnel, invoice: Invoice): boolean => {
  if (isInvoiceMasterOrAdmin(user)) return true;
  if (!user.permissions?.canIssueInvoices) return false;
  return isInvoiceOwnedBy(user, invoice);
};

export const canDeleteInvoice = (user: Personnel, invoice: Invoice): boolean =>
  canEditInvoice(user, invoice);

export const filterInvoicesForUser = (invoices: Invoice[], user: Personnel): Invoice[] => {
  if (canViewAllInvoices(user)) return invoices;
  return invoices.filter(inv => isInvoiceOwnedBy(user, inv));
};
