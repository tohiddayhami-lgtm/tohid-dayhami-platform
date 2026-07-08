import type { ContractParty, LegalContract } from '../types';
import { band, esc, renderBody, type ProposalDocMode } from './proposalDocumentHtml';

const EN_FONT = 'Calibri, Arial, sans-serif';
const RTL_FONT = 'Tahoma, Arial, sans-serif';
const NAVY = '#0b1f3a';

const partyCell = (party: ContractParty, index: number) => {
  const en: string[] = [];
  en.push(`<p dir="ltr" style="margin:0 0 2pt 0;font-family:${EN_FONT};font-size:9pt;font-weight:bold;color:${NAVY};text-align:left;">${index + 1}. ${esc(party.labelEn)}:</p>`);
  en.push(`<p dir="ltr" style="margin:0 0 2pt 0;font-family:${EN_FONT};font-size:11pt;font-weight:bold;color:#0f172a;text-align:left;">${esc(party.companyEn || '—')}</p>`);
  if (party.aliasEn) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#64748b;font-style:italic;text-align:left;">(${esc(party.aliasEn)})</p>`);
  if (party.regNo) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">Reg. No.: ${esc(party.regNo)}</p>`);
  if (party.country) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">Country: ${esc(party.country)}</p>`);
  if (party.repNameEn) en.push(`<p dir="ltr" style="margin:4pt 0 0 0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">Contact: ${esc(party.repNameEn)}</p>`);
  if (party.repTitleEn) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(party.repTitleEn)}</p>`);
  const contact = [party.contactEmail, party.contactPhone].filter(Boolean).join(' · ');
  if (contact) en.push(`<p dir="ltr" style="margin:3pt 0 0 0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(contact)}</p>`);

  const fa: string[] = [];
  if (party.labelRtl) fa.push(`<p dir="rtl" style="margin:0 0 2pt 0;font-family:${RTL_FONT};font-size:9pt;font-weight:bold;color:${NAVY};text-align:right;">${index + 1}. ${esc(party.labelRtl)}</p>`);
  if (party.companyRtl) fa.push(`<p dir="rtl" style="margin:0 0 2pt 0;font-family:${RTL_FONT};font-size:10.5pt;font-weight:bold;color:#0f172a;text-align:right;">${esc(party.companyRtl)}</p>`);
  if (party.aliasRtl) fa.push(`<p dir="rtl" style="margin:0;font-family:${RTL_FONT};font-size:9pt;color:#64748b;font-style:italic;text-align:right;">(${esc(party.aliasRtl)})</p>`);
  if (party.regNo) fa.push(`<p dir="rtl" style="margin:0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">شماره ثبت: ${esc(party.regNo)}</p>`);
  if (party.country) fa.push(`<p dir="rtl" style="margin:0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">کشور: ${esc(party.country)}</p>`);
  if (party.repNameRtl) fa.push(`<p dir="rtl" style="margin:4pt 0 0 0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">تماس: ${esc(party.repNameRtl)}</p>`);
  if (party.repTitleRtl) fa.push(`<p dir="rtl" style="margin:0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">${esc(party.repTitleRtl)}</p>`);

  return `
<td width="50%" valign="top" style="width:50%;border:1pt solid #cbd5e1;background:#f8fafc;padding:9pt 10pt;">
  ${en.join('')}
  ${fa.length ? `<div style="border-top:1pt solid #e2e8f0;margin-top:8pt;padding-top:6pt;">${fa.join('')}</div>` : ''}
</td>`;
};

