import { CartableSheetSource, Ticket, TicketStatus } from '../types';

export type SheetColumnField =
  | 'customerName'
  | 'phoneNumber'
  | 'companyName'
  | 'location'
  | 'businessType'
  | 'description'
  | 'skip';

export const SHEET_COLUMN_FIELDS: { key: SheetColumnField; fa: string; en: string }[] = [
  { key: 'skip', fa: '— نادیده —', en: '— Skip —' },
  { key: 'customerName', fa: 'نام / متقاضی', en: 'Name / applicant' },
  { key: 'phoneNumber', fa: 'شماره تماس', en: 'Phone' },
  { key: 'companyName', fa: 'شرکت', en: 'Company' },
  { key: 'location', fa: 'موقعیت / شهر', en: 'Location' },
  { key: 'businessType', fa: 'نوع کسب‌وکار', en: 'Business type' },
  { key: 'description', fa: 'توضیحات', en: 'Description' },
];

const HEADER_HINTS: Record<Exclude<SheetColumnField, 'skip'>, RegExp[]> = {
  customerName: [/نام/, /name/i, /متقاضی/, /customer/i, /مشتری/],
  phoneNumber: [/phone/i, /mobile/i, /tel/i, /شماره/, /موبایل/, /تماس/, /واتس/, /whatsapp/i],
  companyName: [/company/i, /شرکت/, /سازمان/, /organization/i, /firm/i],
  location: [/location/i, /city/i, /شهر/, /کشور/, /country/i, /آدرس/, /address/i, /موقعیت/],
  businessType: [/business/i, /نوع/, /صنعت/, /industry/i, /حوزه/],
  description: [/desc/i, /توضیح/, /note/i, /یادداشت/, /comment/i, /جزئیات/, /detail/i, /موضوع/, /subject/i],
};

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
}

export interface SheetImportOptions {
  mode: 'individual' | 'aggregated';
  serviceId: string;
  assigneeIds: string[];
  sourceName: string;
  sheetUrl?: string;
  columnMap: Record<string, SheetColumnField>;
  importerName: string;
  priority?: 'Low' | 'Medium' | 'High';
  aggregatedTitle?: string;
}

