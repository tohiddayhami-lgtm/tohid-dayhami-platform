import type { SupplierStatus, SupplierProposalStatus, SupplierTag } from '../types/supplier';

export const SUPPLIER_CATEGORIES = [
  'Agriculture', 'Food', 'Packaging', 'Printing', 'Plastic', 'Polymer', 'Chemical',
  'Logistics', 'Shipping', 'Customs', 'Machinery', 'Construction', 'Electronics',
  'Medical', 'Textile', 'Furniture', 'Mining', 'Consulting', 'Marketing', 'IT', 'Finance', 'Others',
] as const;

export const SUPPLIER_STATUSES: SupplierStatus[] = [
  'active', 'inactive', 'prospect', 'negotiating', 'approved', 'rejected', 'blocked',
];

export const SUPPLIER_PROPOSAL_STATUSES: SupplierProposalStatus[] = [
  'new', 'under_review', 'negotiating', 'accepted', 'rejected', 'expired', 'archived',
];

export const DEFAULT_SUPPLIER_TAGS: Omit<SupplierTag, 'id'>[] = [
  { label: 'Top Supplier', color: '#f59e0b' },
  { label: 'Verified', color: '#10b981' },
  { label: 'Manufacturer', color: '#3b82f6' },
  { label: 'Factory', color: '#6366f1' },
  { label: 'Trader', color: '#8b5cf6' },
  { label: 'Exporter', color: '#0ea5e9' },
  { label: 'Importer', color: '#14b8a6' },
  { label: 'Packaging', color: '#f97316' },
  { label: 'Fast Response', color: '#22c55e' },
  { label: 'OEM', color: '#a855f7' },
  { label: 'ODM', color: '#ec4899' },
  { label: 'Premium', color: '#eab308' },
  { label: 'Gold', color: '#ca8a04' },
  { label: 'Silver', color: '#94a3b8' },
  { label: 'Bronze', color: '#b45309' },
  { label: 'VIP', color: '#dc2626' },
  { label: 'Urgent', color: '#ef4444' },
  { label: 'Favorite', color: '#f43f5e' },
  { label: 'Blacklisted', color: '#1f2937' },
  { label: 'Needs Follow-up', color: '#f59e0b' },
  { label: 'Partner', color: '#059669' },
];

/** ISO 3166-1 alpha-2 → country name + flag emoji */
export const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'CY', name: 'Cyprus', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgia', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
];

export const countryFlag = (codeOrName?: string) => {
  if (!codeOrName) return '🌍';
  const u = codeOrName.toUpperCase();
  const byCode = COUNTRIES.find(c => c.code === u);
  if (byCode) return byCode.flag;
  const byName = COUNTRIES.find(c => c.name.toLowerCase() === codeOrName.toLowerCase());
  return byName?.flag ?? '🌍';
};

export const countryName = (codeOrName?: string) => {
  if (!codeOrName) return '—';
  const byCode = COUNTRIES.find(c => c.code === codeOrName.toUpperCase());
  if (byCode) return byCode.name;
  const byName = COUNTRIES.find(c => c.name.toLowerCase() === codeOrName.toLowerCase());
  if (byName) return byName.name;
  return codeOrName;
};

export const resolveCountry = (codeOrName?: string) => {
  if (!codeOrName) return { code: '', name: '—', flag: '🌍' };
  const byCode = COUNTRIES.find(c => c.code === codeOrName.toUpperCase());
  if (byCode) return byCode;
  const byName = COUNTRIES.find(c => c.name.toLowerCase() === codeOrName.toLowerCase());
  if (byName) return byName;
  return { code: '', name: codeOrName, flag: '🌍' };
};

export const STATUS_LABELS: Record<SupplierStatus, { en: string; fa: string; color: string }> = {
  active: { en: 'Active', fa: 'فعال', color: 'bg-emerald-100 text-emerald-700' },
  inactive: { en: 'Inactive', fa: 'غیرفعال', color: 'bg-gray-100 text-gray-600' },
  prospect: { en: 'Prospect', fa: 'بالقوه', color: 'bg-blue-100 text-blue-700' },
  negotiating: { en: 'Negotiating', fa: 'در مذاکره', color: 'bg-amber-100 text-amber-700' },
  approved: { en: 'Approved', fa: 'تأیید شده', color: 'bg-green-100 text-green-700' },
  rejected: { en: 'Rejected', fa: 'رد شده', color: 'bg-red-100 text-red-700' },
  blocked: { en: 'Blocked', fa: 'مسدود', color: 'bg-red-200 text-red-800' },
};

export const PROPOSAL_STATUS_LABELS: Record<SupplierProposalStatus, { en: string; fa: string; color: string }> = {
  new: { en: 'New', fa: 'جدید', color: 'bg-blue-100 text-blue-700' },
  under_review: { en: 'Under Review', fa: 'در بررسی', color: 'bg-indigo-100 text-indigo-700' },
  negotiating: { en: 'Negotiating', fa: 'مذاکره', color: 'bg-amber-100 text-amber-700' },
  accepted: { en: 'Accepted', fa: 'پذیرفته', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { en: 'Rejected', fa: 'رد شده', color: 'bg-red-100 text-red-700' },
  expired: { en: 'Expired', fa: 'منقضی', color: 'bg-gray-100 text-gray-600' },
  archived: { en: 'Archived', fa: 'بایگانی', color: 'bg-slate-100 text-slate-600' },
};
