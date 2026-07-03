import type {
  ContractAddOn,
  ContractClause,
  ContractParty,
  ContractScheduleRow,
  ContractStatus,
  ContractRtlLanguage,
  ContractLogoLayout,
  LegalContract,
} from '../types';

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const today = () => new Date().toISOString().slice(0, 10);

export function genContractRefNo(): string {
  const y = new Date().getFullYear();
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `OM-${y}-${n}`;
}

export function emptyContract(actor?: { fullName?: string; id?: string }): LegalContract {
  const now = new Date().toISOString();
  return {
    id: `ctr-${Date.now()}`,
    refNo: genContractRefNo(),
    titleEn: 'SERVICES AGREEMENT',
    titleRtl: 'قرارداد خدمات',
    subtitleEn: '',
    subtitleRtl: '',
    effectiveDate: today(),
    logoUrl: '',
    logo2Url: '',
    contractLogoLayout: 'corners',
    contractLogoAlign: 'center',
    contractLogoSize: 'md',
    companyName: 'Tohid Dayhami Business Solutions Center SPC',
    parties: [
      {
        id: uid('sp'),
        labelEn: 'SERVICE PROVIDER',
        labelRtl: 'ارائه‌دهنده‌ی خدمات',
        companyEn: 'Tohid Dayhami Business Solutions Center SPC',
        companyRtl: 'مرکز راهکارهای کسب‌وکار توحید دیهمی',
        regNo: '',
        country: 'Sultanate of Oman',
        repNameEn: '',
        repNameRtl: '',
        repTitleEn: '',
        repTitleRtl: '',
        aliasEn: 'the Service Provider',
        aliasRtl: 'ارائه‌دهنده‌ی خدمات',
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
        aliasEn: 'the Client',
        aliasRtl: 'مشتری',
      },
    ],
    clauses: [
      {
        id: uid('rec'),
        articleNum: 'RECITALS',
        titleEn: 'RECITALS',
        titleRtl: 'مقدمه',
        contentEn: '',
        contentRtl: '',
      },
    ],
    scheduleRows: [],
    addOns: [],
    rtlLanguage: 'fa',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.fullName,
    createdByPersonnelId: actor?.id,
  };
}

function mapParty(raw: Record<string, unknown>, i: number): ContractParty {
  return {
    id: str(raw.id, uid(i === 0 ? 'sp' : 'cl')),
    labelEn: str(raw.labelEn, i === 0 ? 'SERVICE PROVIDER' : 'CLIENT'),
    labelRtl: str(raw.labelRtl, i === 0 ? 'ارائه‌دهنده‌ی خدمات' : 'مشتری'),
    companyEn: str(raw.companyEn),
    companyRtl: str(raw.companyRtl),
    regNo: str(raw.regNo) || undefined,
    country: str(raw.country) || undefined,
    repNameEn: str(raw.repNameEn) || undefined,
    repNameRtl: str(raw.repNameRtl) || undefined,
    repTitleEn: str(raw.repTitleEn) || undefined,
    repTitleRtl: str(raw.repTitleRtl) || undefined,
    aliasEn: str(raw.aliasEn) || undefined,
    aliasRtl: str(raw.aliasRtl) || undefined,
    contactEmail: str(raw.contactEmail) || undefined,
    contactPhone: str(raw.contactPhone) || undefined,
  };
}

function mapClause(raw: Record<string, unknown>): ContractClause {
  return {
    id: str(raw.id, uid('cl')),
    articleNum: str(raw.articleNum, '1'),
    titleEn: str(raw.titleEn),
    titleRtl: str(raw.titleRtl),
    contentEn: str(raw.contentEn),
    contentRtl: str(raw.contentRtl),
  };
}

function mapSchedule(raw: Record<string, unknown>): ContractScheduleRow {
  return {
    id: str(raw.id, uid('sr')),
    tierEn: str(raw.tierEn),
    tierRtl: str(raw.tierRtl),
    buildFee: str(raw.buildFee, '0'),
    annualFee: str(raw.annualFee, '0'),
    interpretation: str(raw.interpretation, '0'),
    selected: !!raw.selected,
  };
}

