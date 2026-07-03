import type {
  CommercialProposal,
  ProposalAddOn,
  ProposalLineItem,
  ProposalParty,
  ProposalSection,
  ProposalStatus,
  ProposalRtlLanguage,
} from '../types';

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));

const today = () => new Date().toISOString().slice(0, 10);

const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export function genProposalRefNo(): string {
  const y = new Date().getFullYear();
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `PROP-${y}-${n}`;
}

export function emptyProposal(actor?: { fullName?: string; id?: string }): CommercialProposal {
  const now = new Date().toISOString();
  return {
    id: `prop-${Date.now()}`,
    refNo: genProposalRefNo(),
    titleEn: 'COMMERCIAL PROPOSAL',
    titleRtl: 'پیشنهاد تجاری',
    subtitleEn: '',
    subtitleRtl: '',
    proposalDate: today(),
    validUntil: plusDays(30),
    logoUrl: '',
    logo2Url: '',
    contractLogoLayout: 'corners',
    contractLogoAlign: 'center',
    contractLogoSize: 'md',
    companyName: 'Tohid Dayhami Business Solutions Center SPC',
    parties: [
      {
        id: uid('pr'),
        labelEn: 'PROPOSER',
        labelRtl: 'ارائه‌دهنده',
        companyEn: 'Tohid Dayhami Business Solutions Center SPC',
        companyRtl: 'مرکز راهکارهای کسب‌وکار توحید دیهمی',
        regNo: '',
        country: 'Sultanate of Oman',
        repNameEn: '',
        repNameRtl: '',
        repTitleEn: '',
        repTitleRtl: '',
        contactEmail: '',
        contactPhone: '',
      },
      {
        id: uid('cl'),
        labelEn: 'CLIENT',
        labelRtl: 'مشتری',
        companyEn: '',
        companyRtl: '',
        regNo: '',
        country: '',
        repNameEn: '',
        repNameRtl: '',
        repTitleEn: '',
        repTitleRtl: '',
        contactEmail: '',
        contactPhone: '',
      },
    ],
    sections: [
      {
        id: uid('es'),
        sectionNum: 'EXECUTIVE SUMMARY',
        titleEn: 'EXECUTIVE SUMMARY',
        titleRtl: 'خلاصه مدیریتی',
        contentEn: '',
        contentRtl: '',
      },
    ],
    lineItems: [],
    addOns: [],
    currency: 'OMR',
    rtlLanguage: 'fa',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.fullName,
    createdByPersonnelId: actor?.id,
  };
}

function mapParty(raw: Record<string, unknown>, i: number): ProposalParty {
  return {
    id: str(raw.id, uid(i === 0 ? 'pr' : 'cl')),
    labelEn: str(raw.labelEn, i === 0 ? 'PROPOSER' : 'CLIENT'),
    labelRtl: str(raw.labelRtl, i === 0 ? 'ارائه‌دهنده' : 'مشتری'),
    companyEn: str(raw.companyEn),
    companyRtl: str(raw.companyRtl),
    regNo: str(raw.regNo) || undefined,
    country: str(raw.country) || undefined,
    repNameEn: str(raw.repNameEn) || undefined,
    repNameRtl: str(raw.repNameRtl) || undefined,
    repTitleEn: str(raw.repTitleEn) || undefined,
    repTitleRtl: str(raw.repTitleRtl) || undefined,
    contactEmail: str(raw.contactEmail) || undefined,
    contactPhone: str(raw.contactPhone) || undefined,
  };
}

function mapSection(raw: Record<string, unknown>): ProposalSection {
  return {
    id: str(raw.id, uid('sc')),
    sectionNum: str(raw.sectionNum, '1'),
    titleEn: str(raw.titleEn),
    titleRtl: str(raw.titleRtl),
    contentEn: str(raw.contentEn),
    contentRtl: str(raw.contentRtl),
  };
}

function mapLine(raw: Record<string, unknown>): ProposalLineItem {
  return {
    id: str(raw.id, uid('li')),
    itemEn: str(raw.itemEn),
    itemRtl: str(raw.itemRtl),
    qty: str(raw.qty, '1'),
    unitPrice: str(raw.unitPrice, '0'),
    total: str(raw.total, str(raw.unitPrice, '0')),
    notes: str(raw.notes) || undefined,
    selected: !!raw.selected,
  };
}

function mapAddOn(raw: Record<string, unknown>): ProposalAddOn {
  return {
    id: str(raw.id, uid('ao')),
    nameEn: str(raw.nameEn),
    nameRtl: str(raw.nameRtl),
    descEn: str(raw.descEn) || undefined,
    descRtl: str(raw.descRtl) || undefined,
    price: str(raw.price, '0'),
    selected: !!raw.selected,
  };
}

