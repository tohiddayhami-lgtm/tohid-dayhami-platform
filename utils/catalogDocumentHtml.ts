import type { CatalogCompany, CompanyCatalog } from '../types';
import { band, esc, renderBody, type ProposalDocMode } from './proposalDocumentHtml';

const EN_FONT = 'Calibri, Arial, sans-serif';
const RTL_FONT = 'Tahoma, Arial, sans-serif';
const NAVY = '#0b1f3a';

const companyBlock = (co: CatalogCompany) => {
  const en: string[] = [];
  en.push(`<p dir="ltr" style="margin:0 0 2pt 0;font-family:${EN_FONT};font-size:11pt;font-weight:bold;color:#0f172a;text-align:left;">${esc(co.companyEn || '—')}</p>`);
  if (co.regNo) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(co.regNo)}</p>`);
  if (co.country) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(co.country)}</p>`);
  if (co.repNameEn) en.push(`<p dir="ltr" style="margin:4pt 0 0 0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(co.repNameEn)}${co.repTitleEn ? ` — ${esc(co.repTitleEn)}` : ''}</p>`);
  const contact = [co.contactEmail, co.contactPhone, co.website].filter(Boolean).join(' · ');
  if (contact) en.push(`<p dir="ltr" style="margin:3pt 0 0 0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(contact)}</p>`);

  const fa: string[] = [];
  if (co.companyRtl) fa.push(`<p dir="rtl" style="margin:0 0 2pt 0;font-family:${RTL_FONT};font-size:10.5pt;font-weight:bold;color:#0f172a;text-align:right;">${esc(co.companyRtl)}</p>`);
  if (co.repNameRtl) fa.push(`<p dir="rtl" style="margin:4pt 0 0 0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">${esc(co.repNameRtl)}${co.repTitleRtl ? ` — ${esc(co.repTitleRtl)}` : ''}</p>`);

  return `<div style="border:1pt solid #cbd5e1;background:#f8fafc;padding:10pt 12pt;margin:0 0 10pt;">
    ${en.join('')}
    ${fa.length ? `<div style="border-top:1pt solid #e2e8f0;margin-top:8pt;padding-top:6pt;">${fa.join('')}</div>` : ''}
  </div>`;
};

const bulletList = (items: string[], rtl: boolean) => {
  if (!items.length) return '';
  const font = rtl ? RTL_FONT : EN_FONT;
  const dir = rtl ? 'rtl' : 'ltr';
  return items.map(item => {
    const t = esc(item);
    if (rtl) {
      return `<p dir="rtl" lang="fa" style="margin:0 0 4pt 0;font-family:${font};font-size:10pt;line-height:1.75;color:#0f172a;text-align:right;margin-right:12pt;text-indent:-12pt;">• ${t}</p>`;
    }
    return `<p dir="ltr" style="margin:0 0 4pt 0;font-family:${font};font-size:10pt;line-height:1.55;color:#0f172a;text-align:left;margin-left:12pt;text-indent:-12pt;">• ${t}</p>`;
  }).join('');
};