export function buildContractDocumentHtml(c: LegalContract, mode: ProposalDocMode = 'word'): string {
  const logoRow = (c.logoUrl || c.logo2Url)
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:10pt;width:100%;">
        <tr>
          <td align="${c.logo2Url ? 'left' : 'center'}" style="padding:0;">${c.logoUrl ? `<img src="${esc(c.logoUrl)}" height="52" alt="logo"/>` : '&nbsp;'}</td>
          ${c.logo2Url ? `<td align="right" style="padding:0;"><img src="${esc(c.logo2Url)}" height="52" alt="logo2"/></td>` : ''}
        </tr>
      </table>`
    : '';

  const clauses = c.clauses.map(cl => `
    ${band(cl.titleEn || cl.articleNum, cl.titleRtl || '')}
    ${cl.contentEn ? renderBody(cl.contentEn, false, mode) : ''}
    ${cl.contentRtl ? renderBody(cl.contentRtl, true, mode) : ''}
  `).join('');

  const scheduleRows = c.scheduleRows.map(sr => `
    <tr${sr.selected ? ' style="background:#ecfdf5;"' : ''}>
      <td style="border:1pt solid #cbd5e1;padding:6pt 7pt;vertical-align:top;">
        <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;text-align:left;">${esc(sr.tierEn)}</p>
        ${sr.tierRtl ? `<p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">${esc(sr.tierRtl)}</p>` : ''}
      </td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;">${esc(sr.buildFee)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;">${esc(sr.annualFee)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;">${esc(sr.interpretation)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;color:#047857;font-weight:bold;">${sr.selected ? '✓' : ''}</td>
    </tr>`).join('');

  const scheduleTable = c.scheduleRows.length
    ? `${band('SCHEDULE A — FEES', 'پیوست الف — حق‌الزحمه')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-bottom:10pt;">
        <tr>
          <td width="40%" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt 7pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">TIER / سطح</td>
          <td align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">BUILD (${esc(c.currency)})</td>
          <td align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">ANNUAL (${esc(c.currency)})</td>
          <td align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">INTERP. HRS</td>
          <td width="36" align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">SEL.</td>
        </tr>
        ${scheduleRows}
      </table>`
    : '';

  const realAddOns = c.addOns.filter(ao => (ao.nameEn || ao.nameRtl || '').trim());
  const addOnTable = realAddOns.length
    ? `${band('OPTIONAL ADD-ONS', 'افزودنی‌های اختیاری')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-bottom:10pt;">
        <tr>
          <td style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt 7pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">ADD-ON</td>
          <td width="110" align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">PRICE (${esc(c.currency)})</td>
          <td width="36" align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">SEL.</td>
        </tr>
        ${realAddOns.map(ao => `
        <tr${ao.selected ? ' style="background:#ecfdf5;"' : ''}>
          <td style="border:1pt solid #cbd5e1;padding:6pt 7pt;vertical-align:top;">
            <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;text-align:left;">${esc(ao.nameEn)}</p>
            ${ao.nameRtl ? `<p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">${esc(ao.nameRtl)}</p>` : ''}
            ${(ao.descEn || ao.descRtl) ? `<p dir="ltr" style="margin:3pt 0 0 0;font-family:${EN_FONT};font-size:8pt;color:#64748b;font-style:italic;text-align:left;">${esc([ao.descEn, ao.descRtl].filter(Boolean).join(' — '))}</p>` : ''}
          </td>
          <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;">${esc(ao.price)}</td>
          <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;color:#047857;font-weight:bold;">${ao.selected ? '✓' : ''}</td>
        </tr>`).join('')}
      </table>`
    : '';

  const parties = c.parties.length
    ? `${band('PARTIES', 'طرفین')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
        <tr>
          ${c.parties[0] ? partyCell(c.parties[0], 0) : '<td width="50%">&nbsp;</td>'}
          ${c.parties[1] ? partyCell(c.parties[1], 1) : '<td width="50%">&nbsp;</td>'}
        </tr>
      </table>`
    : '';

  const signatures = c.parties.length
    ? `${band('SIGNATURES', 'امضاها')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-bottom:10pt;">
        <tr>
          ${c.parties.map(party => `
          <td width="50%" valign="top" style="width:50%;padding:10pt 12pt 0 0;border-top:2pt solid ${NAVY};">
            <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;font-weight:bold;color:${NAVY};">${esc(party.labelEn)}</p>
            <p dir="rtl" lang="fa" style="margin:2pt 0 8pt 0;font-family:${RTL_FONT};font-size:9pt;font-weight:bold;color:${NAVY};text-align:right;">${esc(party.labelRtl)}</p>
            <p dir="ltr" style="margin:28pt 0 0 0;border-bottom:1pt solid #94a3b8;padding-bottom:4pt;font-family:${EN_FONT};font-size:9pt;color:#334155;">${esc(party.repNameEn || party.companyEn || '—')}</p>
            ${(party.repNameRtl || party.companyRtl) ? `<p dir="rtl" lang="fa" style="margin:2pt 0 0 0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">${esc(party.repNameRtl || party.companyRtl || '')}</p>` : ''}
          </td>`).join('')}
        </tr>
      </table>`
    : '';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<meta charset="utf-8"/>
<meta name="ProgId" content="Word.Document"/>
<meta name="Generator" content="Tohid Platform"/>
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
      Ref. ${esc(c.refNo)} &nbsp;|&nbsp; Effective: ${esc(c.effectiveDate)} &nbsp;|&nbsp; Currency: ${esc(c.currency)} &nbsp;|&nbsp; Status: ${esc(c.status)}
    </td>
  </tr>
</table>
${parties}
${clauses}
${scheduleTable}
${addOnTable}
${signatures}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-top:14pt;border-top:2pt solid ${NAVY};">
  <tr>
    <td align="center" style="padding-top:8pt;">
      <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;color:${NAVY};text-align:center;">${esc(c.companyName || 'Services Agreement')}</p>
      <p dir="ltr" style="margin:4pt 0 0 0;font-family:${EN_FONT};font-size:8.5pt;color:#64748b;text-align:center;">Executed in English and Persian. In case of discrepancy, the English version prevails.</p>
      <p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:8.5pt;color:#64748b;text-align:center;line-height:1.7;">این قرارداد به دو زبان انگلیسی و فارسی تنظیم شده است. در صورت تعارض، نسخه‌ی انگلیسی مالک است.</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}
