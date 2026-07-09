import type { Personnel } from '../types';
import type { GlobalSupplier, SupplierEvaluationCriteria, SupplierPermissions } from '../types/supplier';

export function isSupplierMaster(user: Personnel): boolean {
  return user.username === 'master';
}

export function isSupplierAdmin(user: Personnel): boolean {
  const roles = user.roles || [];
  return roles.includes('مدیر') || isSupplierMaster(user);
}

export function getSupplierPermissions(user: Personnel): SupplierPermissions {
  const p = user.permissions;
  const master = isSupplierMaster(user);
  const admin = isSupplierAdmin(user);

  if (master) {
    return {
      canView: true,
      canEdit: true,
      canDelete: true,
      canEvaluate: true,
      canManageDocuments: true,
      canViewFinancials: true,
      role: 'admin',
    };
  }

  if (admin) {
    return {
      canView: true,
      canEdit: true,
      canDelete: false,
      canEvaluate: true,
      canManageDocuments: true,
      canViewFinancials: true,
      role: 'manager',
    };
  }

  const canView = !!(p?.canViewSuppliers || p?.canManageSuppliers);
  const canManage = !!p?.canManageSuppliers;

  return {
    canView,
    canEdit: canManage,
    canDelete: false,
    canEvaluate: canManage || !!p?.canEvaluateSuppliers,
    canManageDocuments: canManage || !!p?.canManageSupplierDocuments,
    canViewFinancials: canManage && !!p?.canViewSupplierFinancials,
    role: canManage ? 'manager' : canView ? 'viewer' : 'viewer',
  };
}

export function canAccessSuppliers(user: Personnel): boolean {
  return getSupplierPermissions(user).canView;
}

export function calcEvaluationScore(c: SupplierEvaluationCriteria): number {
  const vals = Object.values(c);
  if (!vals.length) return 0;
  const sum = vals.reduce((a, b) => a + (Number(b) || 0), 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

export function supplierDisplayScore(s: GlobalSupplier): number {
  if (s.evaluations?.length) {
    const latest = s.evaluations[s.evaluations.length - 1];
    return latest.overallScore;
  }
  return s.score ?? s.rating ?? 0;
}

export function supplierHasNotes(s: GlobalSupplier): boolean {
  return (s.internalNotes?.length ?? 0) > 0 || !!(s.general.description?.trim());
}
