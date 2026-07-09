import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  PAGE_W, PAGE_H, PAD, CONTENT_H,
  groupPreviewUnits, measureUnitHeight, packPageGroups,
} from './printPreviewPagination';

/**
 * PDF export from the live preview element (.pp-root).
 * Pages always render at full A4 content width. Tall sections are split across
 * pages — never scaled down (which made some pages look smaller).
 */

async function inlineImagesInDoc(doc: Document): Promise<void> {
  const imgs = Array.from(doc.images);
  await Promise.all(imgs.map(async img => {
    const src = img.getAttribute('src') || '';
    if (!src || src.startsWith('data:')) return;
    try {
      const r = await fetch(src, { mode: 'cors' });
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(blob);
      });
      img.src = dataUrl;
      await new Promise<void>(done => {
        if (img.complete) done();
        else { img.onload = () => done(); img.onerror = () => done(); }
      });
    } catch {
      img.remove();
    }
  }));
}

function loadHtmlInIframe(html: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed', left: '0', top: '0', width: `${PAGE_W}px`, height: `${PAGE_H}px`,
      border: '0', opacity: '0.01', pointerEvents: 'none', zIndex: '-1',
      transform: 'translateX(-200vw)', background: '#fff',
    });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) { iframe.remove(); reject(new Error('iframe document unavailable')); return; }
    doc.open();
    doc.write(html);
    doc.close();
    const done = () => setTimeout(() => resolve(iframe), 200);
    if (doc.readyState === 'complete') done();
    else iframe.onload = done;
  });
}

async function captureEl(el: HTMLElement): Promise<HTMLCanvasElement> {
  await (document.fonts?.ready ?? Promise.resolve());
  await new Promise(r => setTimeout(r, 50));
  return html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: PAGE_W,
    windowWidth: PAGE_W,
    scrollX: 0,
    scrollY: 0,
    foreignObjectRendering: true,
    onclone: (_d, node) => {
      const n = node as HTMLElement;
      n.style.width = `${PAGE_W}px`;
      n.style.background = '#ffffff';
      n.querySelectorAll('*').forEach(c => {
        const e = c as HTMLElement;
        e.style.letterSpacing = '0px';
        e.style.wordSpacing = '0px';
      });
      n.querySelectorAll('[dir="rtl"], [lang="fa"], .rtl-title, .rtl-sub, .pp-body-rtl, .rtl-block, .pkg-rtl, .lbl-rtl, .line-rtl, .pp-foot .rtl, .svc-title-rtl, .for-rtl, .pp-bullet-rtl, .pp-area-intro-rtl').forEach(c => {
        const e = c as HTMLElement;
        e.style.fontFamily = 'Tahoma, Arial, sans-serif';
        e.style.direction = 'rtl';
        e.style.unicodeBidi = 'embed';
        if ((e.style.textAlign || '') === 'justify') e.style.textAlign = 'right';
      });
      n.querySelectorAll('[dir="ltr"], .pp-body-en').forEach(c => {
        const e = c as HTMLElement;
        if ((e.style.textAlign || '') === 'justify') e.style.textAlign = 'left';
      });
    },
  });
}

function canvasToSlices(
  canvas: HTMLCanvasElement,
  contentWmm: number,
  contentHmm: number,
): { dataUrl: string; hMm: number }[] {
  const sliceHeightPx = Math.floor((contentHmm / contentWmm) * canvas.width);
  if (canvas.height <= sliceHeightPx) {
    return [{
      dataUrl: canvas.toDataURL('image/jpeg', 0.95),
      hMm: (canvas.height * contentWmm) / canvas.width,
    }];
  }
  const slices: { dataUrl: string; hMm: number }[] = [];
  let offsetY = 0;
  while (offsetY < canvas.height) {
    const sliceH = Math.min(sliceHeightPx, canvas.height - offsetY);
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx = sliceCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    slices.push({
      dataUrl: sliceCanvas.toDataURL('image/jpeg', 0.95),
      hMm: (sliceH * contentWmm) / canvas.width,
    });
    offsetY += sliceH;
  }
  return slices;
}

export async function exportPdfFromPreviewElement(rootEl: HTMLElement, filename: string): Promise<void> {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PDF</title></head>
<body style="margin:0;padding:0;background:#fff;">${rootEl.outerHTML}</body></html>`;

  const iframe = await loadHtmlInIframe(html);
  const doc = iframe.contentDocument!;
  const body = doc.body;
  const root = body.querySelector('.pp-root') as HTMLElement | null;
  if (!root) {
    iframe.remove();
    throw new Error('preview root not found');
  }

  try {
    await inlineImagesInDoc(doc);
    await new Promise(r => setTimeout(r, 100));

    const styleTemplate = root.querySelector('style')?.cloneNode(true) ?? null;
    const flatUnits = groupPreviewUnits(root);

    const measureMount = doc.createElement('div');
    measureMount.className = 'pp-root';
    measureMount.style.cssText = `width:${PAGE_W}px;padding:${PAD}px;box-sizing:border-box;background:#fff;position:absolute;left:-9999px;top:0;`;
    if (styleTemplate) measureMount.appendChild(styleTemplate.cloneNode(true));
    flatUnits.forEach(u => measureMount.appendChild(u.cloneNode(true)));
    body.appendChild(measureMount);
    await new Promise(r => setTimeout(r, 80));

    const styleOffset = styleTemplate ? 1 : 0;
    const unitHeights = flatUnits.map((_, idx) => {
      const child = measureMount.children[idx + styleOffset] as HTMLElement;
      return child ? measureUnitHeight(child) : 0;
    });
    body.removeChild(measureMount);

    const pageGroups = packPageGroups(flatUnits, unitHeights);
    const allSlices: { dataUrl: string; hMm: number }[] = [];

    const marginMm = 8;
    const pageWmm = 210;
    const pageHmm = 297;
    const contentWmm = pageWmm - marginMm * 2;
    const contentHmm = pageHmm - marginMm * 2 - 8;

    for (const pageUnits of pageGroups) {
      body.innerHTML = '';
      const pageDiv = doc.createElement('div');
      pageDiv.className = 'pp-root';
      pageDiv.style.cssText = `width:${PAGE_W}px;padding:${PAD}px;box-sizing:border-box;background:#ffffff;`;
      if (styleTemplate) pageDiv.appendChild(styleTemplate.cloneNode(true));
      pageUnits.forEach(n => pageDiv.appendChild(n.cloneNode(true)));
      body.appendChild(pageDiv);

      const canvas = await captureEl(pageDiv);
      allSlices.push(...canvasToSlices(canvas, contentWmm, contentHmm));
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    for (let i = 0; i < allSlices.length; i++) {
      if (i > 0) pdf.addPage();
      const slice = allSlices[i];
      pdf.addImage(slice.dataUrl, 'JPEG', marginMm, marginMm, contentWmm, slice.hMm);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`${i + 1} / ${allSlices.length}`, pageWmm / 2, pageHmm - 5, { align: 'center' });
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  } finally {
    iframe.remove();
  }
}

export { PAGE_W, PAGE_H, PAD, CONTENT_H };
