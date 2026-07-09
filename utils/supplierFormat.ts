import type {
  GlobalSupplier,
  SupplierActivity,
  SupplierCommunication,
  SupplierDocument,
  SupplierEvaluation,
  SupplierEvaluationCriteria,
  SupplierFlags,
  SupplierGeneral,
  SupplierContact,
  SupplierNote,
  SupplierProduct,
  SupplierProposal,
  SupplierProposalStatus,
  SupplierReminder,
  SupplierServiceItem,
  SupplierStatus,
  SupplierTag,
} from '../types/supplier';
import { SUPPLIER_PROPOSAL_STATUSES, SUPPLIER_STATUSES } from './supplierConstants';
import { emptySupplier, syncSupplierTopFields } from './supplierUtils';
import { calcEvaluationScore } from './supplierAccess';
import supplierSampleEnvelope from './supplierSample.json';

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const today = () => new Date().toISOString().slice(0, 10);

function mapTag(raw: Record<string, unknown>): SupplierTag {
  return {
    id: str(raw.id, uid('tag')),
    label: str(raw.label),
    color: str(raw.color, '#6366f1'),
  };
}

function mapFlags(raw: Record<string, unknown> | undefined): SupplierFlags {
  if (!raw) return {};
  return {
    favorite: !!raw.favorite,
    flagged: !!raw.flagged,
    topSupplier: !!raw.topSupplier,
    needsAttention: !!raw.needsAttention,
    blacklisted: !!raw.blacklisted,
    pinned: !!raw.pinned,
  };
}

function mapGeneral(raw: Record<string, unknown> | undefined, base: SupplierGeneral): SupplierGeneral {
  if (!raw) return base;
  return {
    logoUrl: str(raw.logoUrl) || undefined,
    country: str(raw.country, base.country),
    countryCode: str(raw.countryCode) || undefined,
    city: str(raw.city) || undefined,
    address: str(raw.address) || undefined,
    website: str(raw.website) || undefined,
    googleMapsUrl: str(raw.googleMapsUrl) || undefined,
    establishedYear: str(raw.establishedYear) || undefined,
    companySize: str(raw.companySize) || undefined,
    description: str(raw.description) || undefined,
    businessLicenseNumber: str(raw.businessLicenseNumber) || undefined,
    exportMarkets: Array.isArray(raw.exportMarkets) ? raw.exportMarkets.map(x => str(x)).filter(Boolean) : undefined,
    manufacturingCapacity: str(raw.manufacturingCapacity) || undefined,
    certificates: Array.isArray(raw.certificates) ? raw.certificates.map(x => str(x)).filter(Boolean) : undefined,
  };
}

function mapContact(raw: Record<string, unknown> | undefined): SupplierContact {
  if (!raw) return {};
  return {
    mainContactName: str(raw.mainContactName) || undefined,
    position: str(raw.position) || undefined,
    email: str(raw.email) || undefined,
    phone: str(raw.phone) || undefined,
    mobile: str(raw.mobile) || undefined,
    whatsapp: str(raw.whatsapp) || undefined,
    wechat: str(raw.wechat) || undefined,
    telegram: str(raw.telegram) || undefined,
    linkedin: str(raw.linkedin) || undefined,
    preferredCommunication: str(raw.preferredCommunication) || undefined,
  };
}

function mapProduct(raw: Record<string, unknown>): SupplierProduct {
  return {
    id: str(raw.id, uid('prod')),
    name: str(raw.name),
    description: str(raw.description) || undefined,
    category: str(raw.category) || undefined,
    moq: str(raw.moq) || undefined,
    leadTime: str(raw.leadTime) || undefined,
    priceList: str(raw.priceList) || undefined,
    currency: str(raw.currency) || undefined,
    images: Array.isArray(raw.images) ? raw.images.map(x => str(x)).filter(Boolean) : undefined,
    catalogPdfUrl: str(raw.catalogPdfUrl) || undefined,
    videoUrl: str(raw.videoUrl) || undefined,
    incoterms: str(raw.incoterms) || undefined,
    paymentTerms: str(raw.paymentTerms) || undefined,
    packagingOptions: str(raw.packagingOptions) || undefined,
    productionCapacity: str(raw.productionCapacity) || undefined,
  };
}