export function buildCatalogDocumentHtml(c: CompanyCatalog, mode: ProposalDocMode = 'word'): string {
  const logoRow = (c.logoUrl || c.logo2Url)
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:10pt;width:100%;">
        <tr>
          <td align="${c.logo2Url ? 'left' : 'center'}" style="padding:0;">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" height="52" alt="logo"/>` : '&nbsp;'}</td>
          ${c.logo2Url ? `<td align="right" style="padding:0;"><img src="${esc(c.logo2Url)}" height="52" alt="logo2"/></td>` : ''}
        </tr>
      </table>`
    : '';

  const langLabel = c.languages.join(' / ').toUpperCase();

  const areasHtml = c.areas.map(area => {
    const services = area.services.map(svc => `
      <div style="border:1pt solid #e2e8f0;border-radius:6pt;padding:8pt 10pt;margin:0 0 8pt;background:#fff;page-break-inside:avoid;">
        <p dir="ltr" style="margin:0 0 2pt 0;font-family:${EN_FONT};font-size:8.5pt;font-weight:800;color:${NAVY};letter-spacing:.04em;">${esc(svc.serviceNum)}</p>
        <p dir="ltr" style="margin:0 0 4pt 0;font-family:${EN_FONT};font-size:10.5pt;font-weight:bold;color:#0f172a;">${esc(svc.titleEn)}</p>
        ${svc.titleRtl ? `<p dir="rtl" lang="fa" style="margin:0 0 6pt 0;font-family:${RTL_FONT};font-size:10pt;font-weight:bold;color:#0f172a;text-align:right;">${esc(svc.titleRtl)}</p>` : ''}
        ${svc.descEn ? renderBody(svc.descEn, false, mode) : ''}
        ${svc.descRtl ? renderBody(svc.descRtl, true, mode) : ''}
        ${svc.forEn ? `<p dir="ltr" style="margin:6pt 0 0 0;font-family:${EN_FONT};font-size:8.5pt;color:#64748b;font-style:italic;"><b>Ideal for:</b> ${esc(svc.forEn)}</p>` : ''}
        ${svc.forRtl ? `<p dir="rtl" lang="fa" style="margin:2pt 0 0 0;font-family:${RTL_FONT};font-size:8.5pt;color:#64748b;font-style:italic;text-align:right;"><b>مناسب برای:</b> ${esc(svc.forRtl)}</p>` : ''}
      </div>`).join('');

    return `
      ${band(`${area.areaNum}. ${area.areaTitleEn}`, area.areaTitleRtl)}
      ${area.areaIntroEn ? `<p dir="ltr" style="margin:6pt 0 8pt 0;font-family:${EN_FONT};font-size:9.5pt;color:#334155;font-style:italic;">${esc(area.areaIntroEn)}</p>` : ''}
      ${area.areaIntroRtl ? `<p dir="rtl" lang="fa" style="margin:0 0 8pt 0;font-family:${RTL_FONT};font-size:9.5pt;color:#334155;font-style:italic;text-align:right;">${esc(area.areaIntroRtl)}</p>` : ''}
      ${services}`;
  }).join('');

  const contactLines = [
    c.contact.email ? `Email: ${c.contact.email}` : '',
    c.contact.phone ? `Phone: ${c.contact.phone}` : '',
    c.contact.website ? `Web: ${c.contact.website}` : '',
    c.contact.location ? c.contact.location : '',
  ].filter(Boolean).join(' · ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(c.refNo)}</title>
<style>
  @page { size: A4; margin: 1.8cm 1.6cm; }
  body { margin:0; padding:0; color:#0f172a; font-family:${EN_FONT}; font-size:10pt; }
  p { margin:0; }
  table { border-collapse:collapse; }
</style>
</head>
<body>
${logoRow}
<div style="text-align:center;margin:0 0 8pt 0;">
  <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:14pt;font-weight:bold;color:${NAVY};text-transform:uppercase;text-align:center;">${esc(c.titleEn)}</p>
  ${c.titleRtl ? `<p dir="rtl" lang="fa" style="margin:4pt 0 0 0;font-family:${RTL_FONT};font-size:12.5pt;font-weight:bold;color:${NAVY};text-align:center;">${esc(c.titleRtl)}</p>` : ''}
  ${c.subtitleEn ? `<p dir="ltr" style="margin:8pt 0 0 0;font-family:${EN_FONT};font-size:10pt;color:#334155;text-align:center;">${esc(c.subtitleEn)}</p>` : ''}
  ${c.subtitleRtl ? `<p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:10pt;color:#334155;text-align:center;">${esc(c.subtitleRtl)}</p>` : ''}
</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin:8pt 0 4pt 0;">
  <tr>
    <td align="center" style="background:${NAVY};color:#ffffff;font-family:${EN_FONT};font-size:9pt;font-weight:bold;padding:6pt 8pt;">
      Ref. ${esc(c.refNo)} &nbsp;|&nbsp; Date: ${esc(c.catalogDate)} &nbsp;|&nbsp; Languages: ${esc(langLabel)}
    </td>
  </tr>
</table>
${band(c.company.labelEn, c.company.labelRtl)}
${companyBlock(c.company)}
${band(c.intro.titleEn || c.intro.sectionNum, c.intro.titleRtl)}
${c.intro.contentEn ? renderBody(c.intro.contentEn, false, mode) : ''}
${c.intro.contentRtl ? renderBody(c.intro.contentRtl, true, mode) : ''}
${areasHtml}
${band(c.howWeWork.titleEn || c.howWeWork.sectionNum, c.howWeWork.titleRtl)}
<div style="margin:6pt 0 10pt;">${bulletList(c.howWeWork.pointsEn, false)}</div>
<div style="margin:0 0 10pt;padding:8pt 10pt;background:#f8fafc;border:1pt solid #e2e8f0;">${bulletList(c.howWeWork.pointsRtl, true)}</div>
${band(c.contact.titleEn || c.contact.sectionNum, c.contact.titleRtl)}
${c.contact.contentEn ? renderBody(c.contact.contentEn, false, mode) : ''}
${c.contact.contentRtl ? renderBody(c.contact.contentRtl, true, mode) : ''}
${contactLines ? `<p dir="ltr" style="margin:8pt 0 0 0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;color:${NAVY};text-align:center;">${esc(contactLines)}</p>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-top:14pt;border-top:2pt solid ${NAVY};">
  <tr>
    <td align="center" style="padding-top:8pt;">
      <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;color:${NAVY};text-align:center;">${esc(c.companyName || 'Services Catalog')}</p>
      <p dir="ltr" style="margin:4pt 0 0 0;font-family:${EN_FONT};font-size:8.5pt;color:#64748b;text-align:center;">This document is a services catalog for reference. Pricing and scope are confirmed in proposals and contracts.</p>
      <p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:8.5pt;color:#64748b;text-align:center;line-height:1.7;">این سند کاتالوگ خدمات برای مرجع است. قیمت و دامنه در پروپوزال و قرارداد تأیید می‌شود.</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}
