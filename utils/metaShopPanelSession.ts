const TTL_MS = 24 * 60 * 60 * 1000;

const MANAGER_KEY = 'metaShop_manager_nav';

type Envelope<T> = { v: T; exp: number };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as Envelope<T>;
    if (!data?.v || typeof data.exp !== 'number' || Date.now() > data.exp) {
      localStorage.removeItem(key);
      return null;
    }
    return data.v;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T): void {
  try {
    const envelope: Envelope<T> = { v: value, exp: Date.now() + TTL_MS };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch { /* quota */ }
}

function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export type MetaShopManagerNav = {
  mode: 'orders' | 'all-orders';
  ordersShopId?: string | null;
};

export function loadMetaShopManagerNav(): MetaShopManagerNav | null {
  return read<MetaShopManagerNav>(MANAGER_KEY);
}

export function saveMetaShopManagerNav(nav: MetaShopManagerNav): void {
  write(MANAGER_KEY, nav);
}

export function clearMetaShopManagerNav(): void {
  remove(MANAGER_KEY);
}

export function shouldRestoreAdminMetaShopTab(): boolean {
  const nav = loadMetaShopManagerNav();
  return !!nav && (nav.mode === 'orders' || nav.mode === 'all-orders');
}

export type CustomerMetaShopNav = {
  shopId: string;
  tab: 'info' | 'locale' | 'products' | 'discounts' | 'orders';
  portalTab?: 'metashop';
};

function customerKey(userId: string): string {
  return `metaShop_customer_nav_${userId || 'anon'}`;
}

export function loadCustomerMetaShopNav(userId: string): CustomerMetaShopNav | null {
  return read<CustomerMetaShopNav>(customerKey(userId));
}

export function saveCustomerMetaShopNav(userId: string, nav: CustomerMetaShopNav): void {
  write(customerKey(userId), nav);
}

export function clearCustomerMetaShopNav(userId: string): void {
  remove(customerKey(userId));
}
