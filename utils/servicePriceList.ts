import type { Currency, Price, ServiceOption, SubService } from '../types';

export const ALL_CURRENCIES: Currency[] = ['IRR', 'OMR', 'USD', 'EUR', 'AED', 'AUD'];

export const CUR_LABEL: Record<Currency, { fa: string; en: string }> = {
  IRR: { fa: 'ریال', en: 'IRR' },
  OMR: { fa: 'ریال عمان', en: 'OMR' },
  USD: { fa: 'دلار', en: 'USD' },
  EUR: { fa: 'یورو', en: 'EUR' },
  AED: { fa: 'درهم', en: 'AED' },
  AUD: { fa: 'دلار استرالیا', en: 'AUD' },
};

export const resolvePrices = (single?: Price, multi?: Price[]): Price[] => {
  const list = (multi?.length ? multi : single ? [single] : [])
    .filter(p => p && (p.amount > 0 || p.currency));
  const seen = new Set<Currency>();
  return list.filter(p => {
    if (seen.has(p.currency)) return false;
    seen.add(p.currency);
    return p.amount > 0;
  });
};

export const servicePrices = (s: ServiceOption) => resolvePrices(s.price, s.prices);
export const subPrices = (s: SubService) => resolvePrices(s.price, s.prices);

export const collectUsedCurrencies = (services: ServiceOption[]): Currency[] => {
  const set = new Set<Currency>();
  services.forEach(s => {
    servicePrices(s).forEach(p => set.add(p.currency));
    (s.subServices || []).forEach(sub => subPrices(sub).forEach(p => set.add(p.currency)));
  });
  return ALL_CURRENCIES.filter(c => set.has(c));
};

export const formatPriceAmount = (amount: number, currency: Currency, lang: 'fa' | 'en') => {
  const n = amount.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
  const label = CUR_LABEL[currency][lang === 'fa' ? 'fa' : 'en'];
  return `${n} ${label}`;
};

export const normalizePrices = (prices: Price[]): { prices: Price[]; price?: Price } => {
  const cleaned = prices.filter(p => p.amount > 0);
  return { prices: cleaned, price: cleaned[0] };
};

