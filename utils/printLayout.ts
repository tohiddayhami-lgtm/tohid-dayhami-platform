import type { PrintLayoutSettings } from '../types';

export type { PrintLayoutSettings };

export const DEFAULT_PRINT_LAYOUT: PrintLayoutSettings = {
  bandMarginTop: 12,
  sectionGap: 2,
  bodyLineHeightEn: 1.5,
  bodyLineHeightRtl: 1.7,
  bodyFontSize: 10,
  titleFontSize: 14.5,
  bandPadding: 6,
  bodyPadding: 6,
  tableMarginBottom: 8,
  footMarginTop: 12,
  serviceCardGap: 6,
  pagePadding: 22,
  compactLevel: 15,
  pageBreakBefore: [],
};

export function mergePrintLayout(p?: PrintLayoutSettings | null): PrintLayoutSettings {
  return { ...DEFAULT_PRINT_LAYOUT, ...p, pageBreakBefore: p?.pageBreakBefore ?? [] };
}

/** Compact scales spacing more aggressively so empty page gaps shrink. */
function scalePx(base: number, compact: number): number {
  const factor = 1 - (compact / 100) * 0.72;
  return Math.max(0, Math.round(base * factor));
}

function scaleLh(base: number, compact: number): number {
  const factor = 1 - (compact / 100) * 0.22;
  return Math.round(base * factor * 100) / 100;
}

function scalePt(base: number, compact: number): number {
  const factor = 1 - (compact / 100) * 0.12;
  return Math.round(base * factor * 2) / 2;
}

/** Extra CSS (variables) applied on .pp-root — affects preview + PDF export. */
export function buildPrintLayoutCss(layout?: PrintLayoutSettings | null): string {
  const L = mergePrintLayout(layout);
  const c = L.compactLevel ?? 0;
  const pad = scalePx(L.pagePadding ?? 22, c);
  return `
    .pp-root {
      --pp-page-pad: ${pad}px;
      --pp-band-mt: ${scalePx(L.bandMarginTop ?? 12, c)}px;
      --pp-section-gap: ${scalePx(L.sectionGap ?? 2, c)}px;
      --pp-body-lh-en: ${scaleLh(L.bodyLineHeightEn ?? 1.5, c)};
      --pp-body-lh-rtl: ${scaleLh(L.bodyLineHeightRtl ?? 1.7, c)};
      --pp-body-fs: ${scalePt(L.bodyFontSize ?? 10, c)}pt;
      --pp-title-fs: ${scalePt(L.titleFontSize ?? 14.5, c)}pt;
      --pp-band-pad: ${scalePx(L.bandPadding ?? 6, c)}px;
      --pp-body-pad: ${scalePx(L.bodyPadding ?? 6, c)}px;
      --pp-table-mb: ${scalePx(L.tableMarginBottom ?? 8, c)}px;
      --pp-foot-mt: ${scalePx(L.footMarginTop ?? 12, c)}px;
      --pp-svc-gap: ${scalePx(L.serviceCardGap ?? 6, c)}px;
      --pp-meta-pad: ${scalePx(8, c)}px;
      --pp-logo-mb: ${scalePx(10, c)}px;
    }
    .pp-root { padding: var(--pp-page-pad) !important; }
    .pp-logos { margin-bottom: var(--pp-logo-mb) !important; }
    .pp-meta-bar { padding: var(--pp-meta-pad) 10px !important; margin: ${scalePx(8, c)}px 0 ${scalePx(2, c)}px !important; }
    .pp-meta-sub { margin: ${scalePx(4, c)}px 0 ${scalePx(8, c)}px !important; }
    .pp-title-block { margin: ${scalePx(2, c)}px 0 ${scalePx(6, c)}px !important; }
    .pp-parties-table td { padding: ${scalePx(8, c)}px ${scalePx(10, c)}px !important; }
    .pp-body-rtl { padding: var(--pp-body-pad) 12px var(--pp-body-pad) !important; }
  `;
}

export const PRINT_LAYOUT_PRESETS: { id: string; labelFa: string; labelEn: string; layout: PrintLayoutSettings }[] = [
  {
    id: 'spacious',
    labelFa: 'باز',
    labelEn: 'Spacious',
    layout: {
      ...DEFAULT_PRINT_LAYOUT,
      bandMarginTop: 18, sectionGap: 6, bodyLineHeightEn: 1.65, bodyLineHeightRtl: 1.9,
      bodyPadding: 10, footMarginTop: 22, serviceCardGap: 10, pagePadding: 28, compactLevel: 0,
    },
  },
  { id: 'normal', labelFa: 'معمولی', labelEn: 'Normal', layout: DEFAULT_PRINT_LAYOUT },
  {
    id: 'compact',
    labelFa: 'فشرده',
    labelEn: 'Compact',
    layout: {
      ...DEFAULT_PRINT_LAYOUT,
      bandMarginTop: 6, sectionGap: 0, bodyLineHeightEn: 1.4, bodyLineHeightRtl: 1.55,
      bodyFontSize: 9.5, bandPadding: 4, bodyPadding: 4, tableMarginBottom: 4,
      footMarginTop: 6, serviceCardGap: 4, pagePadding: 16, compactLevel: 35,
    },
  },
  {
    id: 'tight',
    labelFa: 'خیلی فشرده',
    labelEn: 'Tight',
    layout: {
      ...DEFAULT_PRINT_LAYOUT,
      bandMarginTop: 3, sectionGap: 0, bodyLineHeightEn: 1.3, bodyLineHeightRtl: 1.45,
      bodyFontSize: 9, titleFontSize: 13, bandPadding: 3, bodyPadding: 2, tableMarginBottom: 2,
      footMarginTop: 4, serviceCardGap: 2, pagePadding: 12, compactLevel: 55,
    },
  },
];
