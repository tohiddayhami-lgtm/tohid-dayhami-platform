import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** A4 content width at 96dpi — matches on-screen proposal preview. */
export const PROPOSAL_CAPTURE_WIDTH_PX = 794;

const PAGE_MARGIN_MM = 12;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const BREAK_SELECTORS = [
  '.pp-logos',
  '.pp-title-block',
  '.pp-meta-bar',
  '.pp-meta-sub',
  '.pp-band',
  '.pp-parties-table',
  '.pp-section',
  '.pp-price-table',
  '.pp-addon-table',
  '.pp-foot',
].join(', ');

function prepareClone(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  // Drop embedded <style> — we inject a clean stylesheet on the host.
  clone.querySelectorAll('style').forEach(s => s.remove());
  clone.removeAttribute('id');
  Object.assign(clone.style, {
    width: `${PROPOSAL_CAPTURE_WIDTH_PX}px`,
    maxWidth: `${PROPOSAL_CAPTURE_WIDTH_PX}px`,
    minWidth: `${PROPOSAL_CAPTURE_WIDTH_PX}px`,
    margin: '0',
    padding: '0',
    boxSizing: 'border-box',
    background: '#ffffff',
    direction: 'ltr',
    textAlign: 'left',
    position: 'relative',
    overflow: 'visible',
  });
  return clone;
}

function relativeY(el: HTMLElement, root: HTMLElement): { top: number; bottom: number } {
  const er = el.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  const top = er.top - rr.top + root.scrollTop;
  return { top, bottom: top + er.height };
}

/** DOM Y offsets (px) where a page break is safe — after complete blocks. */
function collectBreakYs(root: HTMLElement): number[] {
  const points = new Set<number>([0]);

  // Only break *after* complete blocks so headers are not left alone at page bottom.
  root.querySelectorAll(`${BREAK_SELECTORS}, .pp-body-en, .pp-body-rtl`).forEach(node => {
    const { bottom } = relativeY(node as HTMLElement, root);
    if (bottom > 1) points.add(Math.round(bottom));
  });

  const height = Math.max(root.scrollHeight, root.offsetHeight, 1);
  points.add(Math.round(height));
  return [...points].sort((a, b) => a - b);
}

/**
 * Build page ranges [startY, endY) in DOM pixels, preferring breaks between blocks
 * so text is not cut mid-line.
 */
function buildPageRanges(breakYs: number[], pageHeightDomPx: number): Array<{ start: number; end: number }> {
  const total = breakYs[breakYs.length - 1] || 0;
  if (total <= pageHeightDomPx) return [{ start: 0, end: total }];

  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;

  while (start < total - 1) {
    const limit = start + pageHeightDomPx;
    // Largest break point that still fits on this page (and advances).
    let end = start;
    for (const y of breakYs) {
      if (y <= start + 2) continue;
      if (y <= limit) end = y;
      else break;
    }
    // Fallback: hard cut if a single block is taller than a page.
    if (end <= start) end = Math.min(total, limit);
    ranges.push({ start, end });
    start = end;
  }
  return ranges;
}

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  // Wait for fonts/images/layout.
  await (document.fonts?.ready ?? Promise.resolve());
  await new Promise(r => setTimeout(r, 200));

  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 20000,
    width: PROPOSAL_CAPTURE_WIDTH_PX,
    windowWidth: PROPOSAL_CAPTURE_WIDTH_PX,
    scrollX: 0,
    scrollY: 0,
    onclone: (_doc, cloneEl) => {
      const clone = cloneEl as HTMLElement;
      clone.style.width = `${PROPOSAL_CAPTURE_WIDTH_PX}px`;
      clone.style.maxWidth = `${PROPOSAL_CAPTURE_WIDTH_PX}px`;
      clone.style.margin = '0';
      clone.style.overflow = 'visible';
      clone.style.direction = 'ltr';
      clone.style.textAlign = 'left';
      let node: HTMLElement | null = clone.parentElement;
      while (node) {
        node.style.overflow = 'visible';
        node.style.direction = 'ltr';
        node = node.parentElement;
      }
    },
  });
}

function addCanvasSlice(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  srcY: number,
  srcH: number,
  isFirst: boolean,
  pageLabel: string,
) {
  const contentWidth = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
  const contentHeight = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2 - 6; // room for page number

  const slice = document.createElement('canvas');
  slice.width = canvas.width;
  slice.height = Math.max(1, Math.round(srcH));
  const ctx = slice.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, slice.width, slice.height);
  ctx.drawImage(
    canvas,
    0, Math.round(srcY), canvas.width, Math.round(srcH),
    0, 0, slice.width, slice.height,
  );

  const imgData = slice.toDataURL('image/jpeg', 0.95);
  let imgH = (slice.height * contentWidth) / slice.width;
  let imgW = contentWidth;
  if (imgH > contentHeight) {
    const s = contentHeight / imgH;
    imgH = contentHeight;
    imgW = contentWidth * s;
  }

  if (!isFirst) pdf.addPage();
  const x = PAGE_MARGIN_MM + (contentWidth - imgW) / 2;
  pdf.addImage(imgData, 'JPEG', x, PAGE_MARGIN_MM, imgW, imgH);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text(pageLabel, A4_WIDTH_MM / 2, A4_HEIGHT_MM - 6, { align: 'center' });
}

/**
 * Export the on-screen proposal preview DOM to a multi-page A4 PDF.
 * Pages break between sections/blocks (not through the middle of a line).
 */
export async function exportProposalPdf(element: HTMLElement, filename: string): Promise<void> {
  const host = document.createElement('div');
  host.className = 'proposal-pdf-capture-host';
  Object.assign(host.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: `${PROPOSAL_CAPTURE_WIDTH_PX}px`,
    zIndex: '-1',
    opacity: '0.01',
    pointerEvents: 'none',
    overflow: 'visible',
    background: '#ffffff',
    transform: 'translateX(-120vw)',
  });

  // Re-inject proposal CSS so the clone matches the live preview exactly.
  const liveStyle = element.querySelector('style')?.textContent || '';
  const styleEl = document.createElement('style');
  styleEl.textContent = liveStyle || '';

  const captureRoot = prepareClone(element);
  host.appendChild(styleEl);
  host.appendChild(captureRoot);

  try {
    document.body.appendChild(host);

    // Force layout at fixed width.
    void captureRoot.offsetHeight;

    const contentWidthMm = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
    const contentHeightMm = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2 - 6;
    // DOM px that fit on one A4 page at capture width.
    const pageHeightDomPx = (contentHeightMm / contentWidthMm) * PROPOSAL_CAPTURE_WIDTH_PX;

    const breakYs = collectBreakYs(captureRoot);
    const ranges = buildPageRanges(breakYs, pageHeightDomPx);

    const canvas = await captureElement(captureRoot);
    const scaleY = canvas.height / Math.max(1, captureRoot.scrollHeight);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const totalPages = ranges.length;

    ranges.forEach((range, i) => {
      const srcY = range.start * scaleY;
      const srcH = Math.max(1, (range.end - range.start) * scaleY);
      addCanvasSlice(pdf, canvas, srcY, srcH, i === 0, `${i + 1} / ${totalPages}`);
    });

    pdf.save(filename);
  } finally {
    host.remove();
  }
}
