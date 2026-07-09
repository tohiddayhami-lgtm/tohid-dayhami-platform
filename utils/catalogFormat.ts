import type {
  CatalogArea,
  CatalogCompany,
  CatalogContact,
  CatalogHowWeWork,
  CatalogIntro,
  CatalogRtlLanguage,
  CatalogService,
  CatalogStatus,
  CompanyCatalog,
  ContractLogoLayout,
} from '../types';
import catalogSampleEnvelope from './catalogSample.json';

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const today = () => new Date().toISOString().slice(0, 10);

export function genCatalogRefNo(): string {
  const y = new Date().getFullYear();
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `CATALOG-${y}-${n}`;
}

export function emptyCatalog(actor?: { fullName?: string; id?: string }): CompanyCatalog {
  const now = new Date().toISOString();
  return {
    id: `cat-${Date.now()}`,
    refNo: genCatalogRefNo(),
    titleEn: 'SERVICES CATALOG',
    titleRtl: 'کاتالوگ خدمات',
    subtitleEn: '',
    subtitleRtl: '',
    catalogDate: today(),
    logoUrl: '',
    logo2Url: '',
    contractLogoLayout: 'corners',
    contractLogoAlign: 'center',
    contractLogoSize: 'md',
    companyName: 'Tohid Dayhami Business Solutions Center SPC',
    languages: ['fa', 'ar', 'en'],
    rtlLanguage: 'fa',
    company: {
      labelEn: 'THE COMPANY',
      labelRtl: 'درباره شرکت',
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
      website: '',
    },
    intro: {
      sectionNum: 'ABOUT US',
      titleEn: 'WHO WE ARE',
      titleRtl: 'ما که هستیم',
      contentEn: '',
      contentRtl: '',
    },
    areas: [],
    howWeWork: {
      sectionNum: 'HOW WE WORK',
      titleEn: 'HOW WE WORK',
      titleRtl: 'چگونه کار می‌کنیم',
      pointsEn: [],
      pointsRtl: [],
    },
    contact: {
      sectionNum: 'CONTACT',
      titleEn: 'START A CONVERSATION',
      titleRtl: 'شروع یک گفت‌وگو',
      contentEn: '',
      contentRtl: '',
      email: '',
      phone: '',
      website: '',
      location: '',
    },
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.fullName,
    createdByPersonnelId: actor?.id,
  };
}

function mapCompany(raw: Record<string, unknown>): CatalogCompany {
  return {
    labelEn: str(raw.labelEn, 'THE COMPANY'),
    labelRtl: str(raw.labelRtl, 'درباره شرکت'),
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
    website: str(raw.website) || undefined,
  };
}

function mapIntro(raw: Record<string, unknown>, base: CatalogIntro): CatalogIntro {
  return {
    sectionNum: str(raw.sectionNum, base.sectionNum),
    titleEn: str(raw.titleEn, base.titleEn),
    titleRtl: str(raw.titleRtl, base.titleRtl),
    contentEn: str(raw.contentEn),
    contentRtl: str(raw.contentRtl),
  };
}

function mapService(raw: Record<string, unknown>): CatalogService {
  return {
    id: str(raw.id, uid('svc')),
    serviceNum: str(raw.serviceNum, '1'),
    titleEn: str(raw.titleEn),
    titleRtl: str(raw.titleRtl),
    descEn: str(raw.descEn),
    descRtl: str(raw.descRtl),
    forEn: str(raw.forEn) || undefined,
    forRtl: str(raw.forRtl) || undefined,
  };
}

function mapArea(raw: Record<string, unknown>): CatalogArea {
  const services = Array.isArray(raw.services)
    ? (raw.services as Record<string, unknown>[]).map(mapService)
    : [];
  return {
    id: str(raw.id, uid('area')),
    areaNum: str(raw.areaNum, '1'),
    areaTitleEn: str(raw.areaTitleEn),
    areaTitleRtl: str(raw.areaTitleRtl),
    areaIntroEn: str(raw.areaIntroEn) || undefined,
    areaIntroRtl: str(raw.areaIntroRtl) || undefined,
    services,
  };
}

function mapHowWeWork(raw: Record<string, unknown>, base: CatalogHowWeWork): CatalogHowWeWork {
  return {
    sectionNum: str(raw.sectionNum, base.sectionNum),
    titleEn: str(raw.titleEn, base.titleEn),
    titleRtl: str(raw.titleRtl, base.titleRtl),
    pointsEn: Array.isArray(raw.pointsEn) ? raw.pointsEn.map(x => str(x)).filter(Boolean) : [],
    pointsRtl: Array.isArray(raw.pointsRtl) ? raw.pointsRtl.map(x => str(x)).filter(Boolean) : [],
  };
}

function mapContact(raw: Record<string, unknown>, base: CatalogContact): CatalogContact {
  return {
    sectionNum: str(raw.sectionNum, base.sectionNum),
    titleEn: str(raw.titleEn, base.titleEn),
    titleRtl: str(raw.titleRtl, base.titleRtl),
    contentEn: str(raw.contentEn) || undefined,
    contentRtl: str(raw.contentRtl) || undefined,
    email: str(raw.email) || undefined,
    phone: str(raw.phone) || undefined,
    website: str(raw.website) || undefined,
    location: str(raw.location) || undefined,
  };
}

