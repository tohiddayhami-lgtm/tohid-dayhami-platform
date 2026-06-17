import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
    span.style.padding = cs.padding;
    span.style.margin = cs.margin;
    span.style.width = cs.width;
    span.style.minHeight = cs.minHeight;
    span.style.lineHeight = cs.lineHeight;
    node.replaceWith(span);
  });
};

/** Capture an invoice DOM node and download a clean A4 PDF. */
export async function exportInvoicePdf(element: HTMLElement, filename: string): Promise<void> {
  document.body.classList.add('pdf-export');
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (el) => (el as HTMLElement).classList?.contains('print:hidden'),
      onclone: (clonedDoc) => {
        const root = clonedDoc.querySelector('.invoice-content') as HTMLElement | null;
        if (root) flattenInputsForExport(root);
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pageWidth) / imgProps.width;

    let position = 0;
    let remaining = imgHeight;

    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
    remaining -= pageHeight;

    while (remaining > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight);
      remaining -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.classList.remove('pdf-export');
  }
}
