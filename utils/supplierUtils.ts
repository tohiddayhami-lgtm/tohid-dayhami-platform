import type { GlobalSupplier, SupplierActivity, SupplierEvaluationCriteria } from '../types/supplier';
import { calcEvaluationScore } from './supplierAccess';

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function emptySupplier(actor?: { fullName?: string; id?: string }): GlobalSupplier {
  const now = new Date().toISOString();
  return {
    id: `sup-${Date.now()}`,
    companyName: '',
    contactPerson: '',
    productCategory: '',
    serviceTypes: [],
    email: '',
    phone: '',
    whatsapp: '',
    website: '',
    status: 'prospect',
    rating: 0,
    score: 0,
    tags: [],
    flags: {},
    lastContact: '',
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.fullName,
    createdByPersonnelId: actor?.id,
    general: { country: '', city: '' },
    contact: {},
    products: [],
    supplierServices: [],
    proposals: [],
    evaluations: [],
    internalNotes: [],
    activities: [{
      id: uid('act'),
      type: 'created',
      title: 'Supplier created',
      createdAt: now,
      createdBy: actor?.fullName,
      createdByPersonnelId: actor?.id,
    }],
    documents: [],
    communications: [],
    reminders: [],
  };
}

export function addActivity(
  s: GlobalSupplier,
  activity: Omit<SupplierActivity, 'id' | 'createdAt'> & { createdAt?: string },
): SupplierActivity {
  const entry: SupplierActivity = {
    id: uid('act'),
    createdAt: activity.createdAt || new Date().toISOString(),
    ...activity,
  };
  s.activities = [...(s.activities || []), entry];
  s.updatedAt = entry.createdAt;
  return entry;
}

export function addEvaluation(
  s: GlobalSupplier,
  criteria: SupplierEvaluationCriteria,
  notes: string | undefined,
  actor?: { fullName?: string; id?: string },
) {
  const overallScore = calcEvaluationScore(criteria);
  const entry = {
    id: uid('ev'),
    criteria,
    overallScore,
    notes,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: actor?.fullName,
    evaluatedByPersonnelId: actor?.id,
  };
  s.evaluations = [...(s.evaluations || []), entry];
  s.score = overallScore;
  s.rating = Math.round(overallScore);
  addActivity(s, {
    type: 'evaluation',
    title: `Evaluation: ${overallScore}/5`,
    description: notes,
    createdBy: actor?.fullName,
    createdByPersonnelId: actor?.id,
  });
  return entry;
}

export function syncSupplierTopFields(s: GlobalSupplier): GlobalSupplier {
  const c = s.contact;
  return {
    ...s,
    contactPerson: s.contactPerson || c.mainContactName || '',
    email: s.email || c.email || '',
    phone: s.phone || c.phone || c.mobile || '',
    whatsapp: s.whatsapp || c.whatsapp || '',
    website: s.website || s.general.website || '',
    serviceTypes: s.serviceTypes?.length
      ? s.serviceTypes
      : s.supplierServices.map(x => x.name).filter(Boolean),
  };
}
