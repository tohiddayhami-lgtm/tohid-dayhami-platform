import type { AttachedFile } from '../types';

export type SupplierStatus =
  | 'active' | 'inactive' | 'prospect' | 'negotiating' | 'approved' | 'rejected' | 'blocked';

export type SupplierProposalStatus =
  | 'new' | 'under_review' | 'negotiating' | 'accepted' | 'rejected' | 'expired' | 'archived';

export type SupplierActivityType =
  | 'created' | 'proposal' | 'meeting' | 'call' | 'email' | 'evaluation'
  | 'document' | 'status' | 'note' | 'reminder' | 'communication' | 'updated';

export type SupplierReminderType =
  | 'call' | 'quotation' | 'review_proposal' | 'renew_contract' | 'follow_up' | 'meeting';

export type SupplierCommType = 'call' | 'meeting' | 'email' | 'whatsapp';

export type SupplierPermissionRole = 'admin' | 'manager' | 'sales' | 'viewer';

export interface SupplierTag {
  id: string;
  label: string;
  color: string;
}

export interface SupplierFlags {
  favorite?: boolean;
  flagged?: boolean;
  topSupplier?: boolean;
  needsAttention?: boolean;
  blacklisted?: boolean;
  pinned?: boolean;
}

export interface SupplierContact {
  mainContactName?: string;
  position?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  whatsapp?: string;
  wechat?: string;
  telegram?: string;
  linkedin?: string;
  preferredCommunication?: string;
}

export interface SupplierProduct {
  id: string;
  name: string;
  description?: string;
  category?: string;
  moq?: string;
  leadTime?: string;
  priceList?: string;
  currency?: string;
  images?: string[];
  catalogPdfUrl?: string;
  videoUrl?: string;
  incoterms?: string;
  paymentTerms?: string;
  packagingOptions?: string;
  productionCapacity?: string;
}

export interface SupplierServiceItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface SupplierProposal {
  id: string;
  title: string;
  proposalDate: string;
  products?: string;
  prices?: string;
  currency?: string;
  moq?: string;
  deliveryTime?: string;
  validity?: string;
  notes?: string;
  attachments?: AttachedFile[];
  status: SupplierProposalStatus;
  createdAt: string;
  createdBy?: string;
  createdByPersonnelId?: string;
}

export interface SupplierEvaluationCriteria {
  quality: number;
  price: number;
  communication: number;
  deliverySpeed: number;
  packaging: number;
  reliability: number;
  responseTime: number;
  flexibility: number;
  documentation: number;
  professionalism: number;
}

export interface SupplierEvaluation {
  id: string;
  criteria: SupplierEvaluationCriteria;
  overallScore: number;
  notes?: string;
  evaluatedAt: string;
  evaluatedBy?: string;
  evaluatedByPersonnelId?: string;
}

export interface SupplierNote {
  id: string;
  content: string;
  mentions?: string[];
  createdAt: string;
  createdBy: string;
  createdByPersonnelId?: string;
}

export interface SupplierActivity {
  id: string;
  type: SupplierActivityType;
  title: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
  createdByPersonnelId?: string;
  metadata?: Record<string, unknown>;
}

export interface SupplierDocument {
  id: string;
  name: string;
  docType: string;
  url: string;
  mimeType?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface SupplierCommunication {
  id: string;
  type: SupplierCommType;
  subject?: string;
  notes?: string;
  date: string;
  createdBy?: string;
  createdByPersonnelId?: string;
  followUpDate?: string;
}

export interface SupplierReminder {
  id: string;
  type: SupplierReminderType;
  title: string;
  dueDate: string;
  completed?: boolean;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface SupplierGeneral {
  logoUrl?: string;
  country: string;
  countryCode?: string;
  city?: string;
  address?: string;
  website?: string;
  googleMapsUrl?: string;
  establishedYear?: string;
  companySize?: string;
  description?: string;
  businessLicenseNumber?: string;
  exportMarkets?: string[];
  manufacturingCapacity?: string;
  certificates?: string[];
}

/** Global supplier CRM record — Invoices/Dashboard → Suppliers module. */
export interface GlobalSupplier {
  id: string;
  companyName: string;
  contactPerson?: string;
  productCategory?: string;
  serviceTypes?: string[];
  email?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  status: SupplierStatus;
  rating?: number;
  score?: number;
  tags: SupplierTag[];
  flags: SupplierFlags;
  lastContact?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  createdBy?: string;
  createdByPersonnelId?: string;
  general: SupplierGeneral;
  contact: SupplierContact;
  products: SupplierProduct[];
  supplierServices: SupplierServiceItem[];
  proposals: SupplierProposal[];
  evaluations: SupplierEvaluation[];
  internalNotes: SupplierNote[];
  activities: SupplierActivity[];
  documents: SupplierDocument[];
  communications: SupplierCommunication[];
  reminders: SupplierReminder[];
}

export interface SupplierListFilters {
  search: string;
  countries: string[];
  categories: string[];
  serviceTypes: string[];
  statuses: SupplierStatus[];
  tags: string[];
  minRating?: number;
  minScore?: number;
  favoriteOnly?: boolean;
  topOnly?: boolean;
  recentlyAdded?: boolean;
  lastContactBefore?: string;
  lastContactAfter?: string;
}

export interface SupplierPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canEvaluate: boolean;
  canManageDocuments: boolean;
  canViewFinancials: boolean;
  role: SupplierPermissionRole;
}
