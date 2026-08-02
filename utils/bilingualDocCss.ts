/** Shared print/preview CSS for bilingual proposal & contract documents. */
export const BILINGUAL_DOC_CSS = `
  @page { margin: 12mm 14mm; size: A4; }
  * { box-sizing: border-box; }
  .pp-root {
    max-width: 794px; margin: 0 auto; color: #0f172a;
    font-family: "Segoe UI", Calibri, Tahoma, Arial, sans-serif;
    font-size: 11pt; line-height: 1.45; background: #fff;
    direction: ltr !important; text-align: left !important; unicode-bidi: isolate;
  }
  .pp-logos {
    display: flex; align-items: center; justify-content: space-between;
    gap: 20px; margin-bottom: 14px; min-height: 48px;
    direction: ltr !important;
  }
  .pp-logos.center { justify-content: center; }
  .pp-logos img { object-fit: contain; max-width: 42%; }
  .pp-title-block { text-align: center; margin: 4px 0 10px; direction: ltr !important; }
  .pp-title-block .en-title {
    margin: 0; font-size: var(--pp-title-fs, 15.5pt); font-weight: 800; letter-spacing: .03em;
    text-transform: uppercase; color: #0b1f3a; line-height: 1.25;
    direction: ltr !important; text-align: center; unicode-bidi: isolate;
  }
  .pp-title-block .rtl-title {
    margin: 6px 0 0; font-size: 13.5pt; font-weight: 800;
    direction: rtl !important; text-align: center; unicode-bidi: isolate;
    color: #0b1f3a; line-height: 1.45; font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-title-block .en-sub {
    margin: 10px 0 0; font-size: 10pt; color: #334155; font-weight: 600;
    direction: ltr !important; text-align: center; unicode-bidi: isolate;
  }
  .pp-title-block .rtl-sub {
    margin: 4px 0 0; font-size: 10pt; color: #334155;
    direction: rtl !important; text-align: center; unicode-bidi: isolate;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-meta-bar {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px;
    margin: 12px 0 4px; padding: 8px 10px; background: #0b1f3a; color: #fff;
    font-size: 9pt; font-weight: 600; letter-spacing: .02em;
    direction: ltr !important; text-align: center;
  }
  .pp-meta-bar span { white-space: nowrap; direction: ltr !important; }
  .pp-meta-sub {
    text-align: center; font-size: 8.5pt; color: #64748b; margin: 6px 0 16px;
    direction: ltr !important;
  }
  .pp-band {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    background: #0b1f3a; color: #fff; margin: var(--pp-band-mt, 18px) 0 0;
    border: 1px solid #0b1f3a; direction: ltr !important;
  }
  .pp-band .l {
    padding: var(--pp-band-pad, 8px) 12px; font-size: 10pt; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
    direction: ltr !important; text-align: left !important; unicode-bidi: isolate;
  }
  .pp-band .r {
    padding: var(--pp-band-pad, 8px) 12px; font-size: 10pt; font-weight: 800;
    direction: rtl !important; text-align: right !important; unicode-bidi: isolate;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif; border-left: 1px solid rgba(255,255,255,.2);
  }
  .pp-parties-table { width: 100%; border-collapse: collapse; margin: 0 0 8px; table-layout: fixed; direction: ltr !important; }
  .pp-parties-table td {
    width: 50%; vertical-align: top; border: 1px solid #cbd5e1; padding: 12px 14px;
    background: #f8fafc; direction: ltr !important; text-align: left !important;
  }
  .pp-parties-table .en-block {
    direction: ltr !important; text-align: left !important; unicode-bidi: isolate; margin-bottom: 10px;
  }
  .pp-parties-table .rtl-block {
    direction: rtl !important; text-align: right !important; unicode-bidi: isolate;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
    border-top: 1px solid #e2e8f0; padding-top: 8px;
  }
  .pp-parties-table .num {
    font-size: 9pt; font-weight: 800; color: #0b1f3a; letter-spacing: .04em; margin-bottom: 4px;
    direction: ltr !important; text-align: left !important;
  }
  .pp-parties-table .num-rtl {
    font-size: 9pt; font-weight: 800; color: #0b1f3a; margin-bottom: 4px;
    direction: rtl !important; text-align: right !important;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-parties-table .co {
    font-size: 11pt; font-weight: 800; color: #0f172a; margin-bottom: 2px;
    direction: ltr !important; text-align: left !important;
  }
  .pp-parties-table .co-rtl {
    font-size: 10.5pt; font-weight: 700; color: #1e293b; margin-bottom: 6px;
    direction: rtl !important; text-align: right !important;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-parties-table .row {
    font-size: 9pt; color: #334155; margin-top: 2px; line-height: 1.45;
    direction: ltr !important; text-align: left !important;
  }
  .pp-parties-table .row-rtl {
    font-size: 9pt; color: #334155; margin-top: 2px; line-height: 1.55;
    direction: rtl !important; text-align: right !important;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-section { margin: 0 0 var(--pp-section-gap, 4px); page-break-inside: avoid; direction: ltr !important; }
  .pp-body-en {
    white-space: pre-wrap; font-size: var(--pp-body-fs, 10pt); line-height: var(--pp-body-lh-en, 1.65); color: #0f172a;
    padding: var(--pp-body-pad, 10px) 6px 8px;
    direction: ltr !important; text-align: justify !important; text-justify: inter-word;
    unicode-bidi: isolate; hyphens: auto;
  }
  .pp-body-rtl {
    white-space: pre-wrap; font-size: var(--pp-body-fs, 10pt); line-height: var(--pp-body-lh-rtl, 1.9); color: #0f172a;
    direction: rtl !important; text-align: justify !important; text-justify: inter-word;
    unicode-bidi: isolate;
    padding: var(--pp-body-pad, 10px) 12px 12px;
    background: #f8fafc; border: 1px solid #e2e8f0; border-top: none;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-price-table, .pp-addon-table {
    width: 100%; border-collapse: collapse; margin: 0 0 var(--pp-table-mb, 14px); font-size: 9.5pt;
    direction: ltr !important;
  }
  .pp-price-table th, .pp-addon-table th {
    background: #0b1f3a; color: #fff; font-weight: 700; font-size: 8.5pt;
    letter-spacing: .04em; text-transform: uppercase; padding: 8px 8px; border: 1px solid #0b1f3a;
    text-align: left !important; direction: ltr !important;
  }
  .pp-price-table td, .pp-addon-table td {
    border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; background: #fff;
    direction: ltr !important; text-align: left !important;
  }
  .pp-price-table tr.sel td, .pp-addon-table tr.sel td { background: #ecfdf5; }
  .pp-price-table .pkg-en, .pp-addon-table .pkg-en {
    font-weight: 700; color: #0f172a; display: block;
    direction: ltr !important; text-align: left !important; unicode-bidi: isolate;
  }
  .pp-price-table .pkg-rtl, .pp-addon-table .pkg-rtl {
    display: block; margin-top: 4px;
    direction: rtl !important; text-align: right !important; unicode-bidi: isolate;
    font-size: 9pt; color: #334155; font-weight: 600;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-price-table .pkg-note, .pp-addon-table .pkg-note {
    display: block; font-size: 8pt; color: #64748b; margin-top: 4px; font-style: italic;
    direction: ltr !important; text-align: left !important; unicode-bidi: isolate;
  }
  .pp-price-table .num, .pp-addon-table .num {
    text-align: center !important; white-space: nowrap; font-variant-numeric: tabular-nums;
    direction: ltr !important;
  }
  .pp-price-table .sel-col, .pp-addon-table .sel-col {
    text-align: center !important; width: 36px; font-weight: 800; color: #047857;
    direction: ltr !important;
  }
  .pp-foot {
    margin-top: var(--pp-foot-mt, 22px); padding-top: 12px; border-top: 2px solid #0b1f3a;
    text-align: center; font-size: 8.5pt; color: #64748b; line-height: 1.5;
    direction: ltr !important;
  }
  .pp-foot .co { font-weight: 800; color: #0b1f3a; font-size: 9.5pt; margin-bottom: 4px; direction: ltr !important; }
  .pp-foot .en {
    direction: ltr !important; text-align: center; unicode-bidi: isolate;
    display: block; margin-bottom: 4px;
  }
  .pp-foot .rtl {
    direction: rtl !important; text-align: center; unicode-bidi: isolate;
    font-family: Tahoma, Arial, sans-serif;
    display: block; line-height: 1.7;
  }
  .pp-signatures {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px;
    page-break-inside: avoid; direction: ltr !important;
  }
  .pp-signatures .box {
    border-top: 2px solid #0b1f3a; padding-top: 12px; min-height: 80px;
    direction: ltr !important; text-align: left !important;
  }
  .pp-signatures .box .lbl {
    font-size: 9pt; font-weight: 800; letter-spacing: .04em; color: #0b1f3a;
    margin-bottom: 2px; direction: ltr !important;
  }
  .pp-signatures .box .lbl-rtl {
    font-size: 9pt; font-weight: 800; color: #0b1f3a; margin-bottom: 8px;
    direction: rtl !important; text-align: right !important;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-signatures .box .line {
    margin-top: 36px; border-bottom: 1px solid #94a3b8; padding-bottom: 4px;
    font-size: 9pt; color: #334155; direction: ltr !important;
  }
  .pp-signatures .box .line-rtl {
    font-size: 9pt; color: #334155; margin-top: 2px;
    direction: rtl !important; text-align: right !important;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-company-block {
    border: 1px solid #cbd5e1; background: #f8fafc; padding: 12px 14px; margin: 0 0 14px;
    direction: ltr !important;
  }
  .pp-company-block .co { font-size: 11pt; font-weight: 800; color: #0f172a; margin-bottom: 4px; direction: ltr !important; }
  .pp-company-block .co-rtl { font-size: 10.5pt; font-weight: 700; color: #1e293b; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; direction: rtl !important; text-align: right !important; font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  .pp-company-block .row { font-size: 9pt; color: #334155; margin-top: 2px; direction: ltr !important; }
  .pp-company-block .row-rtl { font-size: 9pt; color: #334155; margin-top: 2px; direction: rtl !important; text-align: right !important; font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  .pp-area-intro-en { font-size: 9.5pt; color: #334155; font-style: italic; padding: 6px 6px 10px; direction: ltr !important; }
  .pp-area-intro-rtl { font-size: 9.5pt; color: #334155; font-style: italic; padding: 0 12px 10px; direction: rtl !important; text-align: right !important; font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  .pp-service-card {
    border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin: 0 0 var(--pp-svc-gap, 10px); background: #fff;
    page-break-inside: avoid; direction: ltr !important;
  }
  .pp-service-card .svc-num { font-size: 8.5pt; font-weight: 800; color: #0b1f3a; letter-spacing: .04em; margin-bottom: 2px; direction: ltr !important; }
  .pp-service-card .svc-title-en { font-size: 10.5pt; font-weight: 700; color: #0f172a; margin-bottom: 4px; direction: ltr !important; }
  .pp-service-card .svc-title-rtl { font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 6px; direction: rtl !important; text-align: right !important; font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  .pp-service-card .for-en { font-size: 8.5pt; color: #64748b; font-style: italic; margin-top: 6px; direction: ltr !important; }
  .pp-service-card .for-rtl { font-size: 8.5pt; color: #64748b; font-style: italic; margin-top: 2px; direction: rtl !important; text-align: right !important; font-family: Tahoma, "Segoe UI", Arial, sans-serif; }
  .pp-bullet-en { font-size: 10pt; line-height: 1.6; color: #0f172a; padding: 4px 6px 4px 18px; text-indent: -12px; direction: ltr !important; }
  .pp-bullet-rtl { font-size: 10pt; line-height: 1.8; color: #0f172a; padding: 4px 18px 4px 6px; text-indent: -12px; direction: rtl !important; text-align: right !important; font-family: Tahoma, "Segoe UI", Arial, sans-serif; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 6px; }
  .pp-contact-line { text-align: center; font-size: 9.5pt; font-weight: 700; color: #0b1f3a; margin-top: 10px; direction: ltr !important; }
  .pp-re-hero {
    margin: 0 0 10px; padding: 16px 18px; border: 1px solid #cbd5e1; background:
      linear-gradient(135deg, #0b1f3a 0%, #1e3a5f 55%, #0f766e 100%);
    color: #fff; direction: ltr !important; page-break-inside: avoid;
  }
  .pp-re-badge {
    display: inline-block; font-size: 8pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25); padding: 4px 10px; margin-bottom: 8px;
  }
  .pp-re-badge-rtl {
    display: block; font-size: 8.5pt; font-weight: 700; margin: 4px 0 8px;
    direction: rtl !important; text-align: right; font-family: Tahoma, "Segoe UI", Arial, sans-serif; opacity: .9;
  }
  .pp-re-title { margin: 0; font-size: 14pt; font-weight: 800; letter-spacing: .01em; line-height: 1.3; direction: ltr !important; }
  .pp-re-title-rtl {
    margin: 6px 0 0; font-size: 12.5pt; font-weight: 800; line-height: 1.45;
    direction: rtl !important; text-align: right; font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-re-addr { margin-top: 8px; font-size: 9pt; opacity: .9; direction: ltr !important; }
  .pp-re-addr-rtl {
    margin-top: 2px; font-size: 9pt; opacity: .9;
    direction: rtl !important; text-align: right; font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-re-price { margin-top: 12px; font-size: 16pt; font-weight: 900; letter-spacing: .02em; direction: ltr !important; }
  .pp-re-price-note { font-size: 8.5pt; opacity: .85; margin-top: 2px; direction: ltr !important; }
  .pp-re-price-note-rtl {
    font-size: 8.5pt; opacity: .85; margin-top: 2px;
    direction: rtl !important; text-align: right; font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-re-facts {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; direction: ltr !important;
  }
  .pp-re-facts span {
    font-size: 8.5pt; font-weight: 700; background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.2); padding: 5px 10px;
  }
  .pp-re-amenities, .pp-re-amenities-rtl {
    display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px;
  }
  .pp-re-amenities span, .pp-re-amenities-rtl span {
    font-size: 8pt; font-weight: 600; background: #f8fafc; color: #0b1f3a;
    border: 1px solid #e2e8f0; padding: 3px 8px;
  }
  .pp-re-amenities { direction: ltr !important; }
  .pp-re-amenities-rtl {
    direction: rtl !important; justify-content: flex-start;
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
  }
  .pp-gallery {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;
    direction: ltr !important;
  }
  .pp-gallery-item {
    margin: 0; border: 1px solid #e2e8f0; background: #fff; overflow: hidden;
    page-break-inside: avoid;
  }
  .pp-gallery-item img {
    display: block; width: 100%; height: 180px; object-fit: cover; background: #f1f5f9;
  }
  .pp-gallery-item figcaption {
    padding: 8px 10px; font-size: 8.5pt; color: #334155; border-top: 1px solid #e2e8f0;
    display: flex; flex-direction: column; gap: 2px;
  }
  .pp-gallery-item figcaption span[dir="rtl"] {
    font-family: Tahoma, "Segoe UI", Arial, sans-serif; text-align: right;
  }
  @media print {
    .pp-root { max-width: none; }
    .pp-section, .pp-price-table, .pp-addon-table, .pp-parties-table, .pp-signatures, .pp-service-card, .pp-re-hero, .pp-gallery-item { page-break-inside: avoid; }
  }
`;
