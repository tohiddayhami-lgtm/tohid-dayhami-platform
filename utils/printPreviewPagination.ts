/** Shared A4 pagination logic for bilingual doc preview + PDF export. */

export const PAGE_W = 794;
export const PAGE_H = 1123;
export const PAD = 28;
/** Tighter content height = pack more onto each page (less empty bottom). */
export const CONTENT_H = PAGE_H - PAD * 2 - 8;

export function splitSection(section: HTMLElement): HTMLElement[] {
  const units: HTMLElement[] = [];
  const children = Array.from(section.children) as HTMLElement[];
  let i = 0;
  while (i < children.length) {
    const el = children[i];
    if (el.classList.contains('pp-band') || el.classList.contains('pp-service-card')) {
      units.push(el);
      i++;
      continue;
    }
    // Keep each body / bullet / intro block as its own packable unit so pages fill denser.
    if (
      el.classList.contains('pp-body-en')
      || el.classList.contains('pp-body-rtl')
      || el.classList.contains('pp-bullet-en')
      || el.classList.contains('pp-bullet-rtl')
      || el.classList.contains('pp-area-intro-en')
      || el.classList.contains('pp-area-intro-rtl')
    ) {
      units.push(el);
      i++;
      continue;
    }
    const group: HTMLElement[] = [el];
    i++;
    while (
      i < children.length
      && !children[i].classList.contains('pp-band')
      && !children[i].classList.contains('pp-service-card')
      && !children[i].classList.contains('pp-body-en')
      && !children[i].classList.contains('pp-body-rtl')
      && !children[i].classList.contains('pp-bullet-en')
      && !children[i].classList.contains('pp-bullet-rtl')
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

export function packPageGroups(units: HTMLElement[], heights: number[]): HTMLElement[][] {
  const pages: HTMLElement[][] = [];
  let cur: HTMLElement[] = [];
  let used = 0;

  units.forEach((unit, idx) => {
    const h = heights[idx] || 0;

    if (unit.classList.contains('pp-force-page-break') && cur.length) {
      pages.push(cur);
      cur = [];
      used = 0;
    }

    if (h > CONTENT_H) {
      if (cur.length) { pages.push(cur); cur = []; used = 0; }
      pages.push([unit]);
      return;
    }
    if (cur.length && used + h > CONTENT_H) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(unit);
    used += h;
  });
  if (cur.length) pages.push(cur);
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
