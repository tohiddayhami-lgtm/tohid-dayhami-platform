import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Fixed desktop/A4 capture width — same PDF on mobile and laptop. */
export const INVOICE_CAPTURE_WIDTH_PX = 794;

const PAGE_MARGIN_MM = 10;

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
    const span = document.createElement('span');
    if (node.tagName === 'SELECT') {
      const sel = node as HTMLSelectElement;
      span.textContent = sel.options[sel.selectedIndex]?.text || sel.value;
    } else if (node.tagName === 'TEXTAREA') {
      span.textContent = node.value;
      span.style.whiteSpace = 'pre-wrap';
      span.style.display = 'block';
    } else {
      span.textContent = node.value;
    }
    const inline = node.classList.contains('invoice-inline-field');
    const block = node.classList.contains('invoice-block-field');
    const cs = window.getComputedStyle(node);
    span.style.font = cs.font;
    span.style.color = cs.color;
    span.style.textAlign = cs.textAlign;
    span.style.padding = '0';
    span.style.margin = '0';
    span.style.lineHeight = cs.lineHeight;
    if (node.tagName === 'TEXTAREA' || block) {
      span.style.display = 'block';
      span.style.width = '100%';
      if (block) span.style.marginBottom = '3px';
    } else if (inline || node.tagName === 'SELECT') {
      span.style.display = 'inline';
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

const captureSheet = async (sheetEl: HTMLElement): Promise<HTMLCanvasElement> => {
  await new Promise((r) => setTimeout(r, 120));
  return html2canvas(sheetEl, {
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
    },
  });
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

    const canvas = await captureSheet(captureRoot);
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

    const pageCanvasHeight = Math.floor((contentHeight / fullImgHeight) * canvas.height);
    let yOffset = 0;
    let pageIndex = 0;
    while (yOffset < canvas.height) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - yOffset);
      addSliceToPdf(pdf, canvas, yOffset, sliceHeight, pageIndex === 0);
      yOffset += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(filename);
  } finally {
    host.remove();
    document.body.classList.remove('pdf-export');
  }
}
