import type { Personnel } from '../types';
import type { GlobalSupplier, SupplierEvaluationCriteria, SupplierPermissions } from '../types/supplier';

export function isSupplierAdmin(user: Personnel): boolean {
  const roles = user.roles || [];
  return roles.includes('مدیر') || user.username === 'master';
}

export function getSupplierPermissions(user: Personnel): SupplierPermissions {
  const admin = isSupplierAdmin(user);
  const p = user.permissions;

  if (admin) {
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

  const canView = user.status !== 'inactive' || !!p?.canViewSuppliers;
  const canManage = !!p?.canManageSuppliers;

  return {
    canView,
    canEdit: canManage,
    canDelete: canManage && !!p?.canDeleteSuppliers,
    canEvaluate: canManage || !!p?.canEvaluateSuppliers,
    canManageDocuments: canManage || !!p?.canManageSupplierDocuments,
    canViewFinancials: canManage && !!p?.canViewSupplierFinancials,
    role: canManage ? 'manager' : canView ? 'sales' : 'viewer',
  };
}

export function canAccessSuppliers(user: Personnel): boolean {
  if (isSupplierAdmin(user)) return true;
  const p = user.permissions;
  if (p?.canViewSuppliers || p?.canManageSuppliers) return true;
  // Default view for active internal staff on the admin dashboard
  return user.status !== 'inactive';
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
