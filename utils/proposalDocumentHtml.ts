import type { CommercialProposal, ProposalParty } from '../types';

/**
 * Shared bilingual proposal HTML for Word (.doc) and print/PDF.
 * Rules:
 * - Never nest double-quotes inside style="..."
 * - EN: dir=ltr, left/justify, Calibri
 * - FA/AR: dir=rtl, right/justify, Tahoma
 * - Tables only (Word-safe)
 */

const NAVY = '#0b1f3a';
const EN_FONT = "Calibri, Arial, sans-serif";
const RTL_FONT = "Tahoma, Arial, sans-serif";

const esc = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nl2br = (s: string) => esc(s).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>');

const band = (en: string, rtl: string) => `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:12pt;width:100%;">
  <tr>
    <td width="50%" dir="ltr" align="left" style="width:50%;background:${NAVY};color:#ffffff;font-family:${EN_FONT};font-size:10pt;font-weight:bold;padding:6pt 9pt;text-transform:uppercase;">${esc(en)}</td>
    <td width="50%" dir="rtl" align="right" style="width:50%;background:${NAVY};color:#ffffff;font-family:${RTL_FONT};font-size:10pt;font-weight:bold;padding:6pt 9pt;">${esc(rtl)}</td>
  </tr>
</table>`;

const partyCell = (party: ProposalParty, index: number) => {
  const en: string[] = [];
  en.push(`<p dir="ltr" style="margin:0 0 2pt 0;font-family:${EN_FONT};font-size:9pt;font-weight:bold;color:${NAVY};text-align:left;">${index + 1}. ${esc(party.labelEn)}:</p>`);
  en.push(`<p dir="ltr" style="margin:0 0 2pt 0;font-family:${EN_FONT};font-size:11pt;font-weight:bold;color:#0f172a;text-align:left;">${esc(party.companyEn || '—')}</p>`);
  if (party.regNo) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">Reg. No.: ${esc(party.regNo)}</p>`);
  if (party.country) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">Country: ${esc(party.country)}</p>`);
  if (party.repNameEn) en.push(`<p dir="ltr" style="margin:4pt 0 0 0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">Contact: ${esc(party.repNameEn)}</p>`);
  if (party.repTitleEn) en.push(`<p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(party.repTitleEn)}</p>`);
  const contact = [party.contactEmail, party.contactPhone].filter(Boolean).join(' · ');
  if (contact) en.push(`<p dir="ltr" style="margin:3pt 0 0 0;font-family:${EN_FONT};font-size:9pt;color:#334155;text-align:left;">${esc(contact)}</p>`);

  const fa: string[] = [];
  if (party.labelRtl) fa.push(`<p dir="rtl" style="margin:0 0 2pt 0;font-family:${RTL_FONT};font-size:9pt;font-weight:bold;color:${NAVY};text-align:right;">${index + 1}. ${esc(party.labelRtl)}</p>`);
  if (party.companyRtl) fa.push(`<p dir="rtl" style="margin:0 0 2pt 0;font-family:${RTL_FONT};font-size:10.5pt;font-weight:bold;color:#0f172a;text-align:right;">${esc(party.companyRtl)}</p>`);
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

export type ProposalDocMode = 'word' | 'pdf';

/** Build full HTML document. `mode=pdf` avoids justify (breaks Arabic in canvas). */
export function buildProposalDocumentHtml(p: CommercialProposal, mode: ProposalDocMode = 'word'): string {
  // Word supports justify with real text. PDF/html2canvas justify letter-spaces Arabic and disconnects glyphs.
  const enAlign = mode === 'word' ? 'justify' : 'left';
  const rtlAlign = mode === 'word' ? 'justify' : 'right';

  const logoRow = (p.logoUrl || p.logo2Url)
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:10pt;width:100%;">
        <tr>
          <td align="${p.logo2Url ? 'left' : 'center'}" style="padding:0;">${p.logoUrl ? `<img src="${esc(p.logoUrl)}" height="52" alt="logo"/>` : '&nbsp;'}</td>
          ${p.logo2Url ? `<td align="right" style="padding:0;"><img src="${esc(p.logo2Url)}" height="52" alt="logo2"/></td>` : ''}
        </tr>
      </table>`
    : '';

  const sections = p.sections.map(sec => `
    ${band(sec.titleEn || sec.sectionNum, sec.titleRtl || '')}
    ${sec.contentEn ? `<p dir="ltr" style="margin:8pt 0 6pt 0;font-family:${EN_FONT};font-size:10pt;line-height:1.55;text-align:${enAlign};color:#0f172a;">${nl2br(sec.contentEn)}</p>` : ''}
    ${sec.contentRtl ? `<p dir="rtl" lang="fa" style="margin:0 0 10pt 0;font-family:${RTL_FONT};font-size:10pt;line-height:1.9;text-align:${rtlAlign};color:#0f172a;background:#f8fafc;border:1pt solid #e2e8f0;padding:8pt 10pt;">${nl2br(sec.contentRtl)}</p>` : ''}
  `).join('');

  const priceRows = p.lineItems.map(li => `
    <tr${li.selected ? ' style="background:#ecfdf5;"' : ''}>
      <td style="border:1pt solid #cbd5e1;padding:6pt 7pt;vertical-align:top;">
        <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;text-align:left;">${esc(li.itemEn)}</p>
        ${li.itemRtl ? `<p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">${esc(li.itemRtl)}</p>` : ''}
        ${li.notes ? `<p dir="ltr" style="margin:3pt 0 0 0;font-family:${EN_FONT};font-size:8pt;color:#64748b;font-style:italic;text-align:left;">${esc(li.notes)}</p>` : ''}
      </td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;">${esc(li.qty)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;">${esc(li.unitPrice)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;">${esc(li.total)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;color:#047857;font-weight:bold;">${li.selected ? '✓' : ''}</td>
    </tr>`).join('');

  const priceTable = p.lineItems.length
    ? `${band('PRICING OPTIONS', 'گزینه‌های قیمت‌گذاری')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-bottom:10pt;">
        <tr>
          <td width="46%" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt 7pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">PACKAGE / بسته</td>
          <td align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">QTY</td>
          <td align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">UNIT (${esc(p.currency)})</td>
          <td align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">TOTAL (${esc(p.currency)})</td>
          <td width="36" align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">SEL.</td>
        </tr>
        ${priceRows}
      </table>`
    : '';

  const realAddOns = p.addOns.filter(ao => (ao.nameEn || ao.nameRtl || '').trim());
  const addOnTable = realAddOns.length
    ? `${band('OPTIONAL ADD-ONS', 'افزودنی‌های اختیاری')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-bottom:10pt;">
        <tr>
          <td style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt 7pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">ADD-ON</td>
          <td width="110" align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">PRICE (${esc(p.currency)})</td>
          <td width="36" align="center" style="background:${NAVY};color:#ffffff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">SEL.</td>
        </tr>
        ${realAddOns.map(ao => `
        <tr${ao.selected ? ' style="background:#ecfdf5;"' : ''}>
          <td style="border:1pt solid #cbd5e1;padding:6pt 7pt;vertical-align:top;">
            <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;text-align:left;">${esc(ao.nameEn)}</p>
            ${ao.nameRtl ? `<p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;">${esc(ao.nameRtl)}</p>` : ''}
          </td>
          <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-size:9.5pt;">${esc(ao.price)}</td>
          <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;color:#047857;font-weight:bold;">${ao.selected ? '✓' : ''}</td>
        </tr>`).join('')}
      </table>`
    : '';

  const parties = p.parties.length
    ? `${band('PARTIES', 'طرفین')}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
        <tr>
          ${p.parties[0] ? partyCell(p.parties[0], 0) : '<td width="50%">&nbsp;</td>'}
          ${p.parties[1] ? partyCell(p.parties[1], 1) : '<td width="50%">&nbsp;</td>'}
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
<title>${esc(p.refNo)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page { size: A4; margin: 1.8cm 1.6cm; }
  body {
    margin: 0;
    padding: 0;
    color: #0f172a;
    font-family: ${EN_FONT};
    font-size: 10pt;
  }
  p { margin: 0; }
  table { border-collapse: collapse; }
</style>
</head>
<body>
${logoRow}
<div style="text-align:center;margin:0 0 8pt 0;">
  <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:14pt;font-weight:bold;color:${NAVY};text-transform:uppercase;text-align:center;">${esc(p.titleEn)}</p>
  ${p.titleRtl ? `<p dir="rtl" lang="fa" style="margin:4pt 0 0 0;font-family:${RTL_FONT};font-size:12.5pt;font-weight:bold;color:${NAVY};text-align:center;">${esc(p.titleRtl)}</p>` : ''}
  ${p.subtitleEn ? `<p dir="ltr" style="margin:8pt 0 0 0;font-family:${EN_FONT};font-size:10pt;color:#334155;text-align:center;">${esc(p.subtitleEn)}</p>` : ''}
  ${p.subtitleRtl ? `<p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:10pt;color:#334155;text-align:center;">${esc(p.subtitleRtl)}</p>` : ''}
</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin:8pt 0 4pt 0;">
  <tr>
    <td align="center" style="background:${NAVY};color:#ffffff;font-family:${EN_FONT};font-size:9pt;font-weight:bold;padding:6pt 8pt;">
      Ref. ${esc(p.refNo)} &nbsp;|&nbsp; Date: ${esc(p.proposalDate)} &nbsp;|&nbsp; Valid until: ${esc(p.validUntil)} &nbsp;|&nbsp; Currency: ${esc(p.currency)}
    </td>
  </tr>
</table>
${parties}
${sections}
${priceTable}
${addOnTable}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin-top:14pt;border-top:2pt solid ${NAVY};">
  <tr>
    <td align="center" style="padding-top:8pt;">
      <p dir="ltr" style="margin:0;font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;color:${NAVY};text-align:center;">${esc(p.companyName || 'Commercial Proposal')}</p>
      <p dir="ltr" style="margin:4pt 0 0 0;font-family:${EN_FONT};font-size:8.5pt;color:#64748b;text-align:center;">This document is a commercial proposal and becomes binding only upon signature of the corresponding service agreement.</p>
      <p dir="rtl" lang="fa" style="margin:3pt 0 0 0;font-family:${RTL_FONT};font-size:8.5pt;color:#64748b;text-align:center;line-height:1.7;">این سند پیشنهاد تجاری است و تنها پس از امضای قرارداد خدمات متناظر الزام‌آور می‌شود.</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}
