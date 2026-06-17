import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_MARGIN_MM = 10;

const flattenInputsForExport = (root: HTMLElement) => {
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    const node = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const span = document.createElement('div');
    if (node.tagName === 'SELECT') {
      const sel = node as HTMLSelectElement;
      span.textContent = sel.options[sel.selectedIndex]?.text || sel.value;
      span.style.display = 'inline';
      span.style.width = 'auto';
    } else if (node.tagName === 'TEXTAREA') {
      span.textContent = node.value;
      span.style.whiteSpace = 'pre-wrap';
    } else {
      span.textContent = node.value;
      const inline = node.classList.contains('invoice-inline-field');
      span.style.display = inline ? 'inline' : 'block';
      span.style.width = inline ? 'auto' : '100%';
    }
    const cs = window.getComputedStyle(node);
    span.style.font = cs.font;
    span.style.color = cs.color;
    span.style.textAlign = cs.textAlign;
    span.style.padding = '0';
    span.style.margin = '0';
    node.replaceWith(span);
  });
};

const captureSheet = async (sheetEl: HTMLElement): Promise<HTMLCanvasElement> => {
  sheetEl.scrollIntoView({ block: 'start' });
  await new Promise((r) => setTimeout(r, 80));
  return html2canvas(sheetEl, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    scrollX: 0,
    scrollY: -window.scrollY,
    ignoreElements: (el) => (el as HTMLElement).classList?.contains('print:hidden'),
    onclone: (_clonedDoc, cloneEl) => {
      const clone = cloneEl as HTMLElement;
      clone.style.margin = '0';
      clone.style.overflow = 'visible';
      let node: HTMLElement | null = clone.parentElement;
      while (node) {
        node.style.overflow = 'visible';
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

/** Capture full invoice sheet; paginate only when content exceeds one A4 page. */
export async function exportInvoicePdf(element: HTMLElement, filename: string): Promise<void> {
  document.body.classList.add('pdf-export');
  try {
    const sheet = (element.querySelector('.invoice-pdf-sheet') as HTMLElement) || element;
    const canvas = await captureSheet(sheet);
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
    document.body.classList.remove('pdf-export');
  }
}
