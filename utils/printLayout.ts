import type { PrintLayoutSettings } from '../types';

export type { PrintLayoutSettings };

export const DEFAULT_PRINT_LAYOUT: PrintLayoutSettings = {
  bandMarginTop: 18,
  sectionGap: 4,
  bodyLineHeightEn: 1.65,
  bodyLineHeightRtl: 1.9,
  bodyFontSize: 10,
  titleFontSize: 15.5,
  bandPadding: 8,
  bodyPadding: 10,
  tableMarginBottom: 14,
  footMarginTop: 22,
  serviceCardGap: 10,
  compactLevel: 0,
  pageBreakBefore: [],
};

export function mergePrintLayout(p?: PrintLayoutSettings | null): PrintLayoutSettings {
  return { ...DEFAULT_PRINT_LAYOUT, ...p, pageBreakBefore: p?.pageBreakBefore ?? [] };
}

function scalePx(base: number, compact: number): number {
  const factor = 1 - (compact / 100) * 0.45;
  return Math.round(base * factor);
}

/** Extra CSS (variables) applied on .pp-root — affects preview + PDF export. */
export function buildPrintLayoutCss(layout?: PrintLayoutSettings | null): string {
  const L = mergePrintLayout(layout);
  const c = L.compactLevel ?? 0;
  return `
    .pp-root {
      --pp-band-mt: ${scalePx(L.bandMarginTop ?? 18, c)}px;
      --pp-section-gap: ${scalePx(L.sectionGap ?? 4, c)}px;
      --pp-body-lh-en: ${L.bodyLineHeightEn ?? 1.65};
      --pp-body-lh-rtl: ${L.bodyLineHeightRtl ?? 1.9};
      --pp-body-fs: ${L.bodyFontSize ?? 10}pt;
      --pp-title-fs: ${L.titleFontSize ?? 15.5}pt;
      --pp-band-pad: ${scalePx(L.bandPadding ?? 8, c)}px;
      --pp-body-pad: ${scalePx(L.bodyPadding ?? 10, c)}px;
      --pp-table-mb: ${scalePx(L.tableMarginBottom ?? 14, c)}px;
      --pp-foot-mt: ${scalePx(L.footMarginTop ?? 22, c)}px;
      --pp-svc-gap: ${scalePx(L.serviceCardGap ?? 10, c)}px;
    }
  `;
}

export const PRINT_LAYOUT_PRESETS: { id: string; labelFa: string; labelEn: string; layout: PrintLayoutSettings }[] = [
  { id: 'normal', labelFa: 'معمولی', labelEn: 'Normal', layout: DEFAULT_PRINT_LAYOUT },
  {
    id: 'compact',
    labelFa: 'فشرده',
    labelEn: 'Compact',
    layout: { ...DEFAULT_PRINT_LAYOUT, bandMarginTop: 10, sectionGap: 2, bodyLineHeightEn: 1.5, bodyLineHeightRtl: 1.7, bodyPadding: 6, footMarginTop: 12, serviceCardGap: 6, compactLevel: 25 },
  },
  {
    id: 'tight',
    labelFa: 'خیلی فشرده',
    labelEn: 'Tight',
    layout: { ...DEFAULT_PRINT_LAYOUT, bandMarginTop: 6, sectionGap: 0, bodyLineHeightEn: 1.4, bodyLineHeightRtl: 1.55, bodyFontSize: 9.5, bodyPadding: 4, footMarginTop: 8, serviceCardGap: 4, compactLevel: 50 },
  },
];
