
import { NotificationConfig, NotificationLog, Personnel } from '../types';

export const DEFAULT_TICKET_TEMPLATE =
  'سلام {recipientName} 👋\nیک درخواست جدید به کارتابل شما ارجاع داده شد.\n\n📋 کد رهگیری: {ticketId}\n👤 متقاضی: {customerName}\n\nبرای مشاهده وارد پنل کاربری شوید.';

export const DEFAULT_INVOICE_FOLLOWUP_TEMPLATE =
  'سلام {recipientName} 👋\nیک فاکتور برای پیگیری به شما ارجاع شد.\n\n🧾 شماره: {invoiceNumber}\n👤 مشتری: {customerName}\n📞 تماس: {customerPhone}\n💰 مبلغ کل: {invoiceTotal}\n✅ پرداخت‌شده: {amountPaid}\n📌 مانده: {balanceDue}\n📅 تاریخ: {invoiceDate}\n\n{followUpNote}\n\nبرای پیگیری وارد بخش فاکتورها شوید.';

export const DEFAULT_MESSAGE_TEMPLATE =
  'سلام {recipientName} 👋\nیک پیام داخلی از {senderName} دریافت کردید.\n\nبرای مشاهده وارد بخش مکاتبات پنل کاربری شوید.';

export const DEFAULT_STATUS_TEMPLATE =
  'سلام {recipientName} 👋\nوضعیت پرونده شما تغییر کرد.\n\n📋 کد رهگیری: {ticketId}\n📌 وضعیت جدید: {status}';

export const DEFAULT_MEETING_CREATED_TEMPLATE =
  'سلام {recipientName} 👋\n📅 یک جلسه جدید برای شما ثبت شد.\n\n📌 موضوع: {meetingTitle}\n📅 تاریخ: {meetingDate}\n🕐 ساعت: {meetingTime} تا {meetingEndTime}\n📍 مکان: {meetingLocation}\n👤 تنظیم‌کننده: {organizerName}\n\nلطفاً در تقویم خود ثبت کنید ✅';

export const DEFAULT_MEETING_UPDATED_TEMPLATE =
  'سلام {recipientName} 👋\n✏️ جلسه زیر تغییر کرده است:\n\n📌 موضوع: {meetingTitle}\n📅 تاریخ: {meetingDate}\n🕐 ساعت: {meetingTime} تا {meetingEndTime}\n📍 مکان: {meetingLocation}\n\n🔄 تغییرات:\n{changes}';

export const DEFAULT_MEETING_DELETED_TEMPLATE =
  'سلام {recipientName} 👋\n❌ جلسه زیر لغو شد:\n\n📌 موضوع: {meetingTitle}\n📅 تاریخ: {meetingDate}\n🕐 ساعت: {meetingTime}\n\nاین جلسه دیگر برگزار نمی‌شود.';

export const DEFAULT_MEETING_REMINDER_TEMPLATE =
  'سلام {recipientName} 👋\n⏰ یادآوری جلسه\n\n📌 موضوع: {meetingTitle}\n📅 تاریخ: {meetingDate}\n🕐 ساعت: {meetingTime}\n📍 مکان: {meetingLocation}\n\nیک ساعت دیگر شروع می‌شود ⏱';

export const DEFAULT_DAILY_SUMMARY_TEMPLATE =
  'سلام {recipientName} 👋\n📋 جلسات شما برای فردا ({tomorrowDate}):\n\n{meetingsList}\n\nموفق باشید! 🌟';

