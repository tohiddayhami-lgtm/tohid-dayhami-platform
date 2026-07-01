import { MetaBazaar, MetaBazaarNode, MetaShop, Personnel } from '../types';

export const isMetaShopMasterOrAdmin = (user: Personnel): boolean =>
  user.username === 'master' || (user.roles || []).includes('مدیر');

/** Open the Meta Shop / Bazaar / Expo admin panel. */
export const canAccessMetaShop = (user: Personnel): boolean =>
  isMetaShopMasterOrAdmin(user) || user.permissions?.canManageMetaShop === true;

/** Create & edit shops, bazaars, exhibitions, booth layout. */
export const canEditMetaShop = (user: Personnel): boolean => canAccessMetaShop(user);

/** Delete whole MetaShop or MetaBazaar records from cloud. */
export const canDeleteMetaShopRecords = (user: Personnel): boolean =>
  isMetaShopMasterOrAdmin(user) || user.permissions?.canDeleteMetaShop === true;

/** Delete booths or bazaar tree nodes (structural layout). Staff with edit-only access cannot. */
export const canDeleteBooths = (user: Personnel): boolean => isMetaShopMasterOrAdmin(user);

/** Whether this user may view/edit a specific shop in the admin panel. */
export const canViewMetaShopRecord = (user: Personnel, shop: MetaShop): boolean => {
  if (!canAccessMetaShop(user)) return false;
  if (isMetaShopMasterOrAdmin(user)) return true;

  const allowedIds = user.permissions?.allowedMetaShopIds;
  if (allowedIds?.length && !allowedIds.includes(shop.id)) return false;

  const editors = shop.editorPersonnelIds;
  if (editors?.length && !editors.includes(user.id)) return false;

  return true;
};

export const filterMetaShopsForUser = (user: Personnel, shops: MetaShop[]): MetaShop[] => {
  if (isMetaShopMasterOrAdmin(user)) return shops;
  if (!canAccessMetaShop(user)) return [];
  return shops.filter(s => canViewMetaShopRecord(user, s));
};

const collectBazaarShopSlugsFromTree = (bazaar: MetaBazaar): string[] => {
  const slugs = new Set<string>();
  const walk = (nodes: MetaBazaarNode[] | undefined) => {
    for (const n of nodes || []) {
      (n.shopSlugs || []).forEach(sl => { if (sl) slugs.add(sl); });
      if ((n as { shopSlug?: string }).shopSlug) slugs.add((n as { shopSlug?: string }).shopSlug!);
      walk(n.children);
    }
  };
  walk(bazaar.tree);
  for (const booth of bazaar.expo?.booths || []) {
    if (booth.shopSlug) slugs.add(booth.shopSlug);
  }
  return [...slugs];
};

/** Bazaars/expos visible to staff — linked to at least one shop they can access, or unrestricted. */
export const filterMetaBazaarsForUser = (
  user: Personnel,
  bazaars: MetaBazaar[],
  visibleShops: MetaShop[],
): MetaBazaar[] => {
  if (isMetaShopMasterOrAdmin(user)) return bazaars;
  if (!canAccessMetaShop(user)) return [];

  const allowedIds = user.permissions?.allowedMetaShopIds;
  const hasPersonnelShopFilter = (allowedIds?.length ?? 0) > 0;
  const visibleSlugs = new Set(visibleShops.map(s => s.slug));

  return bazaars.filter(bazaar => {
    const slugs = collectBazaarShopSlugsFromTree(bazaar);
    if (!slugs.length) return !hasPersonnelShopFilter;
    return slugs.some(slug => visibleSlugs.has(slug));
  });
};
