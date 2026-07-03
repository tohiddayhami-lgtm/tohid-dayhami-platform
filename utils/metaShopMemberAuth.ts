export function normalizeMemberUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function normalizeMemberPhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

export function memberLoginKey(shopId: string, username: string): string {
  return `${shopId}|${normalizeMemberUsername(username)}`;
}

export async function hashMemberPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyMemberPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const h = await hashMemberPassword(password, salt);
  return h === hash;
}

export function validateMemberUsername(username: string): string | null {
  const u = username.trim();
  if (u.length < 3) return 'short_username';
  if (u.length > 32) return 'long_username';
  if (!/^[\w.@+-]+$/i.test(u) && !/[\u0600-\u06FF]/.test(u)) return 'invalid_username';
  return null;
}

export function validateMemberPassword(password: string): string | null {
  if (password.length < 6) return 'short_password';
  if (password.length > 64) return 'long_password';
  return null;
}
