import type { AppConfig, InternalMessage, Invoice, Personnel } from '../types';
import { sendInternalMessage, saveNotificationLog } from '../services/firebaseService';
import {
  buildLog,
  DEFAULT_INVOICE_FOLLOWUP_TEMPLATE,
  renderTemplate,
  sendMasterCopy,
  sendWhatsAppNotification,
} from '../services/notificationService';
import { formatInvoiceMoney, getInvoiceAmountDecimals } from './invoiceMoney';
import { invoiceAmountPaid, invoiceBalanceDue } from './invoicePayments';
import { isInvoiceCancelled } from './invoiceCancel';

const money = (inv: Invoice, amount: number) =>
  formatInvoiceMoney(amount, inv.currency || 'OMR', getInvoiceAmountDecimals(inv));

const dash = (v?: string) => (v && String(v).trim() ? String(v).trim() : '—');

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
  const cancelled = isInvoiceCancelled(invoice);
  const paid = invoiceAmountPaid(invoice);
  const balance = invoiceBalanceDue(invoice);
  const totalLabel = money(invoice, invoice.total || 0);
  const paidLabel = money(invoice, paid);
  const balanceLabel = money(invoice, balance);
  const subTotalLabel = money(invoice, invoice.subTotal || 0);
  const taxLabel = money(invoice, invoice.taxAmount || 0);

  const subject = fa
    ? `پیگیری فاکتور ${invoice.number} — ${invoice.customerName || '—'}`
    : `Invoice follow-up ${invoice.number} — ${invoice.customerName || '—'}`;

  const bodyLines = [
    fa ? 'یک فاکتور برای پیگیری به شما ارجاع شد.' : 'An invoice has been assigned to you for follow-up.',
    '',
    '────────────────────',
    `${fa ? '🧾 شماره فاکتور' : '🧾 Invoice No.'}: ${invoice.number}`,
    `${fa ? '👤 مشتری' : '👤 Customer'}: ${dash(invoice.customerName)}`,
    ...(invoice.companyName ? [`${fa ? '🏢 شرکت' : '🏢 Company'}: ${invoice.companyName}`] : []),
    `${fa ? '📞 تماس' : '📞 Phone'}: ${dash(invoice.customerPhone)}`,
    ...(invoice.customerEmail ? [`${fa ? '✉️ ایمیل' : '✉️ Email'}: ${invoice.customerEmail}`] : []),
    ...(invoice.customerAddress ? [`${fa ? '📍 آدرس' : '📍 Address'}: ${invoice.customerAddress}`] : []),
    '',
    `${fa ? '💰 جمع اقلام' : '💰 Subtotal'}: ${subTotalLabel}`,
    ...(invoice.taxAmount ? [`${fa ? '🧾 مالیات' : '🧾 VAT'}: ${taxLabel}`] : []),
    `${fa ? '💵 مبلغ کل' : '💵 Total'}: ${totalLabel}`,
    `${fa ? '✅ پرداخت‌شده' : '✅ Paid'}: ${paidLabel}`,
    `${fa ? '📌 مانده' : '📌 Balance due'}: ${cancelled ? (fa ? '— (کنسل)' : '— (cancelled)') : balanceLabel}`,
    '',
    `${fa ? '📅 تاریخ فاکتور' : '📅 Invoice date'}: ${dash(invoice.date)}`,
    ...(invoice.dueDate ? [`${fa ? '⏰ سررسید' : '⏰ Due date'}: ${invoice.dueDate}`] : []),
    `${fa ? '👨‍💼 ارجاع از' : '👨‍💼 Referred by'}: ${assigner.fullName}`,
    '────────────────────',
  ];
  if (note?.trim()) {
    bodyLines.push('', fa ? '📝 یادداشت پیگیری:' : '📝 Follow-up note:', note.trim());
  }
  bodyLines.push('', fa ? '📂 بخش: فاکتورها → آرشیو فاکتورها' : '📂 Section: Invoices → Invoice Archive');

  if (assignee.id !== assigner.id) {
    const msg: InternalMessage = {
      id: `notify-inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderId: assigner.id,
      senderName: fa ? 'سیستم — پیگیری فاکتور' : 'System — Invoice follow-up',
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
    customerName: dash(invoice.customerName),
    customerPhone: dash(invoice.customerPhone),
    invoiceTotal: totalLabel,
    amountPaid: paidLabel,
    balanceDue: cancelled ? (fa ? 'کنسل' : 'Cancelled') : balanceLabel,
    invoiceDate: dash(invoice.date),
    dueDate: dash(invoice.dueDate),
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
