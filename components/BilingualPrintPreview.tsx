import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BILINGUAL_DOC_CSS } from '../utils/bilingualDocCss';
import {
  DEFAULT_PRINT_LAYOUT, PRINT_LAYOUT_PRESETS, buildPrintLayoutCss,
  mergePrintLayout, type PrintLayoutSettings,
} from '../utils/printLayout';
import {
  PAGE_W, PAGE_H, PAD, paginateRootElement,
} from '../utils/printPreviewPagination';

export interface PrintSectionRef {
  id: string;
  label: string;
}

interface Props {
  children: React.ReactNode;
  layout?: PrintLayoutSettings | null;
  onLayoutChange?: (layout: PrintLayoutSettings) => void;
  printRef?: React.RefObject<HTMLDivElement | null>;
  sections?: PrintSectionRef[];
  lang: 'fa' | 'en';
  readonly?: boolean;
}

export const BilingualPrintPreview: React.FC<Props> = ({
  children, layout, onLayoutChange, printRef, sections = [], lang, readonly,
}) => {
  const sourceRef = useRef<HTMLDivElement>(null);
  const [pageGroups, setPageGroups] = useState<HTMLElement[][]>([]);
  const [paginating, setPaginating] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const merged = useMemo(() => mergePrintLayout(layout), [layout]);
  const isFa = lang === 'fa';

  const fullCss = useMemo(
    () => BILINGUAL_DOC_CSS + buildPrintLayoutCss(merged),
    [merged],
  );

  const runPagination = useCallback(() => {
    const root = sourceRef.current;
    if (!root) return;
    setPaginating(true);
    requestAnimationFrame(() => {
      try {
        const groups = paginateRootElement(root);
        setPageGroups(groups.map(g => g.map(u => u.cloneNode(true) as HTMLElement)));
      } catch {
        setPageGroups([[]]);
      }
      setPaginating(false);
    });
  }, [fullCss, children]);

  useLayoutEffect(() => {
    runPagination();
  }, [runPagination]);

  const patch = (updates: Partial<PrintLayoutSettings>) => {
    if (!onLayoutChange || readonly) return;
    onLayoutChange({ ...merged, ...updates });
  };

  const togglePageBreak = (id: string) => {
    const cur = new Set(merged.pageBreakBefore ?? []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    patch({ pageBreakBefore: [...cur] });
  };

  const assignPrintRef = (el: HTMLDivElement | null) => {
    sourceRef.current = el;
    if (printRef && 'current' in printRef) {
      (printRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  const pagePad = merged.pagePadding ?? 22;
  const pageCount = pageGroups.length;

  return (
    <div className="flex flex-col xl:flex-row gap-4 items-start">
      <aside className="w-full xl:w-80 shrink-0 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto z-10">
        <h3 className="text-sm font-black text-gray-900 mb-1">
          {isFa ? 'تنظیم چیدمان چاپ' : 'Print layout'}
        </h3>
        <p className="text-[10px] text-gray-400 mb-3">
          {isFa
            ? 'برای کم کردن فضای خالی، «فشرده» یا «خیلی فشرده» را بزنید یا اسلایدر فشرده‌سازی را بالا ببرید.'
            : 'Use Compact/Tight presets or raise Compact % to reduce empty page space.'}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {PRINT_LAYOUT_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              disabled={readonly}
              onClick={() => onLayoutChange?.({ ...p.layout, pageBreakBefore: merged.pageBreakBefore })}
              className="px-2 py-1 rounded-lg text-[10px] font-bold border border-gray-200 hover:border-gray-400 disabled:opacity-50"
            >
              {isFa ? p.labelFa : p.labelEn}
            </button>
          ))}
        </div>

        <Slider label={isFa ? 'فشرده‌سازی کلی (مهم‌ترین)' : 'Overall compact (main)'} min={0} max={80} value={merged.compactLevel ?? 0}
          onChange={v => patch({ compactLevel: v })} disabled={readonly} unit="%" />
        <Slider label={isFa ? 'حاشیه صفحه' : 'Page padding'} min={8} max={36} value={pagePad}
          onChange={v => patch({ pagePadding: v })} disabled={readonly} />
        <Slider label={isFa ? 'فاصله بین بخش‌ها' : 'Section gap'} min={0} max={24} value={merged.sectionGap ?? 2}
          onChange={v => patch({ sectionGap: v })} disabled={readonly} />
        <Slider label={isFa ? 'فاصله عنوان بخش' : 'Band margin'} min={0} max={30} value={merged.bandMarginTop ?? 12}
          onChange={v => patch({ bandMarginTop: v })} disabled={readonly} />
        <Slider label={isFa ? 'ارتفاع خط EN' : 'EN line height'} min={1.2} max={2.1} step={0.05} value={merged.bodyLineHeightEn ?? 1.5}
          onChange={v => patch({ bodyLineHeightEn: v })} disabled={readonly} />
        <Slider label={isFa ? 'ارتفاع خط FA' : 'RTL line height'} min={1.2} max={2.2} step={0.05} value={merged.bodyLineHeightRtl ?? 1.7}
          onChange={v => patch({ bodyLineHeightRtl: v })} disabled={readonly} />

        <button type="button" onClick={() => setShowAdvanced(v => !v)}
          className="mb-2 text-[10px] font-bold text-indigo-600 hover:underline">
          {showAdvanced ? (isFa ? '▾ جزئیات کمتر' : '▾ Less detail') : (isFa ? '▸ تنظیمات بیشتر' : '▸ More controls')}
        </button>

        {showAdvanced && (
          <>
            <Slider label={isFa ? 'اندازه متن' : 'Body size'} min={8} max={12} step={0.5} value={merged.bodyFontSize ?? 10}
              onChange={v => patch({ bodyFontSize: v })} disabled={readonly} unit="pt" />
            <Slider label={isFa ? 'اندازه عنوان' : 'Title size'} min={11} max={18} step={0.5} value={merged.titleFontSize ?? 14.5}
              onChange={v => patch({ titleFontSize: v })} disabled={readonly} unit="pt" />
            <Slider label={isFa ? 'پدینگ عنوان بخش' : 'Band padding'} min={0} max={16} value={merged.bandPadding ?? 6}
              onChange={v => patch({ bandPadding: v })} disabled={readonly} />
            <Slider label={isFa ? 'پدینگ متن' : 'Body padding'} min={0} max={16} value={merged.bodyPadding ?? 6}
              onChange={v => patch({ bodyPadding: v })} disabled={readonly} />
            <Slider label={isFa ? 'فاصله زیر جدول' : 'Table bottom'} min={0} max={20} value={merged.tableMarginBottom ?? 8}
              onChange={v => patch({ tableMarginBottom: v })} disabled={readonly} />
            <Slider label={isFa ? 'فاصله فوتر' : 'Footer margin'} min={0} max={28} value={merged.footMarginTop ?? 12}
              onChange={v => patch({ footMarginTop: v })} disabled={readonly} />
            <Slider label={isFa ? 'فاصله کارت خدمات' : 'Service card gap'} min={0} max={16} value={merged.serviceCardGap ?? 6}
              onChange={v => patch({ serviceCardGap: v })} disabled={readonly} />
          </>
        )}

        {sections.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 mb-2">{isFa ? 'شروع صفحه جدید قبل از:' : 'Page break before:'}</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {sections.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-[10px] cursor-pointer">
                  <input type="checkbox" disabled={readonly}
                    checked={(merged.pageBreakBefore ?? []).includes(s.id)}
                    onChange={() => togglePageBreak(s.id)} />
                  <span className="truncate">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button type="button" onClick={runPagination}
          className="mt-4 w-full py-2 rounded-xl bg-gray-100 text-xs font-bold text-gray-700 hover:bg-gray-200">
          {isFa ? 'بازمحاسبه صفحات' : 'Recalculate pages'}
        </button>

        <div className="mt-3 text-center text-xs font-black text-teal-700">
          {paginating ? '…' : `${pageCount} ${isFa ? 'صفحه' : 'pages'}`}
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-6 pb-8">
        {paginating && pageGroups.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">{isFa ? 'در حال محاسبه صفحات…' : 'Calculating pages…'}</div>
        )}
        {pageGroups.map((units, pi) => (
          <div key={pi} className="relative mx-auto shadow-xl border border-slate-300/80 bg-white" style={{ width: PAGE_W, minHeight: PAGE_H }}>
            <div className="absolute -top-6 left-0 right-0 text-center text-[10px] font-bold text-slate-500">
              {isFa ? `صفحه ${pi + 1} از ${pageCount}` : `Page ${pi + 1} of ${pageCount}`}
            </div>
            <div className="pp-root overflow-hidden" style={{ width: PAGE_W, minHeight: PAGE_H, padding: pagePad, boxSizing: 'border-box' }}>
              <style>{fullCss}</style>
              {units.map((u, ui) => (
                <div key={ui} dangerouslySetInnerHTML={{ __html: u.outerHTML }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        ref={assignPrintRef}
        className="pp-root"
        dir="ltr"
        lang="en"
        aria-hidden
        style={{ position: 'fixed', left: -9999, top: 0, width: PAGE_W, visibility: 'hidden', pointerEvents: 'none', padding: pagePad, boxSizing: 'border-box' }}
      >
        <style>{fullCss}</style>
        {children}
      </div>
    </div>
  );
};

const Slider: React.FC<{
  label: string; min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; disabled?: boolean; unit?: string;
}> = ({ label, min, max, step = 1, value, onChange, disabled, unit = 'px' }) => (
  <div className="mb-3">
    <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
      <span>{label}</span>
      <span>{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-gray-900 disabled:opacity-40" />
  </div>
);

export { DEFAULT_PRINT_LAYOUT };
