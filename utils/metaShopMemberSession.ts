import type { MetaShopMember } from '../types';

const PREFIX = 'ms_member_sess_v1_';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type SessionEnvelope = {
  memberId: string;
  shopId: string;
  username: string;
  fullName: string;
  phone: string;
  favoriteProductIds: string[];
  isVip?: boolean;
  vipDiscountPercent?: number;
  ts: number;
};

export type MetaShopMemberSession = Pick<
  MetaShopMember,
  'id' | 'shopId' | 'username' | 'fullName' | 'phone' | 'favoriteProductIds' | 'isVip' | 'vipDiscountPercent'
>;

function key(shopId: string) {
  return PREFIX + shopId;
}

export function readMetaShopMemberSession(shopId: string): MetaShopMemberSession | null {
  try {
    const raw = localStorage.getItem(key(shopId));
    if (!raw) return null;
    const env = JSON.parse(raw) as SessionEnvelope;
    if (!env.memberId || env.shopId !== shopId || Date.now() - env.ts > TTL_MS) return null;
    return {
      id: env.memberId,
      shopId: env.shopId,
      username: env.username,
      fullName: env.fullName,
      phone: env.phone,
      favoriteProductIds: env.favoriteProductIds || [],
      isVip: !!env.isVip,
      vipDiscountPercent: env.vipDiscountPercent,
    };
  } catch {
    return null;
  }
}

export function writeMetaShopMemberSession(member: MetaShopMember) {
  const payload: SessionEnvelope = {
    memberId: member.id,
    shopId: member.shopId,
    username: member.username,
    fullName: member.fullName,
    phone: member.phone,
    favoriteProductIds: member.favoriteProductIds || [],
    isVip: !!member.isVip,
    vipDiscountPercent: member.vipDiscountPercent,
    ts: Date.now(),
  };
  try {
    localStorage.setItem(key(member.shopId), JSON.stringify(payload));
  } catch { /* quota */ }
}

export function clearMetaShopMemberSession(shopId: string) {
  try {
    localStorage.removeItem(key(shopId));
  } catch { /* ignore */ }
}

export function memberSessionToPublic(member: MetaShopMember): MetaShopMemberSession {
  return {
    id: member.id,
    shopId: member.shopId,
    username: member.username,
    fullName: member.fullName,
    phone: member.phone,
    favoriteProductIds: member.favoriteProductIds || [],
    isVip: !!member.isVip,
    vipDiscountPercent: member.vipDiscountPercent,
  };
}
