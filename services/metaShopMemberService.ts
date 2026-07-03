import { collection, getDocs, query, where, setDoc, doc as fdoc, getDoc } from 'firebase/firestore';
import type { MetaShopMember, MetaShopOrder } from '../types';
import {
  hashMemberPassword,
  memberLoginKey,
  normalizeMemberPhone,
  normalizeMemberUsername,
  verifyMemberPassword,
  validateMemberPassword,
  validateMemberUsername,
} from '../utils/metaShopMemberAuth';
import { db, sanitizeData } from './firebaseService';

const COL = 'metaShopMembers';
const ORDERS_COL = 'metaShopOrders';

type ProxyOpts = { doc?: string; whereField?: string; whereEq?: string; all?: boolean; orderField?: string; dir?: 'asc' | 'desc' };

const PROXY_LS_KEY = '_iran_proxy_v2';

async function isProxy(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(PROXY_LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { v?: string; ts?: number };
      if (p.ts && Date.now() - p.ts < 6 * 60 * 60 * 1000) return p.v === '1';
    }
  } catch { /* ignore */ }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    await fetch(
      'https://firestore.googleapis.com/v1/projects/company-crm-103aa/databases/(default)/documents/settings/appConfig?key=AIzaSyBK5nSP_2RPtL2puqd_3y06zJeDPv3Ueoc',
      { signal: controller.signal },
    );
    clearTimeout(timer);
    return false;
  } catch {
    return true;
  }
}

async function proxyGet<T>(col: string, opts: ProxyOpts = {}): Promise<T> {
  const p = new URLSearchParams({ col });
  if (opts.doc) p.set('doc', opts.doc);
  if (opts.whereField && opts.whereEq) {
    p.set('whereField', opts.whereField);
    p.set('whereEq', opts.whereEq);
    if (opts.all) p.set('all', '1');
  }
  if (opts.orderField) {
    p.set('orderField', opts.orderField);
    if (opts.dir) p.set('dir', opts.dir);
  }
  const r = await fetch(`/api/fb?${p}`);
  if (!r.ok) throw new Error(`Proxy ${r.status}`);
  return r.json() as Promise<T>;
}

