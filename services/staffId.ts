import { Personnel } from '../types';

// Deterministic short code derived from a personnel id — always available, no migration needed.
const deriveStaffCode = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) >>> 0; }
  return 'ID-' + h.toString(36).toUpperCase().padStart(5, '0').slice(-5);
};

// The personnel "messaging ID" colleagues use to write to a person.
// Uses an explicit stored staffCode when set, otherwise a stable derived code.
export const getStaffCode = (p: Personnel): string =>
  (p.staffCode && p.staffCode.trim()) ? p.staffCode.trim().toUpperCase() : deriveStaffCode(p.id);

/** Human-readable label: «نام — آی‌دی» for selects, chips, and lists. */
export const formatPersonnelLabel = (p: Personnel, opts?: { withRole?: boolean }): string => {
  const code = getStaffCode(p);
  const role = opts?.withRole && p.roles?.[0] ? ` (${p.roles[0]})` : '';
  return `${p.fullName} — ${code}${role}`;
};

/** Resolve display for a stored personnel id (name + code). */
export const personnelLabelById = (personnel: Personnel[], id?: string): string => {
  if (!id) return '';
  const p = personnel.find(pp => pp.id === id);
  return p ? formatPersonnelLabel(p) : id;
};

/** Format multiple ids as «نام — آی‌دی» joined by comma. */
export const formatPersonnelIds = (personnel: Personnel[], ids: string[], joiner = '، '): string =>
  ids.map(id => {
    const p = personnel.find(pp => pp.id === id);
    return p ? formatPersonnelLabel(p) : id;
  }).join(joiner);

// Resolve a personnel by a typed code. Matches the staff code (case-insensitive),
// and falls back to username/email so it keeps working before codes are shared around.
export const findPersonnelByCode = (personnel: Personnel[], code: string): Personnel | undefined => {
  const c = code.trim().toUpperCase();
  if (!c) return undefined;
  return personnel.find(p => getStaffCode(p) === c)
    || personnel.find(p => (p.username || '').trim().toUpperCase() === c)
    || personnel.find(p => (p.email || '').trim().toUpperCase() === c);
};

/** Search by staff code, username, email, or full name (exact or unique partial). */
export const findPersonnelByQuery = (personnel: Personnel[], query: string): Personnel | undefined => {
  const q = query.trim();
  if (!q) return undefined;
  const byCode = findPersonnelByCode(personnel, q);
  if (byCode) return byCode;
  const lower = q.toLowerCase();
  const exact = personnel.find(p => p.fullName.trim().toLowerCase() === lower);
  if (exact) return exact;
  const partial = personnel.filter(p => p.fullName.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  return undefined;
};

/** Filter roster for dropdown/search — matches name, code, username, or email. */
export const filterPersonnelRoster = (personnel: Personnel[], query: string): Personnel[] => {
  const q = query.trim().toLowerCase();
  if (!q) return personnel;
  return personnel.filter(p => {
    const code = getStaffCode(p).toLowerCase();
    return p.fullName.toLowerCase().includes(q)
      || code.includes(q)
      || (p.username || '').toLowerCase().includes(q)
      || (p.email || '').toLowerCase().includes(q);
  });
};
