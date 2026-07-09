import type { GlobalSupplier, SupplierCountryOption, SupplierListSettings, SupplierMergedLists, SupplierTag } from '../types/supplier';
import { SUPPLIER_CATEGORIES, COUNTRIES, DEFAULT_SUPPLIER_TAGS } from './supplierConstants';

export const emptySupplierListSettings = (): SupplierListSettings => ({
  extraCategories: [],
  removedCategories: [],
  extraCountries: [],
  removedCountryCodes: [],
  extraServiceTypes: [],
  removedServiceTypes: [],
  extraTags: [],
  removedTagLabels: [],
});

const norm = (s: string) => s.trim();
const uniq = (arr: string[]) => [...new Set(arr.map(norm).filter(Boolean))];

export function buildSupplierLists(
  settings?: SupplierListSettings | null,
  suppliers?: GlobalSupplier[],
): SupplierMergedLists {
  const s = settings || emptySupplierListSettings();
  const removedCat = new Set(s.removedCategories.map(norm));
  const removedCc = new Set(s.removedCountryCodes.map(c => c.toUpperCase()));
  const removedSvc = new Set(s.removedServiceTypes.map(norm));
  const removedTags = new Set(s.removedTagLabels.map(norm));

  const categories = uniq([
    ...SUPPLIER_CATEGORIES.filter(c => !removedCat.has(c)),
    ...s.extraCategories,
  ]);

  const builtinCountries: SupplierCountryOption[] = COUNTRIES
    .filter(c => !removedCc.has(c.code))
    .map(c => ({ code: c.code, name: c.name, flag: c.flag }));

  const extraCountries = s.extraCountries
    .filter(c => c.code && c.name)
    .map(c => ({
      code: c.code.toUpperCase(),
      name: norm(c.name),
      flag: c.flag || '🌍',
      custom: true,
    }));

  const countryMap = new Map<string, SupplierCountryOption>();
  [...builtinCountries, ...extraCountries].forEach(c => countryMap.set(c.code, c));
  const countries = [...countryMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const fromSuppliers = new Set<string>();
  suppliers?.forEach(sup => {
    sup.serviceTypes?.forEach(st => st && fromSuppliers.add(st));
    sup.supplierServices?.forEach(sv => sv.name && fromSuppliers.add(sv.name));
  });

  const serviceTypes = uniq([
    ...[...fromSuppliers].filter(st => !removedSvc.has(st)),
    ...s.extraServiceTypes.filter(st => !removedSvc.has(st)),
  ]).sort((a, b) => a.localeCompare(b));

  const defaultTags: SupplierTag[] = DEFAULT_SUPPLIER_TAGS
    .filter(t => !removedTags.has(t.label))
    .map((t, i) => ({ ...t, id: `def_tag_${i}` }));

  const extraTags = s.extraTags.filter(t => t.label && !removedTags.has(t.label));
  const tagMap = new Map<string, SupplierTag>();
  [...defaultTags, ...extraTags].forEach(t => tagMap.set(t.label, t));
  const tags = [...tagMap.values()];

  return { categories, countries, serviceTypes, tags };
}

export function resolveCountryFromList(
  countries: SupplierCountryOption[],
  codeOrName?: string,
): SupplierCountryOption {
  if (!codeOrName) return { code: '', name: '—', flag: '🌍' };
  const u = codeOrName.toUpperCase();
  const byCode = countries.find(c => c.code === u);
  if (byCode) return { ...byCode, flag: byCode.flag || '🌍' };
  const byName = countries.find(c => c.name.toLowerCase() === codeOrName.toLowerCase());
  if (byName) return { ...byName, flag: byName.flag || '🌍' };
  return { code: '', name: codeOrName, flag: '🌍' };
}

export function genCountryCode(name: string, existing: Set<string>): string {
  const base = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2) || 'X';
  let code = base;
  let n = 1;
  while (existing.has(code)) {
    code = `${base}${n}`;
    n++;
  }
  return code.slice(0, 6);
}
