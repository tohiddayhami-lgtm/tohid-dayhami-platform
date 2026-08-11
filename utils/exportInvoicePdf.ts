import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Fixed desktop/A4 capture width — same PDF on mobile and laptop. */
export const INVOICE_CAPTURE_WIDTH_PX = 794;

const PAGE_MARGIN_MM = 10;

type KeepRange = { top: number; bottom: number };

const flattenInputsForExport = (root: HTMLElement) => {
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    const node = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (node.tagName === 'INPUT') {
      const input = node as HTMLInputElement;
      if (input.type === 'radio' || input.type === 'checkbox') {
        node.remove();
        return;
      }
      if (!String(input.value ?? '').trim()) {
        node.remove();
        return;
      }
    }
    const isTextarea = node.tagName === 'TEXTAREA';
    const rawValue = isTextarea
      ? (node as HTMLTextAreaElement).value
      : node.tagName === 'SELECT'
        ? ((node as HTMLSelectElement).options[(node as HTMLSelectElement).selectedIndex]?.text || (node as HTMLSelectElement).value)
        : (node as HTMLInputElement).value;

    // Multi-line / Persian: render as isolated lines so BiDi doesn't scramble glyphs.
    if (isTextarea || (typeof rawValue === 'string' && /[\u0600-\u06FF]/.test(rawValue) && rawValue.includes('\n'))) {
      const wrap = document.createElement('div');
      const cs = window.getComputedStyle(node);
      wrap.style.font = cs.font;
      wrap.style.color = cs.color;
      wrap.style.width = '100%';
      wrap.style.lineHeight = cs.lineHeight || '1.35';
      wrap.style.whiteSpace = 'pre-wrap';
      wrap.style.unicodeBidi = 'isolate';
      const lines = String(rawValue || '').split('\n');
      lines.forEach((line, i) => {
        const p = document.createElement('div');
        p.textContent = line || '\u00a0';
        p.dir = /[\u0600-\u06FF]/.test(line) ? 'rtl' : 'ltr';
        p.style.unicodeBidi = 'isolate';
        p.style.textAlign = /[\u0600-\u06FF]/.test(line) ? 'right' : (cs.textAlign || 'left');
        if (i > 0) p.style.marginTop = '2px';
        wrap.appendChild(p);
      });
      node.replaceWith(wrap);
      return;
    }

    const span = document.createElement('span');
    span.textContent = String(rawValue || '');
    const inline = node.classList.contains('invoice-inline-field');
    const block = node.classList.contains('invoice-block-field');
    const cs = window.getComputedStyle(node);
    span.style.font = cs.font;
    span.style.color = cs.color;
    span.style.padding = '0';
    span.style.margin = '0';
    span.style.lineHeight = cs.lineHeight;
    span.style.unicodeBidi = 'isolate';
    const hasRtl = /[\u0600-\u06FF]/.test(String(rawValue || ''));
    span.dir = hasRtl ? 'rtl' : (node.getAttribute('dir') || 'ltr');
    if (hasRtl) {
      span.style.textAlign = 'right';
      span.style.display = 'block';
      span.style.width = '100%';
    } else {
      span.style.textAlign = cs.textAlign;
    }
    if (node.tagName === 'TEXTAREA' || block) {
      span.style.display = 'block';
      span.style.width = '100%';
      if (block) span.style.marginBottom = '3px';
      span.style.whiteSpace = 'pre-wrap';
    } else if (inline || node.tagName === 'SELECT') {
      if (!hasRtl) span.style.display = 'inline';
    } else {
      span.style.display = 'block';
      span.style.width = '100%';
    }
    node.replaceWith(span);
  });
};

const applyDesktopCaptureLayout = (root: HTMLElement) => {
  root.classList.add('invoice-pdf-capture-root');
  root.style.width = `${INVOICE_CAPTURE_WIDTH_PX}px`;
  root.style.maxWidth = `${INVOICE_CAPTURE_WIDTH_PX}px`;
  root.style.minWidth = `${INVOICE_CAPTURE_WIDTH_PX}px`;
  root.style.boxSizing = 'border-box';
  root.style.margin = '0';
};

