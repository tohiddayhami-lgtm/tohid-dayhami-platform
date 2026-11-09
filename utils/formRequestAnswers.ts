import { CustomForm, Ticket } from '../types';

export type FormAnswerRow = { label: string; value: string };

const META_KEYS = /^(formId|formTitle|importSource|requestId|customerName|customerPhone|whatsappNotified|__assigneePersonnelId|__assigneeRole|__answersJson|sheetName|sheetUrl)$/i;

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
  const fromJson = coerceRows(ticket.customData?.__answersJson);
  if (fromJson.length) return fromJson;
  const fromFields = rowsFromFormFields(ticket, form);
  if (fromFields.length) return fromFields;
  const fromDesc = rowsFromDescription(ticket.description);
  if (fromDesc.length >= 2) return fromDesc;
  return rowsFromCustomData(ticket.customData);
}

export function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
