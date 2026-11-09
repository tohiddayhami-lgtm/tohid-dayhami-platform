import { CustomForm, Ticket } from '../types';

export type FormAnswerRow = { label: string; value: string };

export function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(String(s || '').trim());
}

export function isImageUrl(s: string): boolean {
  const v = String(s || '').trim();
  if (!v) return false;
  if (/^data:image\//i.test(v)) return true;
  if (!isHttpUrl(v)) return false;
  if (/\.(pdf|zip|docx?|xlsx?|mp4|mov|webm)(\?|#|$)/i.test(v)) return false;
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|avif)(\?|#|$)/i.test(v)) return true;
  if (/firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(v)) return true;
  if (/\/api\/ms-img\?/i.test(v)) return true;
  if (/[?&]alt=media\b/i.test(v)) return true;
  return false;
}

export function displayImageSrc(url: string): string {
  const v = String(url || '').trim();
  if (!isHttpUrl(v)) return v;
  if (/firebasestorage\.googleapis\.com|firebasestorage\.app/i.test(v)) {
    return `/api/ms-img?u=${encodeURIComponent(v)}`;
  }
  return v;
}

const META_KEYS = /^(formId|formTitle|importSource|requestId|customerName|customerPhone|whatsappNotified|__assigneePersonnelId|__assigneeRole|__answersJson|__photosJson|sheetName|sheetUrl)$/i;

export function isFormTicket(ticket: Ticket | null | undefined): boolean {
  if (!ticket) return false;
  const src = ticket.customData?.importSource || '';
  if (src === 'html_form' || src === 'google_sheet' || src === 'csv' || src === 'website_api') return true;
  return (ticket.serviceId || '').startsWith('form:');
}

function coerceRows(raw: unknown): FormAnswerRow[] {
  if (!raw) return [];
  let v: unknown = raw;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith('[') || s.startsWith('{')) {
      try { v = JSON.parse(s); } catch { return []; }
    } else return [];
  }
  const list = Array.isArray(v) ? v : [];
  const out: FormAnswerRow[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item) continue;
    if (typeof item === 'string') continue;
    const rec = item as Record<string, unknown>;
    const label = String(rec.label || rec.name || rec.key || rec.q || '').replace(/\s+/g, ' ').trim();
    const value = String(rec.value || rec.a || rec.answer || '').trim();
    if (!label || !value || META_KEYS.test(label)) continue;
    if (value === '{}' || value === '[]') continue;
    const sig = `${label}::${value}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ label: label.slice(0, 200), value: value.slice(0, 8000) });
  }
  return out;
}

function rowsFromCustomData(cd: Record<string, string> | undefined): FormAnswerRow[] {
  if (!cd) return [];
  const out: FormAnswerRow[] = [];
  for (const [k, v] of Object.entries(cd)) {
    if (META_KEYS.test(k) || k.startsWith('__')) continue;
    const value = String(v || '').trim();
    if (!value || value === '{}' || value === '[]') continue;
    out.push({ label: k, value: value.slice(0, 8000) });
  }
  return out;
}

function rowsFromDescription(description: string | undefined): FormAnswerRow[] {
  const text = String(description || '').trim();
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out: FormAnswerRow[] = [];
  const skip = /^(موضوع|شناسه(?:\s*درخواست)?|مشخصات متقاضی|پاسخ‌های فرم|سوالات و پاسخ‌ها|فرم)\s*:?/i;
  for (const line of lines) {
    if (skip.test(line) && !line.includes(':')) continue;
    const cleaned = line.replace(/^\d+\.\s+/, '');
    const m = cleaned.match(/^([^:]{2,160}):\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim();
    const value = m[2].trim();
    if (!label || !value || skip.test(label)) continue;
    if (/^شناسه/.test(label) || /^موضوع$/.test(label) || /^فرم$/.test(label)) continue;
    out.push({ label, value });
  }
  return out;
}

function rowsFromFormFields(ticket: Ticket, form?: CustomForm | null): FormAnswerRow[] {
  const fields = form?.fields;
  if (!fields?.length) return [];
  const cd = ticket.customData || {};
  const out: FormAnswerRow[] = [];
  for (const f of fields) {
    if (f.type === 'header') continue;
    const val = cd[f.key || f.id] || '';
    if (!val) continue;
    out.push({ label: f.label || f.key || f.id, value: val });
  }
  return out;
}

export function parseTicketFormAnswers(ticket: Ticket, form?: CustomForm | null): FormAnswerRow[] {
  let rows: FormAnswerRow[] = coerceRows(ticket.customData?.__answersJson);
  if (!rows.length) rows = rowsFromFormFields(ticket, form);
  if (!rows.length) {
    const fromDesc = rowsFromDescription(ticket.description);
    if (fromDesc.length >= 2) rows = fromDesc;
  }
  if (!rows.length) rows = rowsFromCustomData(ticket.customData);

  const seen = new Set(rows.map(r => r.value));
  for (const f of ticket.files || []) {
    const url = String(f.content || '').trim();
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);
    rows.push({ label: f.name || 'فایل پیوست', value: url });
  }
  return rows;
}

export function ticketPhotoRows(ticket: Ticket, form?: CustomForm | null): FormAnswerRow[] {
  const out: FormAnswerRow[] = [];
  const seen = new Set<string>();
  const add = (label: string, value: string) => {
    const v = String(value || '').trim();
    if (!v || seen.has(v) || META_KEYS.test(label)) return;
    if (!isImageUrl(v) && !(isHttpUrl(v) && /عکس|تصویر|پیوست|ضمیمه|photo|image|pic|file/i.test(label))) return;
    if (/\.(pdf|zip|docx?|xlsx?)(\?|#|$)/i.test(v)) return;
    seen.add(v);
    out.push({ label: label || 'عکس پیوست', value: v });
  };
  try {
    const extra = JSON.parse(ticket.customData?.__photosJson || '[]');
    if (Array.isArray(extra)) {
      extra.forEach((item) => {
        if (typeof item === 'string') add('عکس پیوست', item);
        else if (item && typeof item === 'object') add(String((item as FormAnswerRow).label || 'عکس پیوست'), String((item as FormAnswerRow).value || ''));
      });
    }
  } catch { /* ignore */ }
  for (const f of ticket.files || []) add(f.name || 'فایل پیوست', String(f.content || ''));
  for (const row of parseTicketFormAnswers(ticket, form)) add(row.label, row.value);
  for (const [k, v] of Object.entries(ticket.customData || {})) {
    if (META_KEYS.test(k) || k.startsWith('__')) continue;
    add(k, String(v || ''));
  }
  return out;
}

export function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