/** Deep-clone invoice DOM and sync live form values (cloneNode skips input values). */
const cloneInvoiceForCapture = (source: HTMLElement): HTMLElement => {
  const clone = source.cloneNode(true) as HTMLElement;
  const sourceFields = source.querySelectorAll('input, textarea, select');
  const cloneFields = clone.querySelectorAll('input, textarea, select');
  sourceFields.forEach((src, index) => {
    const dst = cloneFields[index] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
    if (!dst) return;
    if (src instanceof HTMLSelectElement && dst instanceof HTMLSelectElement) {
      dst.value = src.value;
    } else if (src instanceof HTMLInputElement && dst instanceof HTMLInputElement) {
      dst.value = src.value;
      if (src.type === 'checkbox' || src.type === 'radio') dst.checked = src.checked;
    } else if (src instanceof HTMLTextAreaElement && dst instanceof HTMLTextAreaElement) {
      dst.value = src.value;
    }
  });
  applyDesktopCaptureLayout(clone);
  return clone;
};

/**
 * Collect keep-together block ranges in canvas pixel space so PDF slices
 * do not cut NOTES / payment boxes mid-text.
 */
const collectKeepRanges = (root: HTMLElement, canvasScale: number): KeepRange[] => {
  const rootRect = root.getBoundingClientRect();
  const nodes = root.querySelectorAll('.invoice-keep-together, .invoice-notes-box, .invoice-footer-block, table, .invoice-payment-notes-row');
  const ranges: KeepRange[] = [];
  nodes.forEach((n) => {
    const el = n as HTMLElement;
    const r = el.getBoundingClientRect();
    if (r.height < 8) return;
    const top = Math.max(0, Math.floor((r.top - rootRect.top) * canvasScale));
    const bottom = Math.ceil((r.bottom - rootRect.top) * canvasScale);
    if (bottom > top) ranges.push({ top, bottom });
  });
  ranges.sort((a, b) => a.top - b.top);
  // Merge overlapping
  const merged: KeepRange[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.top <= last.bottom + 4) {
      last.bottom = Math.max(last.bottom, r.bottom);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
};

/** Prefer breaks just before a keep-block rather than cutting through it. */
const computeSmartBreaks = (
  canvasHeight: number,
  idealPageHeight: number,
  keepRanges: KeepRange[],
): number[] => {
  const breaks: number[] = [0];
  let y = 0;
  const minProgress = Math.max(40, Math.floor(idealPageHeight * 0.35));

  while (y + idealPageHeight < canvasHeight - 8) {
    let candidate = y + idealPageHeight;
    // Snap away from keep-together interiors
    for (const range of keepRanges) {
      if (candidate > range.top + 2 && candidate < range.bottom - 2) {
        // Prefer breaking before the block if it still leaves a reasonable page.
        if (range.top - y >= minProgress) {
          candidate = range.top;
        } else if (range.bottom - y <= idealPageHeight * 1.15) {
          // Whole block fits if we extend slightly — break after it.
          candidate = Math.min(range.bottom, canvasHeight);
        } else {
          // Block taller than a page — break at top then continue inside later.
          candidate = range.top > y + minProgress ? range.top : candidate;
        }
        break;
      }
    }
    // Avoid tiny leftover pages
    if (candidate <= y + minProgress) {
      candidate = Math.min(y + idealPageHeight, canvasHeight);
    }
    if (candidate >= canvasHeight - 4) break;
    breaks.push(candidate);
    y = candidate;
  }
  return breaks;
};

const captureSheet = async (sheetEl: HTMLElement): Promise<{ canvas: HTMLCanvasElement; keepRanges: KeepRange[] }> => {
  await new Promise((r) => setTimeout(r, 120));
  let keepRanges: KeepRange[] = [];
  const canvas = await html2canvas(sheetEl, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    width: INVOICE_CAPTURE_WIDTH_PX,
    windowWidth: INVOICE_CAPTURE_WIDTH_PX,
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (el) => (el as HTMLElement).classList?.contains('print:hidden'),
    onclone: (_clonedDoc, cloneEl) => {
      const clone = cloneEl as HTMLElement;
      applyDesktopCaptureLayout(clone);
      clone.style.margin = '0';
      clone.style.overflow = 'visible';
      let node: HTMLElement | null = clone.parentElement;
      while (node) {
        node.style.overflow = 'visible';
        if (node.classList.contains('invoice-pdf-capture-host')) {
          node.style.width = `${INVOICE_CAPTURE_WIDTH_PX}px`;
        }
        node = node.parentElement;
      }
      flattenInputsForExport(clone);
      // Measure after flatten so NOTES full height is known
      keepRanges = collectKeepRanges(clone, 2);
    },
  });
  // Re-measure on live capture root as fallback if onclone ranges empty
  if (!keepRanges.length) {
    keepRanges = collectKeepRanges(sheetEl, 2);
  }
  return { canvas, keepRanges };
};

