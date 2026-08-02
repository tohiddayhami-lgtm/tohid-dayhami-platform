import type { RealEstateProposal } from '../types';
import { dealTypeLabel } from './realEstateProposalFormat';
import { BILINGUAL_DOC_CSS } from './bilingualDocCss';

const esc = (s: string) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const EN_FONT = '"Segoe UI", Calibri, Arial, sans-serif';
const RTL_FONT = 'Tahoma, "Segoe UI", Arial, sans-serif';

export function buildRealEstateProposalDocumentHtml(
  p: RealEstateProposal,
  mode: 'word' | 'pdf' = 'word',
): string {
  const prop = p.property;
  const dealEn = dealTypeLabel(prop.dealType, 'en');
  const dealFa = dealTypeLabel(prop.dealType, 'fa');
  const cur = prop.currency || p.currency || 'OMR';

  const logos = (p.logoUrl || p.logo2Url)
    ? `<div class="pp-logos ${p.contractLogoAlign === 'center' ? 'center' : ''}">
        ${p.logoUrl ? `<img src="${esc(p.logoUrl)}" height="46" />` : '<span></span>'}
        ${p.logo2Url ? `<img src="${esc(p.logo2Url)}" height="46" />` : '<span></span>'}
      </div>`
    : '';

  const parties = `<div class="pp-band"><div class="l">PARTIES</div><div class="r" dir="rtl">طرفین</div></div>
    <table class="pp-parties-table"><tbody><tr>
      ${(p.parties.slice(0, 2)).map((party, i) => `
        <td>
          <div class="en-block">
            <div class="num">${i + 1}. ${esc(party.labelEn)}</div>
            <div class="co">${esc(party.companyEn)}</div>
            ${party.regNo ? `<div class="row">CR: ${esc(party.regNo)}</div>` : ''}
            ${party.country ? `<div class="row">${esc(party.country)}</div>` : ''}
            ${party.repNameEn ? `<div class="row" style="margin-top:6px">${esc(party.repNameEn)}</div>` : ''}
            ${party.repTitleEn ? `<div class="row">${esc(party.repTitleEn)}</div>` : ''}
            ${party.contactPhone ? `<div class="row">${esc(party.contactPhone)}</div>` : ''}
            ${party.contactEmail ? `<div class="row">${esc(party.contactEmail)}</div>` : ''}
          </div>
          ${(party.companyRtl || party.labelRtl) ? `<div class="rtl-block" dir="rtl">
            <div class="num-rtl">${i + 1}. ${esc(party.labelRtl)}</div>
            ${party.companyRtl ? `<div class="co-rtl">${esc(party.companyRtl)}</div>` : ''}
            ${party.repNameRtl ? `<div class="row-rtl">${esc(party.repNameRtl)}</div>` : ''}
            ${party.repTitleRtl ? `<div class="row-rtl">${esc(party.repTitleRtl)}</div>` : ''}
          </div>` : ''}
        </td>`).join('')}
    </tr></tbody></table>`;

  const facts = [
    prop.areaSqm && { en: `${prop.areaSqm} sqm`, rtl: `${prop.areaSqm} متر` },
    prop.bedrooms && { en: `${prop.bedrooms} Beds`, rtl: `${prop.bedrooms} خواب` },
    prop.bathrooms && { en: `${prop.bathrooms} Baths`, rtl: `${prop.bathrooms} حمام` },
    prop.floors && { en: `${prop.floors} Floors`, rtl: `${prop.floors} طبقه` },
    prop.yearBuilt && { en: `Built ${prop.yearBuilt}`, rtl: `ساخت ${prop.yearBuilt}` },
  ].filter(Boolean) as { en: string; rtl: string }[];

  const amenitiesEn = (prop.amenitiesEn || []).filter(Boolean);
  const amenitiesRtl = (prop.amenitiesRtl || []).filter(Boolean);

  const propertyBlock = `
    <div class="pp-section">
      <div class="pp-band"><div class="l">FEATURED PROPERTY</div><div class="r" dir="rtl">ملک پیشنهادی</div></div>
      <div class="pp-re-hero">
        <div class="pp-re-badge">${esc(dealEn)} · ${esc(prop.propertyTypeEn || 'Property')}</div>
        <div class="pp-re-badge-rtl" dir="rtl">${esc(dealFa)} · ${esc(prop.propertyTypeRtl || 'ملک')}</div>
        <h3 class="pp-re-title" dir="ltr">${esc(prop.titleEn || '—')}</h3>
        ${prop.titleRtl ? `<h4 class="pp-re-title-rtl" dir="rtl">${esc(prop.titleRtl)}</h4>` : ''}
        ${(prop.addressEn || prop.city) ? `<div class="pp-re-addr" dir="ltr">${esc([prop.addressEn, prop.district, prop.city].filter(Boolean).join(' · '))}</div>` : ''}
        ${prop.addressRtl ? `<div class="pp-re-addr-rtl" dir="rtl">${esc(prop.addressRtl)}</div>` : ''}
        ${prop.price ? `<div class="pp-re-price" dir="ltr">${esc(cur)} ${esc(prop.price)}</div>` : ''}
        ${prop.priceNoteEn ? `<div class="pp-re-price-note" dir="ltr">${esc(prop.priceNoteEn)}</div>` : ''}
        ${prop.priceNoteRtl ? `<div class="pp-re-price-note-rtl" dir="rtl">${esc(prop.priceNoteRtl)}</div>` : ''}
        ${facts.length ? `<div class="pp-re-facts">${facts.map(f => `<span>${esc(f.en)}</span>`).join('')}</div>` : ''}
        ${amenitiesEn.length ? `<div class="pp-re-amenities">${amenitiesEn.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
        ${amenitiesRtl.length ? `<div class="pp-re-amenities-rtl" dir="rtl">${amenitiesRtl.map(a => `<span>${esc(a)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;

  const sections = p.sections.map(sec => `
    <div class="pp-section">
      <div class="pp-band">
        <div class="l" dir="ltr">${esc(sec.titleEn || sec.sectionNum)}</div>
        <div class="r" dir="rtl">${esc(sec.titleRtl || '—')}</div>
      </div>
      ${sec.contentEn ? `<div class="pp-body-en" dir="ltr">${esc(sec.contentEn)}</div>` : ''}
      ${sec.contentRtl ? `<div class="pp-body-rtl" dir="rtl">${esc(sec.contentRtl)}</div>` : ''}
    </div>`).join('');

  const photos = (p.photos || []).filter(ph => ph.url);
  const gallery = photos.length ? `
    <div class="pp-section pp-force-page-break">
      <div class="pp-band"><div class="l">PROPERTY GALLERY</div><div class="r" dir="rtl">گالری تصاویر ملک</div></div>
      <div class="pp-gallery">
        ${photos.map((ph, i) => `
          <figure class="pp-gallery-item">
            <img src="${esc(ph.url)}" alt="${esc(ph.captionEn || `Photo ${i + 1}`)}" />
            ${(ph.captionEn || ph.captionRtl) ? `<figcaption>
              ${ph.captionEn ? `<span dir="ltr">${esc(ph.captionEn)}</span>` : ''}
              ${ph.captionRtl ? `<span dir="rtl">${esc(ph.captionRtl)}</span>` : ''}
            </figcaption>` : ''}
          </figure>`).join('')}
      </div>
    </div>` : '';

  const body = `
    <div class="pp-root" dir="ltr" lang="en">
      <style>${BILINGUAL_DOC_CSS}</style>
      ${logos}
      <div class="pp-title-block">
        <h1 class="en-title" dir="ltr">${esc(p.titleEn)}</h1>
        ${p.titleRtl ? `<h2 class="rtl-title" dir="rtl">${esc(p.titleRtl)}</h2>` : ''}
        ${p.subtitleEn ? `<div class="en-sub" dir="ltr">${esc(p.subtitleEn)}</div>` : ''}
        ${p.subtitleRtl ? `<div class="rtl-sub" dir="rtl">${esc(p.subtitleRtl)}</div>` : ''}
      </div>
      <div class="pp-meta-bar">
        <span>Ref. ${esc(p.refNo)}</span><span>|</span>
        <span>Date: ${esc(p.proposalDate)}</span><span>|</span>
        <span>Valid until: ${esc(p.validUntil)}</span>
      </div>
      <div class="pp-meta-sub">Real Estate Proposal · ${esc(p.companyName || '')}</div>
      ${parties}
      ${propertyBlock}
      ${sections}
      ${gallery}
      <div class="pp-foot">
        <div class="co">${esc(p.companyName || 'Real Estate Proposal')}</div>
        <div class="en">This document is a real-estate proposal for discussion purposes and does not constitute a binding offer until a sale/lease agreement is signed.</div>
        <div class="rtl" dir="rtl">این سند صورت پروپوزال املاک برای مذاکره است و تا امضای قرارداد خرید/اجاره الزام‌آور نیست.</div>
      </div>
    </div>`;

  if (mode === 'word') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(p.refNo)}</title>
      <style>body{font-family:${EN_FONT};} .rtl-title,.rtl-sub,.pp-body-rtl,.rtl-block,.pp-re-title-rtl,.pp-re-addr-rtl,.pp-re-price-note-rtl,.pp-re-amenities-rtl,.pp-re-badge-rtl,.pp-foot .rtl{font-family:${RTL_FONT};}</style>
      </head><body>${body}</body></html>`;
  }
  return body;
}
