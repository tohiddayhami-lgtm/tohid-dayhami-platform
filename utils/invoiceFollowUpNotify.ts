import type { AppConfig, InternalMessage, Invoice, Personnel } from '../types';
import { sendInternalMessage, saveNotificationLog } from '../services/firebaseService';
import {
  buildLog,
  DEFAULT_INVOICE_FOLLOWUP_TEMPLATE,
  renderTemplate,
  sendMasterCopy,
  sendWhatsAppNotification,
} from '../services/notificationService';
import { formatInvoiceMoney } from './invoiceMoney';
import { invoiceBalanceDue } from './invoicePayments';

export async function notifyInvoiceFollowUp(opts: {
  invoice: Invoice;
  assignee: Personnel;
  assigner: Personnel;
  note?: string;
  config: AppConfig;
  personnel: Personnel[];
  lang: 'fa' | 'en';
}): Promise<void> {
  const { invoice, assignee, assigner, note, config, personnel, lang } = opts;
  const fa = lang === 'fa';
  const cur = invoice.currency || 'OMR';
  const balance = invoiceBalanceDue(invoice);
  const totalLabel = formatInvoiceMoney(invoice.total, cur, invoice);
  const balanceLabel = formatInvoiceMoney(balance, cur, invoice);

  const subject = fa
    ? `پیگیری فاکتور ${invoice.number} — ${invoice.customerName || '—'}`
    : `Invoice follow-up ${invoice.number} — ${invoice.customerName || '—'}`;

  const bodyLines = [
    fa ? 'یک فاکتور برای پیگیری به شما ارجاع شد.' : 'An invoice has been assigned to you for follow-up.',
    '',
    `${fa ? 'شماره' : 'No.'}: ${invoice.number}`,
    `${fa ? 'مشتری' : 'Customer'}: ${invoice.customerName || '—'}`,
    `${fa ? 'مبلغ' : 'Total'}: ${totalLabel}`,
    `${fa ? 'مانده' : 'Balance due'}: ${balanceLabel}`,
    `${fa ? 'ارجاع از' : 'Referred by'}: ${assigner.fullName}`,
  ];
  if (note?.trim()) {
    bodyLines.push('', fa ? 'یادداشت:' : 'Note:', note.trim());
  }
  bodyLines.push('', fa ? 'بخش: فاکتورها → آرشیو فاکتورها' : 'Section: Invoices → Invoice Archive');

  if (assignee.id !== assigner.id) {
    const msg: InternalMessage = {
      id: `notify-inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: assigner.id,
      senderName: fa ? 'سیستم — فاکتور' : 'System — Invoice',
      recipientIds: [assignee.id],
      recipientNames: [assignee.fullName],
      subject,
      body: bodyLines.join('\n'),
      createdAt: new Date().toISOString(),
      readBy: [],
    };
    await sendInternalMessage(msg);
  }

  const nc = config.notificationConfig;
  const notifyEnabled = nc?.enabled && (nc.onInvoiceFollowUp ?? nc.onNewTicket);
  if (!notifyEnabled || assignee.id === assigner.id) return;

  const followUpNote = note?.trim()
    ? (fa ? `📝 ${note.trim()}` : `Note: ${note.trim()}`)
    : '';

  const waMsg = renderTemplate(nc?.invoiceFollowUpTemplate || DEFAULT_INVOICE_FOLLOWUP_TEMPLATE, {
    recipientName: assignee.fullName,
    invoiceNumber: invoice.number,
    customerName: invoice.customerName || '',
    invoiceTotal: totalLabel,
    balanceDue: balanceLabel,
    followUpNote,
    senderName: assigner.fullName,
    ticketId: invoice.number,
    status: '',
  });

  const phone = nc.personnelPhones?.[assignee.id];
  if (phone) {
    const result = await sendWhatsAppNotification(phone, waMsg, nc, nc.personnelApiKeys?.[assignee.id]);
    await saveNotificationLog(buildLog('invoice_followup', assignee.id, assignee.fullName, phone, waMsg, result, invoice.number));
  }

  await sendMasterCopy({
    config: nc,
    personnel,
    message: waMsg,
    originalRecipientId: assignee.id,
    originalRecipientName: assignee.fullName,
    logType: 'invoice_followup',
    ticketId: invoice.number,
    saveLog: saveNotificationLog,
  });
}
