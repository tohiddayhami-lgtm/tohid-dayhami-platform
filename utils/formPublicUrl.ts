import type { CustomForm } from '../types';

/** URL-safe English slug from the form's English (or Persian) title. */
export function slugifyFormName(s: string): string {
  const ascii = String(s || '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return ascii || 'form';
}

export function formSlug(form: Pick<CustomForm, 'id' | 'title' | 'titleEn' | 'slug'>): string {
  if (form.slug?.trim()) return form.slug.trim();
  const fromEn = slugifyFormName(form.titleEn || '');
  if (fromEn !== 'form') return fromEn;
  const fromTitle = slugifyFormName(form.title || '');
  if (fromTitle !== 'form') return fromTitle;
  return slugifyFormName(form.id || 'form');
}

export function formPublicPath(form: Pick<CustomForm, 'id' | 'title' | 'titleEn' | 'slug' | 'kind'>): string {
  if (form.kind === 'html') return `/f/${formSlug(form)}`;
  if (form.kind === 'pack') return `/p/${formSlug(form)}/`;
  return `/?form=${encodeURIComponent(form.id)}`;
}

export function uniqueFormSlug(
  base: string,
  forms: Pick<CustomForm, 'id' | 'slug'>[],
  selfId?: string,
): string {
  const root = slugifyFormName(base);
  const taken = new Set(
    forms.filter(f => f.id !== selfId).map(f => (f.slug || '').toLowerCase()).filter(Boolean),
  );
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
