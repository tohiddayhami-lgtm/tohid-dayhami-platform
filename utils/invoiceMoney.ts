/** Preset currencies shown in the invoice editor dropdown. */
export const INVOICE_PRESET_CURRENCIES = ['AED', 'USD', 'AUD', 'EUR', 'IRR', 'OMR'] as const;
export type InvoicePresetCurrency = (typeof INVOICE_PRESET_CURRENCIES)[number];

export const INVOICE_CURRENCY_CUSTOM = '__custom__';

export const MAX_INVOICE_DECIMALS = 3;

export type InvoiceAmountDecimals = 0 | 1 | 2 | 3;

export const resolveInvoiceDecimals = (value?: number): InvoiceAmountDecimals => {
  if (value === 0 || value === 1 || value === 2 || value === 3) return value;
  return MAX_INVOICE_DECIMALS;
};

export const isPresetInvoiceCurrency = (code: string): code is InvoicePresetCurrency =>
  (INVOICE_PRESET_CURRENCIES as readonly string[]).includes(code);

/** Format integer part with thousand separators. */
const formatIntegerPart = (intPart: string): string => {
  if (!intPart) return '0';
  const normalized = intPart.replace(/^0+(?=\d)/, '') || '0';
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** Format amount with up to 3 decimals; trailing zeros omitted; includes , separators. */
export function formatInvoiceAmount(n: number, maxDecimals = MAX_INVOICE_DECIMALS): string {
  if (n == null || Number.isNaN(n)) return '0';
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(n * factor) / factor;
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const fixed = abs.toFixed(maxDecimals);
  const [intPart, decPart = ''] = fixed.split('.');
  const intFormatted = formatIntegerPart(intPart);
  const decTrimmed = decPart.replace(/0+$/, '');
  const body = decTrimmed ? `${intFormatted}.${decTrimmed}` : intFormatted;
  return negative ? `-${body}` : body;
}

/** Live typing formatter — keeps commas while user edits (e.g. 1,250,000.5). */
export function formatInvoiceAmountTyping(
  raw: string,
  allowNegative = false,
  maxDecimals = MAX_INVOICE_DECIMALS,
): string {
  let cleaned = raw.replace(/,/g, '');
  if (allowNegative) {
    const negative = cleaned.startsWith('-');
    cleaned = cleaned.replace(/-/g, '').replace(/[^\d.]/g, '');
    if (!cleaned) return negative ? '-' : '';
    const formatted = formatTypingCore(cleaned, maxDecimals);
    return negative ? `-${formatted}` : formatted;
  }
  cleaned = cleaned.replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  return formatTypingCore(cleaned, maxDecimals);
}

const formatTypingCore = (cleaned: string, maxDecimals: number): string => {
  if (maxDecimals <= 0) {
    const intRaw = cleaned.replace(/\./g, '');
    return intRaw ? formatIntegerPart(intRaw) : '';
  }
  const dotIndex = cleaned.indexOf('.');
  const intRaw = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned;
  const decRaw = dotIndex >= 0 ? cleaned.slice(dotIndex + 1).slice(0, maxDecimals) : '';
  const intFormatted = intRaw ? formatIntegerPart(intRaw) : '0';
  if (dotIndex >= 0) {
    if (cleaned.endsWith('.')) return `${intFormatted}.`;
    return decRaw ? `${intFormatted}.${decRaw}` : intFormatted;
  }
  return intFormatted;
};

/** Parse user input — strips commas; rounds to configured decimal places. */
export function parseInvoiceAmount(raw: string, maxDecimals = MAX_INVOICE_DECIMALS): number {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return 0;
  const factor = 10 ** maxDecimals;
  return Math.round(n * factor) / factor;
}

export function formatInvoiceMoney(
  amount: number,
  currency: string,
  maxDecimals = MAX_INVOICE_DECIMALS,
): string {
  const code = (currency || 'OMR').trim() || 'OMR';
  return `${code} ${formatInvoiceAmount(amount, maxDecimals)}`;
}