async function proxyWrite(col: string, id: string, data: unknown): Promise<void> {
  const r = await fetch(`/api/fb?col=${encodeURIComponent(col)}&doc=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitizeData(data)),
  });
  if (!r.ok) throw new Error(`Proxy write ${r.status}`);
}

async function writeMember(member: MetaShopMember): Promise<void> {
  const payload = sanitizeData(member);
  if (await isProxy()) await proxyWrite(COL, member.id, payload);
  else await setDoc(fdoc(db, COL, member.id), payload);
}

export async function fetchMetaShopMemberById(id: string): Promise<MetaShopMember | null> {
  try {
    if (await isProxy()) {
      const row = await proxyGet<MetaShopMember | null>(COL, { doc: id });
      return row?.id ? row : null;
    }
    const snap = await getDoc(fdoc(db, COL, id));
    return snap.exists() ? (snap.data() as MetaShopMember) : null;
  } catch {
    return null;
  }
}

export async function findMetaShopMemberByLoginKey(loginKey: string): Promise<MetaShopMember | null> {
  try {
    if (await isProxy()) {
      const rows = await proxyGet<MetaShopMember[]>(COL, { whereField: 'loginKey', whereEq: loginKey, all: true });
      const hit = Array.isArray(rows) ? rows[0] : null;
      return hit?.id ? hit : null;
    }
    const q = query(collection(db, COL), where('loginKey', '==', loginKey));
    const snap = await getDocs(q);
    return snap.docs.length ? (snap.docs[0].data() as MetaShopMember) : null;
  } catch {
    return null;
  }
}

export async function fetchMetaShopMembersByShop(shopId: string): Promise<MetaShopMember[]> {
  try {
    let rows: MetaShopMember[] = [];
    if (await isProxy()) {
      const all = await proxyGet<MetaShopMember[]>(COL, { whereField: 'shopId', whereEq: shopId, all: true });
      rows = Array.isArray(all) ? all : [];
    } else {
      const q = query(collection(db, COL), where('shopId', '==', shopId));
      const snap = await getDocs(q);
      rows = snap.docs.map(d => d.data() as MetaShopMember);
    }
    return rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch {
    return [];
  }
}

/** Admin — all members (for per-shop counts on manager list). */
export async function fetchAllMetaShopMembers(): Promise<MetaShopMember[]> {
  try {
    if (await isProxy()) {
      const rows = await proxyGet<MetaShopMember[]>(COL, { orderField: 'createdAt', dir: 'desc' });
      return Array.isArray(rows) ? rows : [];
    }
    const snap = await getDocs(collection(db, COL));
    return snap.docs
      .map(d => d.data() as MetaShopMember)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch {
    return [];
  }
}

export async function updateMetaShopMemberAdmin(
  member: MetaShopMember,
  updates: Partial<Pick<MetaShopMember, 'isVip' | 'vipDiscountPercent' | 'vipNote' | 'isActive'>>,
): Promise<MetaShopMember> {
  const next: MetaShopMember = {
    ...member,
    ...updates,
    vipDiscountPercent: updates.vipDiscountPercent != null && updates.vipDiscountPercent > 0
      ? Math.min(100, updates.vipDiscountPercent)
      : (updates.vipDiscountPercent === 0 ? undefined : member.vipDiscountPercent),
    vipNote: updates.vipNote?.trim() || member.vipNote,
  };
  if (updates.isVip === false) {
    next.vipDiscountPercent = undefined;
  }
  await writeMember(next);
  return next;
}

export function summarizeMetaShopMembers(members: MetaShopMember[]) {
  const total = members.length;
  const vip = members.filter(m => m.isVip).length;
  const active = members.filter(m => m.isActive !== false).length;
  return { total, vip, active };
}

export async function findMetaShopMembersByPhone(shopId: string, phone: string): Promise<MetaShopMember[]> {
  const ph = normalizeMemberPhone(phone);
  if (!ph) return [];
  try {
    let rows: MetaShopMember[] = [];
    if (await isProxy()) {
      const all = await proxyGet<MetaShopMember[]>(COL, { whereField: 'shopId', whereEq: shopId, all: true });
      rows = Array.isArray(all) ? all : [];
    } else {
      const q = query(collection(db, COL), where('shopId', '==', shopId));
      const snap = await getDocs(q);
      rows = snap.docs.map(d => d.data() as MetaShopMember);
    }
    return rows.filter(m => normalizeMemberPhone(m.phone) === ph && m.isActive !== false);
  } catch {
    return [];
  }
}

export type MemberAuthError =
  | 'username_taken'
  | 'phone_taken'
  | 'invalid_credentials'
  | 'account_disabled'
  | 'short_username'
  | 'long_username'
  | 'invalid_username'
  | 'short_password'
  | 'long_password'
  | 'phone_mismatch'
  | 'not_found'
  | 'incomplete';

export async function registerMetaShopMember(input: {
  shopId: string;
  username: string;
  password: string;
  fullName: string;
  phone: string;
  email?: string;
  company?: string;
  country?: string;
  city?: string;
}): Promise<MetaShopMember> {
  const username = normalizeMemberUsername(input.username);
  const userErr = validateMemberUsername(username);
  if (userErr) throw new Error(userErr);
  const passErr = validateMemberPassword(input.password);
  if (passErr) throw new Error(passErr);
  if (!input.fullName.trim() || !normalizeMemberPhone(input.phone)) throw new Error('incomplete');

  const loginKey = memberLoginKey(input.shopId, username);
  if (await findMetaShopMemberByLoginKey(loginKey)) throw new Error('username_taken');

  const phoneMembers = await findMetaShopMembersByPhone(input.shopId, input.phone);
  if (phoneMembers.length) throw new Error('phone_taken');

  const id = `msm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const passwordHash = await hashMemberPassword(input.password, id);
  const member: MetaShopMember = {
    id,
    shopId: input.shopId,
    username,
    passwordHash,
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || undefined,
    company: input.company?.trim() || undefined,
    country: input.country?.trim() || undefined,
    city: input.city?.trim() || undefined,
    favoriteProductIds: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    loginKey,
  };
  await writeMember(member);
  return member;
}

export async function loginMetaShopMember(shopId: string, username: string, password: string): Promise<MetaShopMember> {
  const loginKey = memberLoginKey(shopId, username);
  const member = await findMetaShopMemberByLoginKey(loginKey);
  if (!member || member.shopId !== shopId) throw new Error('invalid_credentials');
  if (member.isActive === false) throw new Error('account_disabled');
  const ok = await verifyMemberPassword(password, member.id, member.passwordHash);
  if (!ok) throw new Error('invalid_credentials');
  const updated = { ...member, lastLoginAt: new Date().toISOString() };
  await writeMember(updated);
  return updated;
}

export async function recoverMetaShopMemberPassword(
  shopId: string,
  username: string,
  phone: string,
  newPassword: string,
): Promise<void> {
  const passErr = validateMemberPassword(newPassword);
  if (passErr) throw new Error(passErr);
  const loginKey = memberLoginKey(shopId, username);
  const member = await findMetaShopMemberByLoginKey(loginKey);
  if (!member) throw new Error('not_found');
  if (normalizeMemberPhone(member.phone) !== normalizeMemberPhone(phone)) throw new Error('phone_mismatch');
  const passwordHash = await hashMemberPassword(newPassword, member.id);
  await writeMember({ ...member, passwordHash });
}

export async function updateMetaShopMemberProfile(
  member: MetaShopMember,
  updates: Partial<Pick<MetaShopMember, 'fullName' | 'email' | 'company' | 'country' | 'city'>>,
): Promise<MetaShopMember> {
  const next = {
    ...member,
    fullName: updates.fullName?.trim() || member.fullName,
    email: updates.email?.trim() || undefined,
    company: updates.company?.trim() || undefined,
    country: updates.country?.trim() || undefined,
    city: updates.city?.trim() || undefined,
  };
  await writeMember(next);
  return next;
}

export async function toggleMetaShopMemberFavorite(
  member: MetaShopMember,
  productId: string,
): Promise<MetaShopMember> {
  const set = new Set(member.favoriteProductIds || []);
  if (set.has(productId)) set.delete(productId);
  else set.add(productId);
  const next = { ...member, favoriteProductIds: Array.from(set) };
  await writeMember(next);
  return next;
}

export async function lookupMetaShopOrdersForMember(
  shopId: string,
  memberId: string,
  phone: string,
): Promise<MetaShopOrder[]> {
  const ph = normalizeMemberPhone(phone);
  const byId = new Map<string, MetaShopOrder>();
  const merge = (rows: MetaShopOrder[]) => {
    for (const o of rows) {
      if (o.shopId !== shopId || o.archivedAt) continue;
      byId.set(o.id, o);
    }
  };
  try {
    if (await isProxy()) {
      const [byMember, byPhone] = await Promise.all([
        proxyGet<MetaShopOrder[]>(ORDERS_COL, { whereField: 'memberId', whereEq: memberId, all: true }),
        ph ? proxyGet<MetaShopOrder[]>(ORDERS_COL, { whereField: 'phone', whereEq: ph, all: true }) : Promise.resolve([]),
      ]);
      merge(Array.isArray(byMember) ? byMember : []);
      merge(Array.isArray(byPhone) ? byPhone : []);
    } else {
      const [snapM, snapP] = await Promise.all([
        getDocs(query(collection(db, ORDERS_COL), where('memberId', '==', memberId))),
        ph ? getDocs(query(collection(db, ORDERS_COL), where('phone', '==', ph))) : Promise.resolve(null),
      ]);
      merge(snapM.docs.map(d => d.data() as MetaShopOrder));
      if (snapP) merge(snapP.docs.map(d => d.data() as MetaShopOrder));
    }
  } catch { /* empty */ }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
}
