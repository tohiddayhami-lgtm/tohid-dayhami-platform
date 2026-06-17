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
    } else if (node.tagName === 'TEXTAREA') {
      span.textContent = node.value;
      span.style.whiteSpace = 'pre-wrap';
    } else {
      span.textContent = node.value;
    }
    const cs = window.getComputedStyle(node);
    span.style.font = cs.font;
    span.style.color = cs.color;
    span.style.textAlign = cs.textAlign;
    span.style.padding = '0';
    span.style.margin = '0';
    span.style.width = '100%';
    span.style.lineHeight = cs.lineHeight;
    node.replaceWith(span);
  });
};

const capturePage = async (pageEl: HTMLElement): Promise<HTMLCanvasElement> =>
  html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    ignoreElements: (el) => (el as HTMLElement).classList?.contains('print:hidden'),
    onclone: (_clonedDoc, cloneEl) => {
      const clone = cloneEl as HTMLElement;
      clone.style.padding = '0';
      clone.style.margin = '0';
      flattenInputsForExport(clone);
    },
  });

const addCanvasToPdf = (
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  isFirstPage: boolean,
) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const contentHeight = pageHeight - PAGE_MARGIN_MM * 2;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  let imgHeight = (canvas.height * contentWidth) / canvas.width;
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

/** Capture invoice pages (.invoice-pdf-page) and download a clean multi-page A4 PDF. */
export async function exportInvoicePdf(element: HTMLElement, filename: string): Promise<void> {
  document.body.classList.add('pdf-export');
  try {
    const pages = Array.from(element.querySelectorAll('.invoice-pdf-page')) as HTMLElement[];
    const targets = pages.length > 0 ? pages : [element];
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < targets.length; i++) {
      const canvas = await capturePage(targets[i]);
      addCanvasToPdf(pdf, canvas, i === 0);
    }

    pdf.save(filename);
  } finally {
    document.body.classList.remove('pdf-export');
  }
}