function mapAddOn(raw: Record<string, unknown>): ContractAddOn {
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

const STATUS: ContractStatus[] = ['draft', 'final', 'signed'];
const LAYOUTS: ContractLogoLayout[] = ['title-left', 'title-right', 'banner-top', 'corners'];

export function parseContractJson(input: unknown, actor?: { fullName?: string; id?: string }): LegalContract {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const root = input as Record<string, unknown>;
  const raw = (root.contract && typeof root.contract === 'object'
    ? root.contract
    : root) as Record<string, unknown>;

  if (!str(raw.titleEn) && !str(raw.titleRtl) && !str(raw.refNo)) {
    throw new Error('missing_fields');
  }

  const base = emptyContract(actor);
  const status = STATUS.includes(raw.status as ContractStatus) ? (raw.status as ContractStatus) : 'draft';
  const rtlLanguage: ContractRtlLanguage = raw.rtlLanguage === 'ar' ? 'ar' : 'fa';
  const layout = LAYOUTS.includes(raw.contractLogoLayout as ContractLogoLayout)
    ? (raw.contractLogoLayout as ContractLogoLayout)
    : 'corners';

  const parties = Array.isArray(raw.parties)
    ? (raw.parties as Record<string, unknown>[]).map(mapParty)
    : base.parties;
  const clauses = Array.isArray(raw.clauses)
    ? (raw.clauses as Record<string, unknown>[]).map(mapClause)
    : base.clauses;
  const scheduleRows = Array.isArray(raw.scheduleRows)
    ? (raw.scheduleRows as Record<string, unknown>[]).map(mapSchedule)
    : [];
  const addOns = Array.isArray(raw.addOns)
    ? (raw.addOns as Record<string, unknown>[]).map(mapAddOn)
    : [];

  const now = new Date().toISOString();
  return {
    ...base,
    id: str(raw.id) || base.id,
    refNo: str(raw.refNo) || genContractRefNo(),
    titleEn: str(raw.titleEn, base.titleEn),
    titleRtl: str(raw.titleRtl, base.titleRtl),
    subtitleEn: str(raw.subtitleEn) || undefined,
    subtitleRtl: str(raw.subtitleRtl) || undefined,
    effectiveDate: str(raw.effectiveDate, today()),
    logoUrl: str(raw.logoUrl) || undefined,
    logo2Url: str(raw.logo2Url) || undefined,
    contractLogoLayout: layout,
    contractLogoAlign: (raw.contractLogoAlign as LegalContract['contractLogoAlign']) || 'center',
    contractLogoSize: (raw.contractLogoSize as LegalContract['contractLogoSize']) || 'md',
    companyName: str(raw.companyName) || base.companyName,
    parties: parties.length ? parties : base.parties,
    clauses: clauses.length ? clauses : base.clauses,
    scheduleRows,
    addOns,
    rtlLanguage,
    status,
    createdAt: typeof raw.createdAt === 'string'
      ? raw.createdAt
      : (typeof raw.createdAt === 'number' ? new Date(raw.createdAt).toISOString() : now),
    updatedAt: now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
  };
}

export function exportContractEnvelope(c: LegalContract): Record<string, unknown> {
  return {
    _schema_version: '1.0',
    _about: 'Bilingual contract JSON (English + RTL). Used by Invoices → Contracts. Legal document template.',
    _for_ai_models: 'Return ONLY valid JSON. Use envelope with top-level "contract", OR a flat root with the same keys. Preserve clauses[] order. Each clause needs articleNum, titleEn, titleRtl, contentEn, contentRtl. scheduleRows[] = fee tiers; addOns[] = optional extras. Each array item needs string id. Omit id/createdAt/updatedAt on import — app assigns them.',
    contract: {
      refNo: c.refNo,
      titleEn: c.titleEn,
      titleRtl: c.titleRtl,
      subtitleEn: c.subtitleEn || '',
      subtitleRtl: c.subtitleRtl || '',
      effectiveDate: c.effectiveDate,
      logoUrl: c.logoUrl || '',
      logo2Url: c.logo2Url || '',
      contractLogoLayout: c.contractLogoLayout || 'corners',
      contractLogoAlign: c.contractLogoAlign || 'center',
      contractLogoSize: c.contractLogoSize || 'md',
      companyName: c.companyName || '',
      parties: c.parties,
      clauses: c.clauses,
      scheduleRows: c.scheduleRows,
      addOns: c.addOns,
      rtlLanguage: c.rtlLanguage,
      status: c.status,
    },
  };
}

export function contractClientName(c: LegalContract): string {
  const client = c.parties.find(x => /client|مشتری/i.test(x.labelEn) || /مشتری/.test(x.labelRtl)) || c.parties[1];
  return client?.companyEn || client?.companyRtl || client?.repNameEn || '—';
}