/** Parse a Google Sheets share/edit URL into spreadsheet id + gid. */
export function parseGoogleSheetUrl(url: string): { spreadsheetId: string; gid: string } | null {
  const trimmed = url.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = trimmed.match(/[#&?]gid=(\d+)/);
  return { spreadsheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
}

export function buildSheetCsvExportUrl(spreadsheetId: string, gid = '0'): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/** Fetch sheet CSV via serverless proxy (works when Google is blocked). */
export async function fetchGoogleSheetCsv(sheetUrl: string): Promise<string> {
  const parsed = parseGoogleSheetUrl(sheetUrl);
  if (!parsed) throw new Error('invalid_sheet_url');
  const exportUrl = buildSheetCsvExportUrl(parsed.spreadsheetId, parsed.gid);
  const res = await fetch(`/api/sheets?url=${encodeURIComponent(exportUrl)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `fetch_failed_${res.status}`);
  }
  return res.text();
}

/** RFC-style CSV parser (handles quoted fields with commas). */
export function parseCsvText(text: string): ParsedSheet {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(cell.trim()); cell = ''; continue; }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell.trim());
      if (row.some(c => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r') i++;
      continue;
    }
    if (ch !== '\r') cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c.length > 0)) rows.push(row);
  }

  if (rows.length < 1) return { headers: [], rows: [] };
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  const dataRows = rows.slice(1).filter(r => r.some(c => c.trim().length > 0));
  return { headers, rows: dataRows };
}

export function autoDetectColumnMap(headers: string[]): Record<string, SheetColumnField> {
  const map: Record<string, SheetColumnField> = {};
  const used = new Set<SheetColumnField>();

  for (const header of headers) {
    const h = header.trim();
    if (!h) { map[h] = 'skip'; continue; }
    let best: SheetColumnField = 'skip';
    for (const [field, patterns] of Object.entries(HEADER_HINTS) as [Exclude<SheetColumnField, 'skip'>, RegExp[]][]) {
      if (used.has(field)) continue;
      if (patterns.some(p => p.test(h))) { best = field; break; }
    }
    if (best !== 'skip') used.add(best);
    else {
      // Unmapped columns become part of description when building tickets
      best = 'description';
    }
    map[h] = best;
  }
  return map;
}

export function columnMapFromSource(source: CartableSheetSource, headers: string[]): Record<string, SheetColumnField> {
  const auto = autoDetectColumnMap(headers);
  if (!source.columnMap) return auto;
  const map = { ...auto };
  for (const [field, header] of Object.entries(source.columnMap)) {
    if (headers.includes(header) && field !== 'skip') {
      map[header] = field as SheetColumnField;
    }
  }
  return map;
}

function pickRandom<T>(items: T[]): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function generateSheetTicketId(seq?: number): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const suffix = seq != null ? String(seq + 1).padStart(3, '0') : String(Math.floor(Math.random() * 999)).padStart(3, '0');
  return `SHR-${rand}-${suffix}`;
}

function getFieldValue(row: string[], headers: string[], columnMap: Record<string, SheetColumnField>, field: SheetColumnField): string {
  for (let i = 0; i < headers.length; i++) {
    if (columnMap[headers[i]] === field) return (row[i] || '').trim();
  }
  return '';
}

function buildRowDescription(row: string[], headers: string[], columnMap: Record<string, SheetColumnField>): string {
  const parts: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const v = (row[i] || '').trim();
    if (!v || columnMap[h] === 'skip') continue;
    parts.push(`${h}: ${v}`);
  }
  return parts.join('\n');
}

function buildTicketBase(
  opts: SheetImportOptions,
  assigneeId: string | undefined,
  assigneeName: string,
  index?: number,
): Partial<Ticket> {
  const now = new Date().toISOString();
  const id = generateSheetTicketId(index);
  const timeline = [
    {
      type: 'creation' as const,
      title: 'ورود از گوگل‌شیت',
      description: `درخواست از منبع «${opts.sourceName}» توسط ${opts.importerName} ثبت شد.`,
      timestamp: now,
      actorName: opts.importerName,
      visibility: 'internal' as const,
    },
    ...(assigneeId ? [{
      type: 'assignment' as const,
      title: 'ارجاع به پرسنل',
      description: assigneeId
        ? `پرونده به ${assigneeName} ارجاع داده شد${opts.assigneeIds.length > 1 ? ' (انتخاب تصادفی از لیست پرسنل)' : ''}.`
        : 'بدون ارجاع',
      timestamp: now,
      actorName: opts.importerName,
      visibility: 'internal' as const,
    }] : []),
  ];
  return {
    id,
    serviceId: opts.serviceId,
    status: TicketStatus.SUBMITTED,
    createdAt: now,
    priority: opts.priority || 'Medium',
    assignedTo: assigneeId,
    timeline,
    customData: {
      importSource: 'google_sheet',
      sheetName: opts.sourceName,
      ...(opts.sheetUrl ? { sheetUrl: opts.sheetUrl } : {}),
    },
  };
}

export function buildTicketsFromSheet(
  parsed: ParsedSheet,
  opts: SheetImportOptions,
  personnelNames: Record<string, string>,
): Ticket[] {
  const { headers, rows } = parsed;
  if (!headers.length || !rows.length) return [];

  const tickets: Ticket[] = [];

  if (opts.mode === 'aggregated') {
    const assigneeId = pickRandom(opts.assigneeIds);
    const assigneeName = assigneeId ? (personnelNames[assigneeId] || 'کارشناس') : '—';
    const base = buildTicketBase(opts, assigneeId, assigneeName);

    const lines = rows.map((row, idx) => {
      const name = getFieldValue(row, headers, opts.columnMap, 'customerName') || `ردیف ${idx + 1}`;
      const phone = getFieldValue(row, headers, opts.columnMap, 'phoneNumber');
      const detail = buildRowDescription(row, headers, opts.columnMap);
      return `▸ ${name}${phone ? ` (${phone})` : ''}\n${detail}`;
    });

    const firstRow = rows[0];
    const title = opts.aggregatedTitle?.trim()
      || getFieldValue(firstRow, headers, opts.columnMap, 'customerName')
      || opts.sourceName;

    tickets.push({
      ...(base as Ticket),
      customerName: title,
      companyName: getFieldValue(firstRow, headers, opts.columnMap, 'companyName') || undefined,
      location: getFieldValue(firstRow, headers, opts.columnMap, 'location') || '-',
      phoneNumber: getFieldValue(firstRow, headers, opts.columnMap, 'phoneNumber') || '-',
      whatsappNumber: getFieldValue(firstRow, headers, opts.columnMap, 'phoneNumber') || '-',
      businessType: getFieldValue(firstRow, headers, opts.columnMap, 'businessType') || undefined,
      description: `درخواست تجمیعی از گوگل‌شیت «${opts.sourceName}» — ${rows.length} مورد:\n\n${lines.join('\n\n')}`,
      customData: {
        ...base.customData,
        importMode: 'aggregated',
        rowCount: String(rows.length),
      },
    });
    return tickets;
  }

  rows.forEach((row, idx) => {
    const assigneeId = pickRandom(opts.assigneeIds);
    const assigneeName = assigneeId ? (personnelNames[assigneeId] || 'کارشناس') : '—';
    const base = buildTicketBase(opts, assigneeId, assigneeName, idx);
    const customerName = getFieldValue(row, headers, opts.columnMap, 'customerName') || `${opts.sourceName} — ردیف ${idx + 1}`;
    const phone = getFieldValue(row, headers, opts.columnMap, 'phoneNumber') || '-';

    tickets.push({
      ...(base as Ticket),
      customerName,
      companyName: getFieldValue(row, headers, opts.columnMap, 'companyName') || undefined,
      location: getFieldValue(row, headers, opts.columnMap, 'location') || '-',
      phoneNumber: phone,
      whatsappNumber: phone,
      businessType: getFieldValue(row, headers, opts.columnMap, 'businessType') || undefined,
      description: getFieldValue(row, headers, opts.columnMap, 'description') || buildRowDescription(row, headers, opts.columnMap) || '—',
      customData: {
        ...base.customData,
        importMode: 'individual',
        sheetRow: String(idx + 2),
      },
    });
  });

  return tickets;
}

export function sheetSourceToColumnMap(source: CartableSheetSource): Record<string, string> | undefined {
  return source.columnMap;
}
