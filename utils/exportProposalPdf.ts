import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** A4 content width at 96dpi — matches on-screen proposal preview. */
export const PROPOSAL_CAPTURE_WIDTH_PX = 794;

/** Usable content height on A4 with margins (px at 96dpi). */
const PAGE_CONTENT_HEIGHT_PX = 1040;
const PAGE_MARGIN_MM = 10;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

type Block = HTMLElement;

function pageCss(sourceCss: string): string {
  return `
    ${sourceCss}
    .pp-pdf-page {
      width: ${PROPOSAL_CAPTURE_WIDTH_PX}px;
      min-height: ${PAGE_CONTENT_HEIGHT_PX}px;
      max-width: ${PROPOSAL_CAPTURE_WIDTH_PX}px;
      margin: 0;
      padding: 28px 32px 36px;
      box-sizing: border-box;
      background: #ffffff;
      direction: ltr !important;
      text-align: left !important;
      overflow: hidden;
      position: relative;
    }
    .pp-pdf-page .pp-root {
      max-width: none !important;
      width: 100% !important;
      margin: 0 !important;
    }
    .pp-pdf-page .pp-body-en {
      text-align: justify !important;
      direction: ltr !important;
      text-align-last: left;
    }
    .pp-pdf-page .pp-body-rtl {
      text-align: justify !important;
      direction: rtl !important;
      text-align-last: right;
    }
  `;
}

/** Top-level blocks that must stay together on one page when possible. */
function extractBlocks(source: HTMLElement): Block[] {
  const root = source.cloneNode(true) as HTMLElement;
  root.querySelectorAll('style').forEach(s => s.remove());

  const blocks: Block[] = [];
  const children = Array.from(root.children) as HTMLElement[];

  // Group: logos + title + meta bars as one header block
  const header = document.createElement('div');
  header.className = 'pp-pdf-header-block';
  let i = 0;
  while (i < children.length) {
    const el = children[i];
    const cls = el.className || '';
    if (
      cls.includes('pp-logos')
      || cls.includes('pp-title-block')
      || cls.includes('pp-meta-bar')
      || cls.includes('pp-meta-sub')
    ) {
      header.appendChild(el.cloneNode(true));
      i++;
      continue;
    }
    break;
  }
  if (header.childNodes.length) blocks.push(header);

  // Parties: band + table together
  while (i < children.length) {
    const el = children[i];
    const cls = el.className || '';
    if (cls.includes('pp-band') && i + 1 < children.length && (children[i + 1].className || '').includes('pp-parties-table')) {
      const wrap = document.createElement('div');
      wrap.className = 'pp-pdf-parties-block';
      wrap.appendChild(el.cloneNode(true));
      wrap.appendChild(children[i + 1].cloneNode(true));
      blocks.push(wrap);
      i += 2;
      continue;
    }
    if (cls.includes('pp-section')) {
      blocks.push(el.cloneNode(true) as HTMLElement);
      i++;
      continue;
    }
    if (cls.includes('pp-foot')) {
      blocks.push(el.cloneNode(true) as HTMLElement);
      i++;
      continue;
    }
    // skip unknown
    i++;
  }

  return blocks;
}

function measureHeight(el: HTMLElement, host: HTMLElement): number {
  const probe = el.cloneNode(true) as HTMLElement;
  probe.style.visibility = 'hidden';
  host.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  return h;
}

function packPages(blocks: Block[], host: HTMLElement): HTMLElement[][] {
  const pages: HTMLElement[][] = [];
  let current: HTMLElement[] = [];
  let used = 0;
  const pad = 64; // page padding allowance

  const pushPage = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };

  for (const block of blocks) {
    const h = measureHeight(block, host);
    const limit = PAGE_CONTENT_HEIGHT_PX - pad;

    // Oversized block: put alone on its own page(s) — still one block per page start
    if (h > limit) {
      pushPage();
      current.push(block);
      pushPage();
      continue;
    }

    if (used > 0 && used + h > limit) {
      pushPage();
    }
    current.push(block);
    used += h + 8;
  }
  pushPage();
  return pages.filter(p => p.length > 0);
}

