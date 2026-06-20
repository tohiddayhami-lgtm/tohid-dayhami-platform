import { Personnel } from '../types';

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
