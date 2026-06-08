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

// Resolve a personnel by a typed code. Matches the staff code (case-insensitive),
// and falls back to username/email so it keeps working before codes are shared around.
export const findPersonnelByCode = (personnel: Personnel[], code: string): Personnel | undefined => {
  const c = code.trim().toUpperCase();
  if (!c) return undefined;
  return personnel.find(p => getStaffCode(p) === c)
    || personnel.find(p => (p.username || '').trim().toUpperCase() === c)
    || personnel.find(p => (p.email || '').trim().toUpperCase() === c);
};
