/** Preset currencies shown in the invoice editor dropdown. */
export const INVOICE_PRESET_CURRENCIES = ['AED', 'USD', 'AUD', 'EUR', 'IRR', 'OMR'] as const;
export type InvoicePresetCurrency = (typeof INVOICE_PRESET_CURRENCIES)[number];

export const INVOICE_CURRENCY_CUSTOM = '__custom__';

export const MAX_INVOICE_DECIMALS = 3;

export const isPresetInvoiceCurrency = (code: string): code is InvoicePresetCurrency =>
  (INVOICE_PRESET_CURRENCIES as readonly string[]).includes(code);

/** Format amount with up to 3 decimals; trailing zeros are omitted (optional decimals). */
export function formatInvoiceAmount(n: number, maxDecimals = MAX_INVOICE_DECIMALS): string {
  if (n == null || Number.isNaN(n)) return '0';
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(n * factor) / factor;
  const fixed = rounded.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, '') || '0';
}

/** Parse user input — keeps at most 3 decimal places. */
export function parseInvoiceAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return 0;
  const factor = 10 ** MAX_INVOICE_DECIMALS;
  return Math.round(n * factor) / factor;
}

export function formatInvoiceMoney(amount: number, currency: string): string {
  const code = (currency || 'OMR').trim() || 'OMR';
  return `${code} ${formatInvoiceAmount(amount)}`;
}