function mapService(raw: Record<string, unknown>): SupplierServiceItem {
  return {
    id: str(raw.id, uid('svc')),
    name: str(raw.name),
    description: str(raw.description) || undefined,
    category: str(raw.category) || undefined,
  };
}

function mapProposal(raw: Record<string, unknown>, actor?: { fullName?: string; id?: string }): SupplierProposal {
  const status = SUPPLIER_PROPOSAL_STATUSES.includes(raw.status as SupplierProposalStatus)
    ? (raw.status as SupplierProposalStatus)
    : 'new';
  const now = new Date().toISOString();
  return {
    id: str(raw.id, uid('prop')),
    title: str(raw.title),
    proposalDate: str(raw.proposalDate, today()),
    products: str(raw.products) || undefined,
    prices: str(raw.prices) || undefined,
    currency: str(raw.currency) || undefined,
    moq: str(raw.moq) || undefined,
    deliveryTime: str(raw.deliveryTime) || undefined,
    validity: str(raw.validity) || undefined,
    notes: str(raw.notes) || undefined,
    status,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
  };
}

function mapCriteria(raw: Record<string, unknown>): SupplierEvaluationCriteria {
  const clamp = (v: unknown) => Math.min(5, Math.max(1, num(v, 3)));
  return {
    quality: clamp(raw.quality),
    price: clamp(raw.price),
    communication: clamp(raw.communication),
    deliverySpeed: clamp(raw.deliverySpeed),
    packaging: clamp(raw.packaging),
    reliability: clamp(raw.reliability),
    responseTime: clamp(raw.responseTime),
    flexibility: clamp(raw.flexibility),
    documentation: clamp(raw.documentation),
    professionalism: clamp(raw.professionalism),
  };
}

function mapEvaluation(raw: Record<string, unknown>, actor?: { fullName?: string; id?: string }): SupplierEvaluation {
  const criteria = raw.criteria && typeof raw.criteria === 'object'
    ? mapCriteria(raw.criteria as Record<string, unknown>)
    : mapCriteria({});
  const overallScore = calcEvaluationScore(criteria);
  const now = new Date().toISOString();
  return {
    id: str(raw.id, uid('ev')),
    criteria,
    overallScore,
    notes: str(raw.notes) || undefined,
    evaluatedAt: typeof raw.evaluatedAt === 'string' ? raw.evaluatedAt : now,
    evaluatedBy: actor?.fullName || str(raw.evaluatedBy) || undefined,
    evaluatedByPersonnelId: actor?.id || str(raw.evaluatedByPersonnelId) || undefined,
  };
}

function mapNote(raw: Record<string, unknown>, actor?: { fullName?: string; id?: string }): SupplierNote {
  const now = new Date().toISOString();
  return {
    id: str(raw.id, uid('note')),
    content: str(raw.content),
    mentions: Array.isArray(raw.mentions) ? raw.mentions.map(x => str(x)).filter(Boolean) : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    createdBy: str(raw.createdBy, actor?.fullName || 'Import'),
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
  };
}

function mapActivity(raw: Record<string, unknown>, actor?: { fullName?: string; id?: string }): SupplierActivity {
  const now = new Date().toISOString();
  return {
    id: str(raw.id, uid('act')),
    type: (str(raw.type, 'updated') as SupplierActivity['type']),
    title: str(raw.title, 'Imported'),
    description: str(raw.description) || undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
    metadata: raw.metadata && typeof raw.metadata === 'object'
      ? (raw.metadata as Record<string, unknown>)
      : undefined,
  };
}

