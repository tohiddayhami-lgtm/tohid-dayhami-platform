import type { CommercialProposal, ProposalParty } from '../types';

/**
 * Build a Word-compatible .doc file (HTML dialect Word opens natively).
 * Uses tables + inline styles only — Word ignores flex/grid.
 * Persian/Arabic stays real editable text with correct RTL.
 */

const NAVY = '#0b1f3a';
const RTL_FONT = 'Tahoma, Arial, sans-serif';
const EN_FONT = 'Calibri, "Segoe UI", Arial, sans-serif';

const esc = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const nl2br = (s: string) => esc(s).replace(/\n/g, '<br/>');

const band = (en: string, rtl: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14pt;">
    <tr>
      <td width="50%" style="background:${NAVY};color:#ffffff;font-family:${EN_FONT};font-size:10pt;font-weight:bold;padding:6pt 9pt;text-transform:uppercase;" dir="ltr" align="left">${esc(en)}</td>
      <td width="50%" style="background:${NAVY};color:#ffffff;font-family:${RTL_FONT};font-size:10pt;font-weight:bold;padding:6pt 9pt;" dir="rtl" align="right">${esc(rtl)}</td>
    </tr>
  </table>`;

const partyCell = (party: ProposalParty, index: number) => {
  const enRows: string[] = [];
  enRows.push(`<div style="font-weight:bold;color:${NAVY};font-size:9pt;">${index + 1}. ${esc(party.labelEn)}:</div>`);
  enRows.push(`<div style="font-weight:bold;font-size:11pt;margin-top:2pt;">${esc(party.companyEn || '—')}</div>`);
  if (party.regNo) enRows.push(`<div style="font-size:9pt;color:#334155;">Reg. No.: ${esc(party.regNo)}</div>`);
  if (party.country) enRows.push(`<div style="font-size:9pt;color:#334155;">Country: ${esc(party.country)}</div>`);
  if (party.repNameEn) enRows.push(`<div style="font-size:9pt;color:#334155;margin-top:4pt;">Contact: ${esc(party.repNameEn)}</div>`);
  if (party.repTitleEn) enRows.push(`<div style="font-size:9pt;color:#334155;">${esc(party.repTitleEn)}</div>`);
  const contact = [party.contactEmail, party.contactPhone].filter(Boolean).join(' · ');
  if (contact) enRows.push(`<div style="font-size:9pt;color:#334155;margin-top:3pt;">${esc(contact)}</div>`);

  const rtlRows: string[] = [];
  if (party.labelRtl) rtlRows.push(`<div style="font-weight:bold;color:${NAVY};font-size:9pt;">${index + 1}. ${esc(party.labelRtl)}</div>`);
  if (party.companyRtl) rtlRows.push(`<div style="font-weight:bold;font-size:10.5pt;margin-top:2pt;">${esc(party.companyRtl)}</div>`);
  if (party.regNo) rtlRows.push(`<div style="font-size:9pt;color:#334155;">شماره ثبت: ${esc(party.regNo)}</div>`);
  if (party.country) rtlRows.push(`<div style="font-size:9pt;color:#334155;">کشور: ${esc(party.country)}</div>`);
  if (party.repNameRtl) rtlRows.push(`<div style="font-size:9pt;color:#334155;margin-top:4pt;">تماس: ${esc(party.repNameRtl)}</div>`);
  if (party.repTitleRtl) rtlRows.push(`<div style="font-size:9pt;color:#334155;">${esc(party.repTitleRtl)}</div>`);

  return `
    <td width="50%" valign="top" style="border:1pt solid #cbd5e1;background:#f8fafc;padding:9pt 10pt;">
      <div dir="ltr" style="font-family:${EN_FONT};text-align:left;">${enRows.join('')}</div>
      ${rtlRows.length ? `<div dir="rtl" style="font-family:${RTL_FONT};text-align:right;border-top:1pt solid #e2e8f0;margin-top:7pt;padding-top:6pt;">${rtlRows.join('')}</div>` : ''}
    </td>`;
};

export function buildProposalWordHtml(p: CommercialProposal): string {
  const logoRow = (p.logoUrl || p.logo2Url) ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:10pt;">
      <tr>
        <td align="${p.logo2Url ? 'left' : 'center'}">${p.logoUrl ? `<img src="${esc(p.logoUrl)}" height="52" alt=""/>` : ''}</td>
        ${p.logo2Url ? `<td align="right"><img src="${esc(p.logo2Url)}" height="52" alt=""/></td>` : ''}
      </tr>
    </table>` : '';

  const sections = p.sections.map(sec => `
    ${band(sec.titleEn || sec.sectionNum, sec.titleRtl || '')}
    ${sec.contentEn ? `<div dir="ltr" style="font-family:${EN_FONT};font-size:10pt;line-height:1.5;text-align:justify;padding:8pt 2pt 4pt;">${nl2br(sec.contentEn)}</div>` : ''}
    ${sec.contentRtl ? `<div dir="rtl" style="font-family:${RTL_FONT};font-size:10pt;line-height:1.9;text-align:justify;background:#f8fafc;border:1pt solid #e2e8f0;padding:8pt 10pt;">${nl2br(sec.contentRtl)}</div>` : ''}
  `).join('');

  const priceRows = p.lineItems.map(li => `
    <tr${li.selected ? ' style="background:#ecfdf5;"' : ''}>
      <td style="border:1pt solid #cbd5e1;padding:6pt 7pt;">
        <div dir="ltr" style="font-family:${EN_FONT};font-weight:bold;text-align:left;">${esc(li.itemEn)}</div>
        ${li.itemRtl ? `<div dir="rtl" style="font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;margin-top:2pt;">${esc(li.itemRtl)}</div>` : ''}
        ${li.notes ? `<div dir="ltr" style="font-family:${EN_FONT};font-size:8pt;color:#64748b;font-style:italic;text-align:left;margin-top:2pt;">${esc(li.notes)}</div>` : ''}
      </td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};">${esc(li.qty)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};">${esc(li.unitPrice)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};font-weight:bold;">${esc(li.total)}</td>
      <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;color:#047857;font-weight:bold;">${li.selected ? '&#10003;' : ''}</td>
    </tr>`).join('');

  const priceTable = p.lineItems.length ? `
    ${band('PRICING OPTIONS', 'گزینه‌های قیمت‌گذاری')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:9.5pt;margin-bottom:10pt;">
      <tr>
        <td style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt 7pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;" width="46%">PACKAGE / بسته</td>
        <td align="center" style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">QTY</td>
        <td align="center" style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">UNIT (${esc(p.currency)})</td>
        <td align="center" style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">TOTAL (${esc(p.currency)})</td>
        <td align="center" style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;" width="36">SEL.</td>
      </tr>
      ${priceRows}
    </table>` : '';

  const realAddOns = p.addOns.filter(ao => (ao.nameEn || ao.nameRtl || '').trim());
  const addOnTable = realAddOns.length ? `
    ${band('OPTIONAL ADD-ONS', 'افزودنی‌های اختیاری')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:9.5pt;margin-bottom:10pt;">
      <tr>
        <td style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt 7pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;">ADD-ON</td>
        <td align="center" style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;" width="110">PRICE (${esc(p.currency)})</td>
        <td align="center" style="background:${NAVY};color:#fff;border:1pt solid ${NAVY};padding:6pt;font-family:${EN_FONT};font-size:8.5pt;font-weight:bold;" width="36">SEL.</td>
      </tr>
      ${realAddOns.map(ao => `
      <tr${ao.selected ? ' style="background:#ecfdf5;"' : ''}>
        <td style="border:1pt solid #cbd5e1;padding:6pt 7pt;">
          <div dir="ltr" style="font-family:${EN_FONT};font-weight:bold;text-align:left;">${esc(ao.nameEn)}</div>
          ${ao.nameRtl ? `<div dir="rtl" style="font-family:${RTL_FONT};font-size:9pt;color:#334155;text-align:right;margin-top:2pt;">${esc(ao.nameRtl)}</div>` : ''}
          ${(ao.descEn || ao.descRtl) ? `<div style="font-size:8pt;color:#64748b;font-style:italic;margin-top:2pt;">${esc(ao.descEn || '')}${ao.descEn && ao.descRtl ? ' — ' : ''}${esc(ao.descRtl || '')}</div>` : ''}
        </td>
        <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;font-family:${EN_FONT};">${esc(ao.price)}</td>
        <td align="center" style="border:1pt solid #cbd5e1;padding:6pt;color:#047857;font-weight:bold;">${ao.selected ? '&#10003;' : ''}</td>
      </tr>`).join('')}
    </table>` : '';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta name="ProgId" content="Word.Document"/>
<title>${esc(p.refNo)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm 1.8cm; }
  body { font-family: ${EN_FONT}; color: #0f172a; }
</style>
</head>
<body>
${logoRow}
<div style="text-align:center;">
  <div dir="ltr" style="font-family:${EN_FONT};font-size:15pt;font-weight:bold;color:${NAVY};text-transform:uppercase;">${esc(p.titleEn)}</div>
  ${p.titleRtl ? `<div dir="rtl" style="font-family:${RTL_FONT};font-size:13pt;font-weight:bold;color:${NAVY};margin-top:4pt;">${esc(p.titleRtl)}</div>` : ''}
  ${p.subtitleEn ? `<div dir="ltr" style="font-size:10pt;color:#334155;margin-top:7pt;">${esc(p.subtitleEn)}</div>` : ''}
  ${p.subtitleRtl ? `<div dir="rtl" style="font-family:${RTL_FONT};font-size:10pt;color:#334155;margin-top:2pt;">${esc(p.subtitleRtl)}</div>` : ''}
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10pt;">
  <tr><td align="center" style="background:${NAVY};color:#ffffff;font-family:${EN_FONT};font-size:9pt;font-weight:bold;padding:6pt;">
    Ref. ${esc(p.refNo)} &nbsp;|&nbsp; Date: ${esc(p.proposalDate)} &nbsp;|&nbsp; Valid until: ${esc(p.validUntil)} &nbsp;|&nbsp; Currency: ${esc(p.currency)}
  </td></tr>
</table>
${band('PARTIES', 'طرفین')}
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    ${p.parties[0] ? partyCell(p.parties[0], 0) : ''}
    ${p.parties[1] ? partyCell(p.parties[1], 1) : ''}
  </tr>
</table>
${sections}
${priceTable}
${addOnTable}
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16pt;border-top:2pt solid ${NAVY};">
  <tr><td align="center" style="padding-top:8pt;">
    <div style="font-family:${EN_FONT};font-size:9.5pt;font-weight:bold;color:${NAVY};">${esc(p.companyName || 'Commercial Proposal')}</div>
    <div dir="ltr" style="font-family:${EN_FONT};font-size:8.5pt;color:#64748b;margin-top:3pt;">This document is a commercial proposal and becomes binding only upon signature of the corresponding service agreement.</div>
    <div dir="rtl" style="font-family:${RTL_FONT};font-size:8.5pt;color:#64748b;margin-top:2pt;">این سند پیشنهاد تجاری است و تنها پس از امضای قرارداد خدمات متناظر الزام‌آور می‌شود.</div>
  </td></tr>
</table>
</body>
</html>`;
}

export function exportProposalWord(p: CommercialProposal, filename: string): void {
  const html = buildProposalWordHtml(p);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`;
  a.click();
  URL.revokeObjectURL(a.href);
}
