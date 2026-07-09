import type { GlobalSupplier, SupplierListFilters } from '../types/supplier';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export function filterSuppliers(list: GlobalSupplier[], f: SupplierListFilters): GlobalSupplier[] {
  const q = f.search.trim().toLowerCase();
  let out = list.filter(s => !s.deletedAt);

  if (q) {
    out = out.filter(s =>
      s.companyName.toLowerCase().includes(q)
      || (s.contactPerson || '').toLowerCase().includes(q)
      || (s.email || '').toLowerCase().includes(q)
      || (s.phone || '').includes(q)
      || (s.general.city || '').toLowerCase().includes(q)
      || (s.general.country || '').toLowerCase().includes(q)
      || (s.productCategory || '').toLowerCase().includes(q)
      || s.tags.some(t => t.label.toLowerCase().includes(q))
      || s.supplierServices.some(sv => sv.name.toLowerCase().includes(q)),
    );
  }

  if (f.countries.length) {
    out = out.filter(s => f.countries.some(c =>
      s.general.country === c || s.general.countryCode === c,
    ));
  }

  if (f.categories.length) {
    out = out.filter(s => f.categories.includes(s.productCategory || ''));
  }

  if (f.serviceTypes.length) {
    out = out.filter(s =>
      f.serviceTypes.some(st =>
        s.serviceTypes?.includes(st)
        || s.supplierServices.some(sv => sv.name === st || sv.category === st),
      ),
    );
  }

  if (f.statuses.length) {
    out = out.filter(s => f.statuses.includes(s.status));
  }

  if (f.tags.length) {
    out = out.filter(s => f.tags.every(t => s.tags.some(st => st.label === t || st.id === t)));
  }

  if (f.minRating != null && f.minRating > 0) {
    out = out.filter(s => (s.rating ?? 0) >= f.minRating);
  }

  if (f.minScore != null && f.minScore > 0) {
    out = out.filter(s => {
      const sc = s.score ?? s.rating ?? 0;
      return sc >= f.minScore!;
    });
  }

  if (f.favoriteOnly) {
    out = out.filter(s => s.flags.favorite || s.flags.pinned);
  }

  if (f.topOnly) {
    out = out.filter(s => s.flags.topSupplier);
  }

  if (f.recentlyAdded) {
    const cutoff = daysAgo(30);
    out = out.filter(s => s.createdAt >= cutoff);
  }

  if (f.lastContactAfter) {
    out = out.filter(s => s.lastContact && s.lastContact >= f.lastContactAfter!);
  }

  if (f.lastContactBefore) {
    out = out.filter(s => s.lastContact && s.lastContact <= f.lastContactBefore!);
  }

  return out.sort((a, b) => {
    if (a.flags.pinned && !b.flags.pinned) return -1;
    if (!a.flags.pinned && b.flags.pinned) return 1;
    if (a.flags.favorite && !b.flags.favorite) return -1;
    if (!a.flags.favorite && b.flags.favorite) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; pages: number } {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, pages };
}

export type SupplierColumnKey =
  | 'companyName' | 'contactPerson' | 'country' | 'city' | 'productCategory'
  | 'services' | 'email' | 'phone' | 'whatsapp' | 'website' | 'status'
  | 'rating' | 'score' | 'tags' | 'lastContact' | 'createdAt' | 'notes';

export const DEFAULT_COLUMNS: SupplierColumnKey[] = [
  'companyName', 'contactPerson', 'country', 'city', 'productCategory', 'services',
  'email', 'phone', 'whatsapp', 'website', 'status', 'rating', 'score', 'tags',
  'lastContact', 'createdAt', 'notes',
];

export const COLUMN_LABELS: Record<SupplierColumnKey, { en: string; fa: string }> = {
  companyName: { en: 'Company', fa: 'شرکت' },
  contactPerson: { en: 'Contact', fa: 'تماس' },
  country: { en: 'Country', fa: 'کشور' },
  city: { en: 'City', fa: 'شهر' },
  productCategory: { en: 'Category', fa: 'دسته' },
  services: { en: 'Services', fa: 'خدمات' },
  email: { en: 'Email', fa: 'ایمیل' },
  phone: { en: 'Phone', fa: 'تلفن' },
  whatsapp: { en: 'WhatsApp', fa: 'واتساپ' },
  website: { en: 'Website', fa: 'وب‌سایت' },
  status: { en: 'Status', fa: 'وضعیت' },
  rating: { en: 'Rating', fa: 'امتیاز' },
  score: { en: 'Score', fa: 'نمره' },
  tags: { en: 'Tags', fa: 'برچسب' },
  lastContact: { en: 'Last Contact', fa: 'آخرین تماس' },
  createdAt: { en: 'Created', fa: 'تاریخ ایجاد' },
  notes: { en: 'Notes', fa: 'یادداشت' },
};