// Fill template variables: {recipientName}, {ticketId}, {customerName}, {senderName}, {status}, {formTitle}
export const renderTemplate = (template: string, vars: Record<string, string>): string => {
  const base = template || '';
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{${k}\\}`, 'g'), v || ''),
    base,
  );
};

// Normalize to international format (handles Iranian numbers starting with 09/989/+98)
const normalizePhone = (phone: string): string => {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('09'))  return `+98${d.slice(1)}`;
  if (d.startsWith('989')) return `+${d}`;
  if (d.startsWith('98'))  return `+${d}`;
  if (d.startsWith('00'))  return `+${d.slice(2)}`;
  return `+${d}`;
};

export const sendWhatsAppNotification = async (
  phone: string,
  message: string,
  config: NotificationConfig,
  callMeBotApiKey?: string,
): Promise<{ success: boolean; error?: string }> => {
  if (!config.enabled || !phone?.trim() || !message?.trim()) {
    return { success: false, error: 'disabled or missing data' };
  }

  const normalizedPhone = normalizePhone(phone);

  try {
    if (config.provider === 'callmebot') {
      if (!callMeBotApiKey) return { success: false, error: 'کلید CallMeBot برای این شخص تنظیم نشده' };
      const url =
        `https://api.callmebot.com/whatsapp.php` +
        `?phone=${encodeURIComponent(normalizedPhone)}` +
        `&text=${encodeURIComponent(message)}` +
        `&apikey=${encodeURIComponent(callMeBotApiKey)}`;
      // CallMeBot doesn't allow reading the response from browsers (CORS).
      // Using no-cors: the request IS sent and message is delivered,
      // but we can't read the response — treat as success if no network error.
      await fetch(url, { mode: 'no-cors' });

    } else if (config.provider === 'ultramsg') {
      if (!config.ultraMsgToken || !config.ultraMsgInstance) {
        return { success: false, error: 'UltraMsg پیکربندی نشده' };
      }
      const body = new URLSearchParams({
        token: config.ultraMsgToken,
        to: normalizedPhone,
        body: message,
      });
      const res = await fetch(
        `https://api.ultramsg.com/${config.ultraMsgInstance}/messages/chat`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

    } else if (config.provider === 'webhook') {
      if (!config.webhookUrl) return { success: false, error: 'آدرس Webhook تنظیم نشده' };
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, message }),
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'خطای ناشناخته' };
  }
};

/**
 * Sends a COPY of a just-sent notification to the configured "master" recipient
 * (config.masterRecipientId), if any. Additive — call it right after each primary
 * send so the master mirrors every WhatsApp notification the system sends.
 * No-ops when: no master is set, the master IS the original recipient, the master
 * has no phone, or (callmebot) the master has no API key.
 */
export const sendMasterCopy = async (opts: {
  config: NotificationConfig;
  personnel: Personnel[];
  message: string;
  originalRecipientId: string;
  originalRecipientName: string;
  logType: NotificationLog['type'];
  ticketId?: string;
  meetingId?: string;
  saveLog: (log: Omit<NotificationLog, 'id'>) => Promise<unknown> | void;
}): Promise<void> => {
  const { config, personnel, message, originalRecipientId, originalRecipientName, logType, ticketId, meetingId, saveLog } = opts;
  const masterId = config.masterRecipientId;
  if (!masterId || masterId === originalRecipientId) return;
  const phone = config.personnelPhones?.[masterId];
  if (!phone) return;
  const apiKey = config.personnelApiKeys?.[masterId];
  if (config.provider === 'callmebot' && !apiKey) return;

  const master = personnel.find(p => p.id === masterId);
  const masterMsg = `📋 رونوشت مدیریتی (Master)\n👤 گیرنده اصلی: ${originalRecipientName}\n────────────\n${message}`;
  const result = await sendWhatsAppNotification(phone, masterMsg, config, apiKey);
  await saveLog(buildLog(logType, masterId, master?.fullName || 'Master', phone, masterMsg, result, ticketId, meetingId));
};

// Build a notification log entry (without id)
export const buildLog = (
  type: NotificationLog['type'],
  recipientId: string,
  recipientName: string,
  phone: string,
  message: string,
  result: { success: boolean; error?: string },
  ticketId?: string,
  meetingId?: string,
): Omit<NotificationLog, 'id'> => ({
  type,
  recipientId,
  recipientName,
  phone,
  message,
  status: result.success ? 'sent' : 'failed',
  error: result.error,
  ticketId,
  meetingId,
  createdAt: new Date().toISOString(),
});
