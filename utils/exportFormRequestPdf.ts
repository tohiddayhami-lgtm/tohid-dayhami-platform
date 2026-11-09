import { Ticket } from '../types';
import { exportPdfFromPreviewElement } from './exportPreviewPdf';
import { escapeHtml, FormAnswerRow } from './formRequestAnswers';
import { formatJalaliDateFa } from './persianDateTime';

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

export async function exportFormRequestPdf(opts: {
  ticket: Ticket;
  formTitle: string;
  answers: FormAnswerRow[];
  filename?: string;
}): Promise<void> {
  const { ticket, formTitle, answers } = opts;
  const dateFa = ticket.createdAt ? formatJalaliDateFa(ticket.createdAt, true) : '';
  const qa = answers.map((row, i) => {
    const valHtml = isUrl(row.value)
      ? `<a href="${escapeHtml(row.value)}" style="color:#1d4ed8;word-break:break-all">${escapeHtml(row.value)}</a>`
      : escapeHtml(row.value).replace(/\n/g, '<br/>');
    return `<section class="qa">
      <div class="q"><span class="n">${i + 1}</span>${escapeHtml(row.label)}</div>
      <div class="a">${valHtml}</div>
    </section>`;
  }).join('');

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-240vw;top:0;opacity:0.01;pointer-events:none;z-index:-1';
  host.innerHTML = `<div class="pp-root" dir="rtl" lang="fa" style="width:794px;box-sizing:border-box;background:#fff;color:#0f172a;font-family:Tahoma,'Segoe UI',Arial,sans-serif">
    <style>
      .pp-root { padding: 28px 32px; }
      .hdr { border-bottom: 2px solid #0f766e; padding-bottom: 14px; margin-bottom: 16px; }
      .hdr h1 { margin: 0 0 6px; font-size: 20px; font-weight: 800; color: #0f172a; }
      .meta { font-size: 12px; color: #475569; line-height: 1.8; }
      .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px; line-height: 1.9; }
      .qa { margin: 0 0 12px; break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
      .q { background: #ecfdf5; color: #134e4a; font-size: 13px; font-weight: 700; padding: 9px 12px; display: flex; gap: 8px; align-items: flex-start; }
      .n { display:inline-flex; min-width: 22px; height: 22px; border-radius: 999px; background:#0f766e; color:#fff; font-size:11px; align-items:center; justify-content:center; margin-top:1px; }
      .a { padding: 10px 12px 12px; font-size: 13px; line-height: 1.85; white-space: pre-wrap; word-break: break-word; }
      .foot { margin-top: 18px; font-size: 11px; color: #64748b; }
    </style>
    <div class="hdr">
      <h1>${escapeHtml(formTitle || 'درخواست فرم')}</h1>
      <div class="meta">شناسه درخواست: ${escapeHtml(ticket.id)}${dateFa ? ` · ${escapeHtml(dateFa)}` : ''}</div>
    </div>
    <div class="box">
      <div>نام: <b>${escapeHtml(ticket.customerName || '—')}</b></div>
      <div>موبایل: <b dir="ltr">${escapeHtml(ticket.phoneNumber || '—')}</b></div>
      ${ticket.companyName ? `<div>شرکت: <b>${escapeHtml(ticket.companyName)}</b></div>` : ''}
      ${ticket.location && ticket.location !== '-' ? `<div>موقعیت: <b>${escapeHtml(ticket.location)}</b></div>` : ''}
    </div>
    ${qa || '<p>پاسخی ثبت نشده است.</p>'}
    <div class="foot">خروجی درخواست مشتری از پلتفرم توحید دیهمی</div>
  </div>`;
  document.body.appendChild(host);
  try {
    const root = host.querySelector('.pp-root') as HTMLElement;
    const safeId = ticket.id.replace(/[^\w.-]+/g, '_').slice(0, 40);
    await exportPdfFromPreviewElement(root, opts.filename || `request-${safeId}.pdf`);
  } finally {
    host.remove();
  }
}
