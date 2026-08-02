/** Shared A4 pagination logic for bilingual doc preview + PDF export. */

export const PAGE_W = 794;
export const PAGE_H = 1123;
export const PAD = 28;
/** Tighter content height = pack more onto each page (less empty bottom). */
export const CONTENT_H = PAGE_H - PAD * 2 - 8;

function isBandEl(el: HTMLElement): boolean {
  return el.classList.contains('pp-band');
}

function isAtomicContent(el: HTMLElement): boolean {
  return (
    el.classList.contains('pp-body-en')
    || el.classList.contains('pp-body-rtl')
    || el.classList.contains('pp-bullet-en')
    || el.classList.contains('pp-bullet-rtl')
    || el.classList.contains('pp-area-intro-en')
    || el.classList.contains('pp-area-intro-rtl')
    || el.classList.contains('pp-service-card')
    || el.classList.contains('pp-re-hero')
    || el.classList.contains('pp-gallery-item')
    || el.tagName === 'TABLE'
  );
}

/** Band/title must never sit alone at page bottom — glue to the first content under it. */
function wrapBandWithLead(band: HTMLElement, lead?: HTMLElement): HTMLElement {
  if (!lead) return band;
  const wrap = document.createElement('div');
  wrap.className = 'pp-band-with-lead';
  wrap.appendChild(band.cloneNode(true));
  wrap.appendChild(lead.cloneNode(true));
  return wrap;
}

export function splitSection(section: HTMLElement): HTMLElement[] {
  const units: HTMLElement[] = [];
  const children = Array.from(section.children) as HTMLElement[];
  let i = 0;
  while (i < children.length) {
    const el = children[i];

    // Title band + first text/table/card under it stay on the same page.
    if (isBandEl(el)) {
      const next = i + 1 < children.length && !isBandEl(children[i + 1])
        ? children[i + 1]
        : undefined;
      if (next?.classList.contains('pp-gallery')) {
        const items = Array.from(next.children) as HTMLElement[];
        const first = items[0];
        units.push(wrapBandWithLead(el, first || next));
        items.slice(1).forEach(item => units.push(item));
        i += 2;
        continue;
      }
      units.push(wrapBandWithLead(el, next));
      i += next ? 2 : 1;
      continue;
    }

    if (el.classList.contains('pp-gallery')) {
      units.push(...(Array.from(el.children) as HTMLElement[]));
      i++;
      continue;
    }

    if (el.classList.contains('pp-gallery-item') || el.classList.contains('pp-re-hero')) {
      units.push(el);
      i++;
      continue;
    }

    if (el.classList.contains('pp-service-card')) {
      units.push(el);
      i++;
      continue;
    }

    if (isAtomicContent(el)) {
      units.push(el);
      i++;
      continue;
    }

    const group: HTMLElement[] = [el];
    i++;
    while (
      i < children.length
      && !isBandEl(children[i])
      && !children[i].classList.contains('pp-service-card')
      && !isAtomicContent(children[i])
    ) {
      group.push(children[i]);
      i++;
    }
    if (group.length === 1) {
      units.push(group[0]);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'pp-section-part';
      group.forEach(n => wrap.appendChild(n.cloneNode(true)));
      units.push(wrap);
    }
  }
  return units;
}

export function groupPreviewUnits(root: HTMLElement): HTMLElement[] {
  const kids = Array.from(root.children).filter(el => el.tagName !== 'STYLE') as HTMLElement[];
  const units: HTMLElement[] = [];
  let i = 0;

  while (i < kids.length && !kids[i].classList.contains('pp-band') && !kids[i].classList.contains('pp-section')) {
    units.push(kids[i]);
    i++;
  }

  while (i < kids.length) {
    const el = kids[i];
    if (el.classList.contains('pp-band')) {
      const bandUnit: HTMLElement[] = [el];
      i++;
      if (i < kids.length && kids[i].tagName === 'TABLE') {
        bandUnit.push(kids[i]);
        i++;
      }
      const wrap = document.createElement('div');
      wrap.className = 'pp-unit-wrap';
      bandUnit.forEach(n => wrap.appendChild(n.cloneNode(true)));
      units.push(wrap);
      continue;
    }
    if (el.classList.contains('pp-section')) {
      const forceBreak = el.classList.contains('pp-force-page-break');
      const parts = splitSection(el);
      if (forceBreak && parts.length) {
        parts[0].classList.add('pp-force-page-break');
      }
      units.push(...parts);
      i++;
      continue;
    }
    units.push(el);
    i++;
  }
  return units;
}

export function measureUnitHeight(el: HTMLElement): number {
  return el.getBoundingClientRect().height + 2;
}

function isBandLikeUnit(unit: HTMLElement): boolean {
  if (unit.classList.contains('pp-band') || unit.classList.contains('pp-band-with-lead')) return true;
  if (unit.classList.contains('pp-unit-wrap')) {
    const kids = Array.from(unit.children) as HTMLElement[];
    return kids.length > 0 && isBandEl(kids[0]) && kids.length === 1;
  }
  return false;
}

/**
 * Pack units into pages. Prevents orphan section titles: a band never stays
 * alone at the bottom of a page when its following content did not fit.
 */
export function packPageGroups(units: HTMLElement[], heights: number[]): HTMLElement[][] {
  const pages: HTMLElement[][] = [];
  let cur: HTMLElement[] = [];
  let used = 0;

  const flush = () => {
    if (cur.length) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
  };

  units.forEach((unit, idx) => {
    const h = heights[idx] || 0;
    const nextH = idx + 1 < units.length ? (heights[idx + 1] || 0) : 0;
    const hasNext = idx + 1 < units.length;

    if (unit.classList.contains('pp-force-page-break') && cur.length) {
      flush();
    }

    if (h > CONTENT_H) {
      flush();
      pages.push([unit]);
      return;
    }

    // Orphan-title guard: if this is a lone band and the next block won't fit
    // after it on the current page, start a new page before the title.
    if (
      isBandLikeUnit(unit)
      && hasNext
      && !isBandLikeUnit(units[idx + 1])
      && cur.length
      && used + h + Math.min(nextH, 120) > CONTENT_H
    ) {
      flush();
    }

    if (cur.length && used + h > CONTENT_H) {
      flush();
    }

    cur.push(unit);
    used += h;
  });

  flush();
  return pages.length ? pages : [units];
}

export function paginateRootElement(root: HTMLElement): HTMLElement[][] {
  const flatUnits = groupPreviewUnits(root);
  if (!flatUnits.length) return [[]];

  const measureMount = document.createElement('div');
  measureMount.className = 'pp-root';
  measureMount.style.cssText = `width:${PAGE_W}px;padding:${PAD}px;box-sizing:border-box;background:#fff;position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;`;

  const styleEl = root.querySelector('style');
  if (styleEl) measureMount.appendChild(styleEl.cloneNode(true));

  flatUnits.forEach(u => measureMount.appendChild(u.cloneNode(true)));
  document.body.appendChild(measureMount);

  const styleOffset = styleEl ? 1 : 0;
  const heights = flatUnits.map((_, idx) => {
    const child = measureMount.children[idx + styleOffset] as HTMLElement;
    return child ? measureUnitHeight(child) : 0;
  });

  document.body.removeChild(measureMount);
  return packPageGroups(flatUnits, heights);
}