function mapDocument(raw: Record<string, unknown>, actor?: { fullName?: string; id?: string }): SupplierDocument {
  const now = new Date().toISOString();
  return {
    id: str(raw.id, uid('doc')),
    name: str(raw.name, 'Document'),
    docType: str(raw.docType, 'file'),
    url: str(raw.url),
    mimeType: str(raw.mimeType) || undefined,
    uploadedAt: typeof raw.uploadedAt === 'string' ? raw.uploadedAt : now,
    uploadedBy: actor?.fullName || str(raw.uploadedBy) || undefined,
  };
}

function mapCommunication(raw: Record<string, unknown>, actor?: { fullName?: string; id?: string }): SupplierCommunication {
  return {
    id: str(raw.id, uid('comm')),
    type: (['call', 'meeting', 'email', 'whatsapp'].includes(str(raw.type)) ? str(raw.type) : 'email') as SupplierCommunication['type'],
    subject: str(raw.subject) || undefined,
    notes: str(raw.notes) || undefined,
    date: str(raw.date, today()),
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
    followUpDate: str(raw.followUpDate) || undefined,
  };
}

function mapReminder(raw: Record<string, unknown>, actor?: { fullName?: string; id?: string }): SupplierReminder {
  const now = new Date().toISOString();
  return {
    id: str(raw.id, uid('rem')),
    type: (['call', 'quotation', 'review_proposal', 'renew_contract', 'follow_up', 'meeting'].includes(str(raw.type))
      ? str(raw.type) : 'follow_up') as SupplierReminder['type'],
    title: str(raw.title),
    dueDate: str(raw.dueDate, today()),
    completed: !!raw.completed,
    notes: str(raw.notes) || undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
  };
}

/** Parse one supplier object (envelope supplier, flat root, or array item). */
export function parseSupplierJson(
  input: unknown,
  actor?: { fullName?: string; id?: string },
): GlobalSupplier {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const raw = input as Record<string, unknown>;

  if (!str(raw.companyName) && !str(raw.contactPerson) && !str(raw.email)) {
    throw new Error('missing_fields');
  }

  const base = emptySupplier(actor);
  const now = new Date().toISOString();
  const status = SUPPLIER_STATUSES.includes(raw.status as SupplierStatus)
    ? (raw.status as SupplierStatus)
    : base.status;

  const tags = Array.isArray(raw.tags)
    ? (raw.tags as Record<string, unknown>[]).map(mapTag)
    : [];
  const products = Array.isArray(raw.products)
    ? (raw.products as Record<string, unknown>[]).map(mapProduct)
    : [];
  const supplierServices = Array.isArray(raw.supplierServices)
    ? (raw.supplierServices as Record<string, unknown>[]).map(mapService)
    : [];
  const proposals = Array.isArray(raw.proposals)
    ? (raw.proposals as Record<string, unknown>[]).map(p => mapProposal(p, actor))
    : [];
  const evaluations = Array.isArray(raw.evaluations)
    ? (raw.evaluations as Record<string, unknown>[]).map(e => mapEvaluation(e, actor))
    : [];
  const internalNotes = Array.isArray(raw.internalNotes)
    ? (raw.internalNotes as Record<string, unknown>[]).map(n => mapNote(n, actor))
    : [];
  const activities = Array.isArray(raw.activities)
    ? (raw.activities as Record<string, unknown>[]).map(a => mapActivity(a, actor))
    : [{
      id: uid('act'),
      type: 'created' as const,
      title: 'Imported from JSON',
      createdAt: now,
      createdBy: actor?.fullName,
      createdByPersonnelId: actor?.id,
    }];
  const documents = Array.isArray(raw.documents)
    ? (raw.documents as Record<string, unknown>[]).map(d => mapDocument(d, actor))
    : [];
  const communications = Array.isArray(raw.communications)
    ? (raw.communications as Record<string, unknown>[]).map(c => mapCommunication(c, actor))
    : [];
  const reminders = Array.isArray(raw.reminders)
    ? (raw.reminders as Record<string, unknown>[]).map(r => mapReminder(r, actor))
    : [];

  const serviceTypes = Array.isArray(raw.serviceTypes)
    ? raw.serviceTypes.map(x => str(x)).filter(Boolean)
    : supplierServices.map(s => s.name).filter(Boolean);

  const latestEval = evaluations.length ? evaluations[evaluations.length - 1] : null;
  const score = latestEval?.overallScore ?? num(raw.score, base.score);
  const rating = num(raw.rating, latestEval ? Math.round(latestEval.overallScore) : base.rating);

  const supplier: GlobalSupplier = {
    ...base,
    id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    companyName: str(raw.companyName),
    contactPerson: str(raw.contactPerson) || undefined,
    productCategory: str(raw.productCategory) || undefined,
    serviceTypes,
    email: str(raw.email) || undefined,
    phone: str(raw.phone) || undefined,
    whatsapp: str(raw.whatsapp) || undefined,
    website: str(raw.website) || undefined,
    status,
    rating,
    score,
    tags,
    flags: mapFlags(raw.flags as Record<string, unknown> | undefined),
    lastContact: str(raw.lastContact) || undefined,
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
    general: mapGeneral(raw.general as Record<string, unknown> | undefined, base.general),
    contact: mapContact(raw.contact as Record<string, unknown> | undefined),
    products,
    supplierServices,
    proposals,
    evaluations,
    internalNotes,
    activities,
    documents,
    communications,
    reminders,
  };

  return syncSupplierTopFields(supplier);
}

