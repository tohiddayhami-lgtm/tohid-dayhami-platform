import type { CommercialProposal, ProposalParty } from '../types';

/**
 * Shared bilingual proposal HTML for Word (.doc) and PDF.
 *
 * Word justify rules (why it looked awful before):
 * - One giant <p> with <br/> makes Word stretch every line including the last.
 * - Bullet/list lines must NEVER be justified.
 * - Only multi-line prose paragraphs get justify; short lines stay start-aligned.
 * - Never nest " inside style="...".
 */

const NAVY = '#0b1f3a';
const EN_FONT = 'Calibri, Arial, sans-serif';
const RTL_FONT = 'Tahoma, Arial, sans-serif';

export type ProposalDocMode = 'word' | 'pdf';

export const esc = (s: string) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const LIST_RE = /^(?:[•▪◦●・]|[-–—*]|\d{1,3}[.)]|[۰-۹]{1,3}[.)])\s+/;

const isListLine = (line: string) => LIST_RE.test(line.trim());

/** Split on blank lines into blocks; keep single newlines inside a block as soft breaks. */
function splitBlocks(text: string): string[] {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean);
}

export function renderBody(text: string, rtl: boolean, mode: ProposalDocMode): string {
  const blocks = splitBlocks(text);
  if (!blocks.length) return '';

  const font = rtl ? RTL_FONT : EN_FONT;
  const dir = rtl ? 'rtl' : 'ltr';
  const lang = rtl ? ' lang="fa"' : '';
  const startAlign = rtl ? 'right' : 'left';
  // PDF capture must not justify (letter-spacing breaks Arabic joins in html2canvas).
  const allowJustify = mode === 'word';

  const parts = blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';

    const listCount = lines.filter(isListLine).length;
    const treatAsList = listCount > 0 && listCount >= Math.ceil(lines.length * 0.5);

    if (treatAsList) {
      return lines.map(line => {
        const t = esc(line);
        // Hanging indent for bullets — Word-friendly, never justified.
        if (rtl) {
          return `<p dir="rtl"${lang} style="margin:0 0 4pt 0;font-family:${font};font-size:10pt;line-height:1.75;color:#0f172a;text-align:right;margin-right:12pt;text-indent:-12pt;">${t}</p>`;
        }
        return `<p dir="ltr" style="margin:0 0 4pt 0;font-family:${font};font-size:10pt;line-height:1.5;color:#0f172a;text-align:left;margin-left:12pt;text-indent:-12pt;">${t}</p>`;
      }).join('');
    }

    // Prose: join soft line-breaks with space (real paragraph).
    const prose = esc(lines.join(' '));
    const longEnough = prose.length >= 90;
    const align = allowJustify && longEnough ? 'justify' : startAlign;
    // text-justify:inter-word + no last-line stretch (Word honors text-align-last poorly,
    // but separate paragraphs fix the "last line stretched" look).
    const justifyExtra = align === 'justify'
      ? 'text-justify:inter-word;'
      : '';

    if (rtl) {
      return `<p dir="rtl"${lang} style="margin:0 0 8pt 0;font-family:${font};font-size:10pt;line-height:1.85;color:#0f172a;text-align:${align};${justifyExtra}">${prose}</p>`;
    }
    return `<p dir="ltr" style="margin:0 0 8pt 0;font-family:${font};font-size:10pt;line-height:1.55;color:#0f172a;text-align:${align};${justifyExtra}">${prose}</p>`;
  });

  const inner = parts.join('');
  if (rtl) {
    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin:0 0 10pt 0;">
      <tr><td dir="rtl" style="background:#f8fafc;border:1pt solid #e2e8f0;padding:8pt 10pt;">${inner}</td></tr>
    </table>`;
  }
  return `<div style="margin:8pt 0 4pt 0;">${inner}</div>`;
}

export const band = (en: string, rtl: string) => `
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

export function buildProposalDocumentHtml(p: CommercialProposal, mode: ProposalDocMode = 'word'): string {
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
    ${sec.contentEn ? renderBody(sec.contentEn, false, mode) : ''}
    ${sec.contentRtl ? renderBody(sec.contentRtl, true, mode) : ''}
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
  body { margin:0; padding:0; color:#0f172a; font-family:${EN_FONT}; font-size:10pt; }
  p { margin:0; }
  table { border-collapse:collapse; }
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