function applyCloneTextFixes(node: HTMLElement) {
  node.style.width = `${PROPOSAL_CAPTURE_WIDTH_PX}px`;
  node.style.background = '#ffffff';
  node.style.direction = 'ltr';
  node.querySelectorAll('.pp-body-en').forEach(b => {
    const e = b as HTMLElement;
    e.style.direction = 'ltr';
    e.style.textAlign = 'justify';
    e.style.unicodeBidi = 'isolate';
  });
  node.querySelectorAll('.pp-body-rtl').forEach(b => {
    const e = b as HTMLElement;
    e.style.direction = 'rtl';
    e.style.textAlign = 'justify';
    e.style.unicodeBidi = 'isolate';
    e.style.fontFamily = 'Tahoma, Arial, sans-serif';
  });
  node.querySelectorAll('.pp-foot .rtl, .rtl-title, .rtl-sub, .co-rtl, .num-rtl, .row-rtl, .pkg-rtl, .pp-band .r, .rtl-block').forEach(b => {
    const e = b as HTMLElement;
    e.style.direction = 'rtl';
    e.style.unicodeBidi = 'isolate';
    e.style.fontFamily = 'Tahoma, Arial, sans-serif';
  });
}

async function capturePage(pageEl: HTMLElement, foreignObject: boolean): Promise<HTMLCanvasElement> {
  await (document.fonts?.ready ?? Promise.resolve());
  await new Promise(r => setTimeout(r, 80));

  return html2canvas(pageEl, {
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
    // foreignObjectRendering keeps Arabic/Persian glyphs intact in supporting browsers
    foreignObjectRendering: foreignObject,
    onclone: (_doc, el) => applyCloneTextFixes(el as HTMLElement),
  });
}

/**
 * Export the on-screen proposal preview to a clean multi-page A4 PDF.
 * Renders each page as a full DOM page (no mid-paragraph image slicing).
 */
export async function exportProposalPdf(element: HTMLElement, filename: string): Promise<void> {
  const sourceCss = element.querySelector('style')?.textContent || '';

  const host = document.createElement('div');
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
    transform: 'translateX(-140vw)',
  });

  const styleEl = document.createElement('style');
  styleEl.textContent = pageCss(sourceCss);
  host.appendChild(styleEl);

  // Measure host for packing
  const measureHost = document.createElement('div');
  measureHost.className = 'pp-pdf-page';
  measureHost.style.width = `${PROPOSAL_CAPTURE_WIDTH_PX}px`;
  host.appendChild(measureHost);

  document.body.appendChild(host);

  try {
    const blocks = extractBlocks(element);
    // Filter empty add-on sections: section with only empty addon table
    const filtered = blocks.filter(b => {
      if (!b.classList.contains('pp-section')) return true;
      const addonTable = b.querySelector('.pp-addon-table');
      if (!addonTable) return true;
      const cells = Array.from(addonTable.querySelectorAll('tbody td.pkg-en, tbody .pkg-en'));
      // if addon section has no real names, drop it
      const hasContent = Array.from(addonTable.querySelectorAll('tbody tr')).some(tr => {
        const text = (tr.textContent || '').replace(/[0\s✓OMR]/g, '');
        return text.length > 2;
      });
      return hasContent || !addonTable;
    });

    const pages = packPages(filtered.length ? filtered : blocks, measureHost);
    measureHost.remove();

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const contentW = A4_WIDTH_MM - PAGE_MARGIN_MM * 2;
    const contentH = A4_HEIGHT_MM - PAGE_MARGIN_MM * 2 - 8;

    for (let i = 0; i < pages.length; i++) {
      const pageEl = document.createElement('div');
      pageEl.className = 'pp-pdf-page';
      const inner = document.createElement('div');
      inner.className = 'pp-root';
      inner.setAttribute('dir', 'ltr');
      pages[i].forEach(b => inner.appendChild(b.cloneNode(true)));
      pageEl.appendChild(inner);
      host.appendChild(pageEl);

      let canvas: HTMLCanvasElement;
      try {
        canvas = await capturePage(pageEl, true);
        // Fallback if foreignObject produced a blank/near-blank page
        const probe = canvas.getContext('2d')?.getImageData(8, 8, 4, 4).data;
        const blank = probe && probe[0] === 255 && probe[1] === 255 && probe[2] === 255 && probe[3] === 255;
        if (blank && canvas.height > 100) {
          canvas = await capturePage(pageEl, false);
        }
      } catch {
        canvas = await capturePage(pageEl, false);
      }
      pageEl.remove();

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      let imgW = contentW;
      let imgH = (canvas.height * contentW) / canvas.width;
      if (imgH > contentH) {
        const s = contentH / imgH;
        imgH = contentH;
        imgW = contentW * s;
      }

      if (i > 0) pdf.addPage();
      const x = PAGE_MARGIN_MM + (contentW - imgW) / 2;
      pdf.addImage(imgData, 'JPEG', x, PAGE_MARGIN_MM, imgW, imgH);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(`${i + 1} / ${pages.length}`, A4_WIDTH_MM / 2, A4_HEIGHT_MM - 6, { align: 'center' });
    }

    pdf.save(filename);
  } finally {
    host.remove();
  }
}
