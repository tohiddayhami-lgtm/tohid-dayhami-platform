import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * PDF export from the live preview element (.pp-root).
 * WYSIWYG: output matches on-screen preview (same CSS, layout, bilingual text).
 */

const PAGE_W = 794;
const PAGE_H = 1123;
const PAD = 28;
const CONTENT_H = PAGE_H - PAD * 2 - 20;

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
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${PAGE_W}px`,
      height: `${PAGE_H}px`,
      border: '0',
      opacity: '0.01',
      pointerEvents: 'none',
      zIndex: '-1',
      transform: 'translateX(-200vw)',
      background: '#fff',
    });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      reject(new Error('iframe document unavailable'));
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const done = () => setTimeout(() => resolve(iframe), 200);
    if (doc.readyState === 'complete') done();
    else iframe.onload = done;
  });
}

/** Group preview nodes: header block, band+table pairs, each .pp-section, footer. */
function groupPreviewUnits(root: HTMLElement): HTMLElement[][] {
  const kids = Array.from(root.children).filter(el => el.tagName !== 'STYLE') as HTMLElement[];
  const units: HTMLElement[][] = [];
  let i = 0;

  const header: HTMLElement[] = [];
  while (i < kids.length && !kids[i].classList.contains('pp-band') && !kids[i].classList.contains('pp-section')) {
    header.push(kids[i]);
    i++;
  }
  if (header.length) units.push(header);

  while (i < kids.length) {
    const el = kids[i];
    if (el.classList.contains('pp-band')) {
      const unit = [el];
      i++;
      if (i < kids.length && kids[i].tagName === 'TABLE') {
        unit.push(kids[i]);
        i++;
      }
      units.push(unit);
      continue;
    }
    if (el.classList.contains('pp-section') || el.classList.contains('pp-foot')) {
      units.push([el]);
      i++;
      continue;
    }
    units.push([el]);
    i++;
  }
  return units.length ? units : [kids];
}

function packPages(units: HTMLElement[][]): HTMLElement[][] {
  const pages: HTMLElement[][] = [];
  let cur: HTMLElement[] = [];
  let used = 0;

  const hOf = (els: HTMLElement[]) =>
    els.reduce((s, el) => s + el.getBoundingClientRect().height + 6, 0);

  for (const unit of units) {
    const h = hOf(unit);
    if (cur.length && used + h > CONTENT_H) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(...unit);
    used += Math.min(h, CONTENT_H);
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [units.flat()];
}

async function capturePage(el: HTMLElement): Promise<HTMLCanvasElement> {
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
      n.querySelectorAll('[dir="rtl"], [lang="fa"], .rtl-title, .rtl-sub, .pp-body-rtl, .rtl-block, .pkg-rtl, .lbl-rtl, .line-rtl, .pp-foot .rtl').forEach(c => {
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

/** Export the on-screen .pp-root preview element to a paginated A4 PDF. */
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

    const units = groupPreviewUnits(root);
    const pageGroups = packPages(units);
    const pageClones = pageGroups.map(group => group.map(el => el.cloneNode(true) as HTMLElement));
    const styleTemplate = root.querySelector('style')?.cloneNode(true) ?? null;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const marginMm = 8;
    const pageWmm = 210;
    const pageHmm = 297;
    const contentWmm = pageWmm - marginMm * 2;
    const contentHmm = pageHmm - marginMm * 2 - 8;

    for (let pi = 0; pi < pageClones.length; pi++) {
      body.innerHTML = '';
      const pageDiv = doc.createElement('div');
      pageDiv.className = 'pp-root';
      pageDiv.style.cssText = `width:${PAGE_W}px;min-height:${PAGE_H}px;padding:${PAD}px;box-sizing:border-box;background:#ffffff;`;
      if (styleTemplate) pageDiv.appendChild(styleTemplate.cloneNode(true));
      pageClones[pi].forEach(n => pageDiv.appendChild(n));
      body.appendChild(pageDiv);

      const canvas = await capturePage(pageDiv);
      const img = canvas.toDataURL('image/jpeg', 0.95);
      let w = contentWmm;
      let h = (canvas.height * contentWmm) / canvas.width;
      if (h > contentHmm) {
        const s = contentHmm / h;
        h = contentHmm;
        w = contentWmm * s;
      }
      if (pi > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', marginMm + (contentWmm - w) / 2, marginMm, w, h);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`${pi + 1} / ${pageClones.length}`, pageWmm / 2, pageHmm - 5, { align: 'center' });
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  } finally {
    iframe.remove();
  }
}