/**
 * Accepts:
 * - `{ supplier: {...} }`
 * - `{ suppliers: [...] }`
 * - flat single supplier object
 */
export function parseSuppliersJson(
  input: unknown,
  actor?: { fullName?: string; id?: string },
): GlobalSupplier[] {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const root = input as Record<string, unknown>;

  if (Array.isArray(root.suppliers)) {
    const list = root.suppliers as unknown[];
    if (!list.length) throw new Error('empty_list');
    return list.map(item => parseSupplierJson(item, actor));
  }

  if (root.supplier && typeof root.supplier === 'object') {
    return [parseSupplierJson(root.supplier, actor)];
  }

  return [parseSupplierJson(root, actor)];
}

export function exportSupplierEnvelope(s: GlobalSupplier): Record<string, unknown> {
  return {
    _schema_version: '1.0',
    _about: 'Global supplier CRM record for Dashboard → Suppliers module.',
    _for_ai_models:
      'Return ONLY valid JSON. Use envelope { "supplier": { ... } } OR flat root. '
      + 'Required: companyName. Include general, contact, products[], supplierServices[], proposals[], evaluations[], internalNotes[], communications[], reminders[], documents[]. '
      + 'tags[]: { label, color }. status: active|inactive|prospect|negotiating|approved|rejected|blocked.',
    supplier: {
      companyName: s.companyName,
      contactPerson: s.contactPerson || '',
      productCategory: s.productCategory || '',
      serviceTypes: s.serviceTypes || [],
      email: s.email || '',
      phone: s.phone || '',
      whatsapp: s.whatsapp || '',
      website: s.website || '',
      status: s.status,
      rating: s.rating ?? 0,
      score: s.score ?? 0,
      tags: s.tags.map(t => ({ label: t.label, color: t.color })),
      flags: s.flags,
      lastContact: s.lastContact || '',
      general: s.general,
      contact: s.contact,
      products: s.products,
      supplierServices: s.supplierServices,
      proposals: s.proposals,
      evaluations: s.evaluations,
      internalNotes: s.internalNotes.map(n => ({ content: n.content, createdBy: n.createdBy })),
      communications: s.communications,
      reminders: s.reminders,
      documents: s.documents.map(d => ({ name: d.name, docType: d.docType, url: d.url })),
    },
  };
}

export function buildSupplierSampleEnvelope(): Record<string, unknown> {
  return supplierSampleEnvelope as Record<string, unknown>;
}

export function downloadSupplierJson(data: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function supplierDisplayName(s: GlobalSupplier): string {
  return s.companyName || s.contactPerson || s.email || s.id;
}