const STATUS: ProposalStatus[] = ['draft', 'sent', 'accepted', 'declined'];

/** Accepts envelope `{ proposal: {...} }` or flat proposal object (AI-friendly). */
export function parseProposalJson(input: unknown, actor?: { fullName?: string; id?: string }): CommercialProposal {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const root = input as Record<string, unknown>;
  const raw = (root.proposal && typeof root.proposal === 'object'
    ? root.proposal
    : root) as Record<string, unknown>;

  if (!str(raw.titleEn) && !str(raw.titleRtl) && !str(raw.refNo)) {
    throw new Error('missing_fields');
  }

  const base = emptyProposal(actor);
  const status = STATUS.includes(raw.status as ProposalStatus) ? (raw.status as ProposalStatus) : 'draft';
  const rtlLanguage: ProposalRtlLanguage = raw.rtlLanguage === 'ar' ? 'ar' : 'fa';
  const parties = Array.isArray(raw.parties)
    ? (raw.parties as Record<string, unknown>[]).map(mapParty)
    : base.parties;
  const sections = Array.isArray(raw.sections)
    ? (raw.sections as Record<string, unknown>[]).map(mapSection)
    : base.sections;
  const lineItems = Array.isArray(raw.lineItems)
    ? (raw.lineItems as Record<string, unknown>[]).map(mapLine)
    : [];
  const addOns = Array.isArray(raw.addOns)
    ? (raw.addOns as Record<string, unknown>[]).map(mapAddOn)
    : [];

  const now = new Date().toISOString();
  return {
    ...base,
    id: str(raw.id) || base.id,
    refNo: str(raw.refNo) || genProposalRefNo(),
    titleEn: str(raw.titleEn, base.titleEn),
    titleRtl: str(raw.titleRtl, base.titleRtl),
    subtitleEn: str(raw.subtitleEn) || undefined,
    subtitleRtl: str(raw.subtitleRtl) || undefined,
    proposalDate: str(raw.proposalDate, today()),
    validUntil: str(raw.validUntil, plusDays(30)),
    logoUrl: str(raw.logoUrl) || undefined,
    logo2Url: str(raw.logo2Url) || undefined,
    contractLogoLayout: (raw.contractLogoLayout as CommercialProposal['contractLogoLayout']) || 'corners',
    contractLogoAlign: (raw.contractLogoAlign as CommercialProposal['contractLogoAlign']) || 'center',
    contractLogoSize: (raw.contractLogoSize as CommercialProposal['contractLogoSize']) || 'md',
    companyName: str(raw.companyName) || base.companyName,
    parties: parties.length ? parties : base.parties,
    sections: sections.length ? sections : base.sections,
    lineItems,
    addOns,
    currency: str(raw.currency, 'OMR'),
    rtlLanguage,
    status,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : (typeof raw.createdAt === 'number' ? new Date(raw.createdAt).toISOString() : now),
    updatedAt: now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
  };
}

/** Export envelope for AI / backup — omits internal ids optional for re-import. */
export function exportProposalEnvelope(p: CommercialProposal): Record<string, unknown> {
  return {
    _schema_version: '1.0',
    _about: 'Bilingual commercial proposal JSON (English + RTL). Used by Invoices → Proposals. NOT a legal contract.',
    _for_ai_models: 'Return ONLY valid JSON. Use envelope with top-level "proposal", OR a flat root with the same keys. Preserve sections[] order. Each section needs sectionNum, titleEn, titleRtl, contentEn, contentRtl. lineItems[] = priced packages; addOns[] = optional extras. Each array item needs string id. Omit id/createdAt/updatedAt on import — app assigns them.',
    proposal: {
      refNo: p.refNo,
      titleEn: p.titleEn,
      titleRtl: p.titleRtl,
      subtitleEn: p.subtitleEn || '',
      subtitleRtl: p.subtitleRtl || '',
      proposalDate: p.proposalDate,
      validUntil: p.validUntil,
      logoUrl: p.logoUrl || '',
      logo2Url: p.logo2Url || '',
      contractLogoLayout: p.contractLogoLayout || 'corners',
      companyName: p.companyName || '',
      parties: p.parties,
      sections: p.sections,
      lineItems: p.lineItems,
      addOns: p.addOns,
      currency: p.currency,
      rtlLanguage: p.rtlLanguage,
      status: p.status,
    },
  };
}

export function proposalClientName(p: CommercialProposal): string {
  const client = p.parties.find(x => /client|مشتری/i.test(x.labelEn) || /مشتری/.test(x.labelRtl)) || p.parties[1];
  return client?.companyEn || client?.companyRtl || client?.repNameEn || '—';
}