const addSliceToPdf = (
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  yOffset: number,
  sliceHeight: number,
  isFirstPage: boolean,
) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const contentHeight = pageHeight - PAGE_MARGIN_MM * 2;

  const sliceCanvas = document.createElement('canvas');
  sliceCanvas.width = canvas.width;
  sliceCanvas.height = sliceHeight;
  const ctx = sliceCanvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
  ctx.drawImage(canvas, 0, yOffset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

  const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
  let imgHeight = (sliceHeight * contentWidth) / canvas.width;
  let w = contentWidth;
  let h = imgHeight;

  if (h > contentHeight) {
    const scale = contentHeight / h;
    w = contentWidth * scale;
    h = contentHeight;
  }

  if (!isFirstPage) pdf.addPage();
  pdf.addImage(imgData, 'JPEG', PAGE_MARGIN_MM + (contentWidth - w) / 2, PAGE_MARGIN_MM, w, h);
};

/** Capture at fixed desktop width so mobile PDF matches laptop layout. */
export async function exportInvoicePdf(element: HTMLElement, filename: string): Promise<void> {
  document.body.classList.add('pdf-export');

  const host = document.createElement('div');
  host.className = 'invoice-pdf-capture-host';
  Object.assign(host.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${INVOICE_CAPTURE_WIDTH_PX}px`,
    zIndex: '-1',
    opacity: '0',
    pointerEvents: 'none',
    overflow: 'visible',
    transform: 'translateX(-120vw)',
  });

  const captureRoot = cloneInvoiceForCapture(element);

  try {
    document.body.appendChild(host);
    host.appendChild(captureRoot);

    // Wait for Vazirmatn (and other webfonts) so Persian glyphs shape correctly in the canvas.
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch { /* ignore */ }

    captureRoot.style.fontFamily = "'Vazirmatn', Tahoma, 'Segoe UI', sans-serif";

    // Flatten on live clone first so height (and NOTES) match PDF
    flattenInputsForExport(captureRoot);
    await new Promise((r) => setTimeout(r, 60));

    const { canvas, keepRanges } = await captureSheet(captureRoot);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;
    const contentHeight = pdf.internal.pageSize.getHeight() - PAGE_MARGIN_MM * 2;
    const fullImgHeight = (canvas.height * contentWidth) / canvas.width;

    if (fullImgHeight <= contentHeight) {
      addSliceToPdf(pdf, canvas, 0, canvas.height, true);
      pdf.save(filename);
      return;
    }

    const idealPageHeight = Math.floor((contentHeight / fullImgHeight) * canvas.height);
    const breaks = computeSmartBreaks(canvas.height, idealPageHeight, keepRanges);
    breaks.push(canvas.height);

    for (let i = 0; i < breaks.length - 1; i++) {
      const y0 = breaks[i];
      const y1 = breaks[i + 1];
      const sliceHeight = Math.max(1, y1 - y0);
      addSliceToPdf(pdf, canvas, y0, sliceHeight, i === 0);
    }

    pdf.save(filename);
  } finally {
    host.remove();
    document.body.classList.remove('pdf-export');
  }
}