const STATUS: CatalogStatus[] = ['draft', 'published'];
const LAYOUTS: ContractLogoLayout[] = ['title-left', 'title-right', 'banner-top', 'corners'];

export function parseCatalogJson(input: unknown, actor?: { fullName?: string; id?: string }): CompanyCatalog {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const root = input as Record<string, unknown>;
  const raw = (root.catalog && typeof root.catalog === 'object'
    ? root.catalog
    : root) as Record<string, unknown>;

  if (!str(raw.titleEn) && !str(raw.titleRtl) && !str(raw.refNo)) {
    throw new Error('missing_fields');
  }

  const base = emptyCatalog(actor);
  const status = STATUS.includes(raw.status as CatalogStatus) ? (raw.status as CatalogStatus) : 'draft';
  const rtlLanguage: CatalogRtlLanguage = raw.rtlLanguage === 'ar' ? 'ar' : 'fa';
  const layout = LAYOUTS.includes(raw.contractLogoLayout as ContractLogoLayout)
    ? (raw.contractLogoLayout as ContractLogoLayout)
    : 'corners';

  const languages = Array.isArray(raw.languages)
    ? raw.languages.map(x => str(x)).filter(Boolean)
    : base.languages;
  const areas = Array.isArray(raw.areas)
    ? (raw.areas as Record<string, unknown>[]).map(mapArea)
    : [];

  const now = new Date().toISOString();
  return {
    ...base,
    id: str(raw.id) || base.id,
    refNo: str(raw.refNo) || genCatalogRefNo(),
    titleEn: str(raw.titleEn, base.titleEn),
    titleRtl: str(raw.titleRtl, base.titleRtl),
    subtitleEn: str(raw.subtitleEn) || undefined,
    subtitleRtl: str(raw.subtitleRtl) || undefined,
    catalogDate: str(raw.catalogDate, today()),
    logoUrl: str(raw.logoUrl) || undefined,
    logo2Url: str(raw.logo2Url) || undefined,
    contractLogoLayout: layout,
    contractLogoAlign: (raw.contractLogoAlign as CompanyCatalog['contractLogoAlign']) || 'center',
    contractLogoSize: (raw.contractLogoSize as CompanyCatalog['contractLogoSize']) || 'md',
    companyName: str(raw.companyName) || base.companyName,
    languages: languages.length ? languages : base.languages,
    rtlLanguage,
    company: raw.company && typeof raw.company === 'object'
      ? mapCompany(raw.company as Record<string, unknown>)
      : base.company,
    intro: raw.intro && typeof raw.intro === 'object'
      ? mapIntro(raw.intro as Record<string, unknown>, base.intro)
      : base.intro,
    areas,
    howWeWork: raw.howWeWork && typeof raw.howWeWork === 'object'
      ? mapHowWeWork(raw.howWeWork as Record<string, unknown>, base.howWeWork)
      : base.howWeWork,
    contact: raw.contact && typeof raw.contact === 'object'
      ? mapContact(raw.contact as Record<string, unknown>, base.contact)
      : base.contact,
    status,
    createdAt: typeof raw.createdAt === 'string'
      ? raw.createdAt
      : (typeof raw.createdAt === 'number' ? new Date(raw.createdAt).toISOString() : now),
    updatedAt: now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
  };
}

export function exportCatalogEnvelope(c: CompanyCatalog): Record<string, unknown> {
  return {
    _schema_version: '1.0',
    _about: 'Bilingual company services catalog (English + RTL/Persian). Marketing/reference document — NOT a priced proposal or contract.',
    _for_ai_models:
      'Return ONLY valid JSON. Use envelope with top-level "catalog", OR a flat root with the same keys. '
      + 'Write full professional bilingual content (not placeholders). intro, areas[] with services[], howWeWork (pointsEn/pointsRtl arrays), contact. '
      + 'Each area needs areaNum, areaTitleEn, areaTitleRtl, services[] with serviceNum, titleEn, titleRtl, descEn, descRtl, forEn?, forRtl?. '
      + 'Each array item needs string id. Omit id/createdAt/updatedAt on import — app assigns them.',
    catalog: {
      refNo: c.refNo,
      titleEn: c.titleEn,
      titleRtl: c.titleRtl,
      subtitleEn: c.subtitleEn || '',
      subtitleRtl: c.subtitleRtl || '',
      catalogDate: c.catalogDate,
      logoUrl: c.logoUrl || '',
      logo2Url: c.logo2Url || '',
      contractLogoLayout: c.contractLogoLayout || 'corners',
      companyName: c.companyName || '',
      languages: c.languages,
      rtlLanguage: c.rtlLanguage,
      company: c.company,
      intro: c.intro,
      areas: c.areas,
      howWeWork: c.howWeWork,
      contact: c.contact,
      status: c.status,
    },
  };
}

export function buildCatalogSampleEnvelope(): Record<string, unknown> {
  return catalogSampleEnvelope as Record<string, unknown>;
}

export function downloadCatalogJson(data: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function catalogDisplayName(c: CompanyCatalog): string {
  return c.titleEn || c.titleRtl || c.refNo;
}