export const exportPriceListCSV = (
  services: ServiceOption[],
  lang: 'fa' | 'en',
  filename: string,
) => {
  const T = lang === 'fa';
  const headers = T
    ? ['ردیف', 'خدمت', 'زیرخدمت', 'مبلغ', 'ارز', 'وضعیت']
    : ['#', 'Service', 'Sub-service', 'Amount', 'Currency', 'Status'];
  const escape = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
  const rows: string[][] = [];
  let i = 0;
  services.forEach(s => {
    const title = lang === 'en' && s.titleEn ? s.titleEn : s.title;
    const sp = servicePrices(s);
    if (sp.length) {
      sp.forEach(p => {
        i += 1;
        rows.push([String(i), title, '', String(p.amount), p.currency, s.isActive ? (T ? 'فعال' : 'Active') : (T ? 'غیرفعال' : 'Inactive')]);
      });
    } else {
      i += 1;
      rows.push([String(i), title, '', '', '', s.isActive ? (T ? 'فعال' : 'Active') : (T ? 'غیرفعال' : 'Inactive')]);
    }
    (s.subServices || []).forEach(sub => {
      const st = lang === 'en' && sub.titleEn ? sub.titleEn : sub.title;
      const subP = subPrices(sub);
      if (subP.length) {
        subP.forEach(p => {
          i += 1;
          rows.push([String(i), title, st, String(p.amount), p.currency, '']);
        });
      } else {
        i += 1;
        rows.push([String(i), title, st, '', '', '']);
      }
    });
  });
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const openPrintablePriceList = (
  services: ServiceOption[],
  opts: { lang: 'fa' | 'en'; companyTitle: string; companySubtitle?: string; activeOnly?: boolean },
) => {
  const { lang, companyTitle, companySubtitle, activeOnly = true } = opts;
  const T = lang === 'fa';
  const list = services.filter(s => !activeOnly || s.isActive);
  const currencies = collectUsedCurrencies(list);
  const dateStr = new Date().toLocaleDateString(T ? 'fa-IR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const dir = T ? 'rtl' : 'ltr';
  const font = "Vazirmatn, Tahoma, Arial, sans-serif";

  const priceCell = (prices: Price[]) => {
    if (!prices.length) return '<span class="muted">—</span>';
    return prices.map(p => `<div class="price-line"><strong>${formatPriceAmount(p.amount, p.currency, lang)}</strong></div>`).join('');
  };

  const rows = list.map((s, idx) => {
    const title = T ? s.title : (s.titleEn || s.title);
    const desc = T ? s.description : (s.descriptionEn || s.description);
    const subs = s.subServices || [];
    const mainRow = `
      <tr class="service-row">
        <td class="num">${idx + 1}</td>
        <td class="svc">
          <div class="svc-title">${s.icon || '✨'} ${title}</div>
          ${desc ? `<div class="svc-desc">${desc}</div>` : ''}
        </td>
        ${currencies.map(c => `<td class="price">${priceCell(servicePrices(s).filter(p => p.currency === c))}</td>`).join('')}
      </tr>`;
    const subRows = subs.map(sub => {
      const st = T ? sub.title : (sub.titleEn || sub.title);
      return `
      <tr class="sub-row">
        <td></td>
        <td class="svc sub"><span class="dot">◦</span> ${st}</td>
        ${currencies.map(c => `<td class="price">${priceCell(subPrices(sub).filter(p => p.currency === c))}</td>`).join('')}
      </tr>`;
    }).join('');
    return mainRow + subRows;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>${T ? 'لیست قیمت خدمات' : 'Service price list'} — ${companyTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px 32px; font-family: ${font}; color: #0f172a; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 22px; padding-bottom: 16px; border-bottom: 3px solid #312e81; }
  .brand h1 { margin: 0; font-size: 22px; font-weight: 800; color: #1e1b4b; }
  .brand p { margin: 6px 0 0; font-size: 12px; color: #64748b; }
  .meta { text-align: ${T ? 'left' : 'right'}; font-size: 11px; color: #64748b; }
  .meta strong { display: block; font-size: 13px; color: #334155; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: linear-gradient(180deg, #eef2ff, #e0e7ff); color: #312e81; font-weight: 800; padding: 10px 8px; border: 1px solid #c7d2fe; text-align: center; }
  thead th.svc-h { text-align: ${T ? 'right' : 'left'}; min-width: 220px; }
  tbody td { border: 1px solid #e2e8f0; padding: 9px 8px; vertical-align: top; }
  tbody tr:nth-child(even):not(.sub-row) { background: #f8fafc; }
  .num { width: 36px; text-align: center; font-weight: 700; color: #6366f1; }
  .svc-title { font-weight: 700; color: #1e293b; font-size: 13px; }
  .svc-desc { font-size: 10px; color: #64748b; margin-top: 3px; line-height: 1.5; }
  .sub { padding-${T ? 'right' : 'left'}: 18px !important; color: #475569; font-size: 11px; }
  .dot { color: #818cf8; }
  .price { text-align: center; min-width: 88px; }
  .price-line { line-height: 1.45; }
  .muted { color: #cbd5e1; }
  .footer { margin-top: 18px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #94a3b8; text-align: center; }
  @media print {
    body { padding: 12mm; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>${companyTitle}</h1>
      ${companySubtitle ? `<p>${companySubtitle}</p>` : ''}
      <p>${T ? 'لیست قیمت خدمات — مخصوص پرسنل' : 'Service price list — staff reference'}</p>
    </div>
    <div class="meta">
      <strong>${T ? 'تاریخ صدور' : 'Issue date'}</strong>
      ${dateStr}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th class="svc-h">${T ? 'خدمت' : 'Service'}</th>
        ${currencies.map(c => `<th>${CUR_LABEL[c][T ? 'fa' : 'en']}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="${2 + currencies.length}" style="text-align:center;color:#94a3b8;padding:24px">${T ? 'قیمتی ثبت نشده' : 'No prices listed'}</td></tr>`}</tbody>
  </table>
  <div class="footer">${T ? 'این لیست صرفاً جهت اطلاع پرسنل است. قیمت‌ها ممکن است بدون اطلاع قبلی تغییر کند.' : 'For internal staff reference only. Prices may change without notice.'}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 400);</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { alert(T ? 'پاپ‌آپ مسدود است. لطفاً اجازه باز شدن پنجره جدید را بدهید.' : 'Popup blocked. Please allow popups.'); return; }
  w.document.write(html);
  w.document.close();
};
