import type {
  RealEstateDealType,
  RealEstateProposal,
  RealEstateProposalParty,
  RealEstateProposalPhoto,
  RealEstateProposalSection,
  RealEstateProposalStatus,
  RealEstatePropertyHighlight,
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

export const RE_DEAL_TYPES: RealEstateDealType[] = ['sale', 'rent', 'investment', 'lease'];

export function genRealEstateProposalRefNo(): string {
  const y = new Date().getFullYear();
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `REP-${y}-${n}`;
}

export function emptyRealEstateProperty(): RealEstatePropertyHighlight {
  return {
    dealType: 'sale',
    propertyTypeEn: 'Villa',
    propertyTypeRtl: 'ویلا',
    titleEn: '',
    titleRtl: '',
    addressEn: '',
    addressRtl: '',
    city: 'Muscat',
    district: '',
    areaSqm: '',
    bedrooms: '',
    bathrooms: '',
    floors: '',
    yearBuilt: '',
    furnishingEn: '',
    furnishingRtl: '',
    price: '',
    priceNoteEn: '',
    priceNoteRtl: '',
    currency: 'OMR',
    amenitiesEn: [],
    amenitiesRtl: [],
  };
}

export function emptyRealEstateProposal(actor?: { fullName?: string; id?: string }): RealEstateProposal {
  const now = new Date().toISOString();
  return {
    id: `rep-${Date.now()}`,
    refNo: genRealEstateProposalRefNo(),
    titleEn: 'REAL ESTATE PROPOSAL',
    titleRtl: 'صورت پروپوزال املاک',
    subtitleEn: 'Exclusive property presentation',
    subtitleRtl: 'ارائه اختصاصی ملک',
    proposalDate: today(),
    validUntil: plusDays(21),
    logoUrl: '',
    logo2Url: '',
    contractLogoLayout: 'corners',
    contractLogoAlign: 'center',
    contractLogoSize: 'md',
    companyName: 'Tohid Dayhami Business Solutions Center SPC',
    parties: [
      {
        id: uid('ag'),
        labelEn: 'AGENCY / ADVISOR',
        labelRtl: 'آژانس / مشاور',
        companyEn: 'Tohid Dayhami Business Solutions Center SPC',
        companyRtl: 'مرکز راهکارهای کسب‌وکار توحید دیهمی',
        country: 'Sultanate of Oman',
        repNameEn: '',
        repNameRtl: '',
        repTitleEn: 'Real Estate Advisor',
        repTitleRtl: 'مشاور املاک',
        contactEmail: '',
        contactPhone: '',
      },
      {
        id: uid('cl'),
        labelEn: 'CLIENT',
        labelRtl: 'موکل / خریدار',
        companyEn: '',
        companyRtl: '',
        country: '',
        repNameEn: '',
        repNameRtl: '',
        contactEmail: '',
        contactPhone: '',
      },
    ],
    property: emptyRealEstateProperty(),
    sections: [
      {
        id: uid('ov'),
        sectionNum: '01',
        titleEn: 'PROPERTY OVERVIEW',
        titleRtl: 'معرفی ملک',
        contentEn: '',
        contentRtl: '',
      },
      {
        id: uid('loc'),
        sectionNum: '02',
        titleEn: 'LOCATION & ACCESS',
        titleRtl: 'موقعیت و دسترسی',
        contentEn: '',
        contentRtl: '',
      },
      {
        id: uid('inv'),
        sectionNum: '03',
        titleEn: 'INVESTMENT RATIONALE',
        titleRtl: 'منطق سرمایه‌گذاری',
        contentEn: '',
        contentRtl: '',
      },
      {
        id: uid('nxt'),
        sectionNum: '04',
        titleEn: 'NEXT STEPS',
        titleRtl: 'گام‌های بعدی',
        contentEn: 'We recommend a private viewing, followed by due diligence and commercial negotiation.',
        contentRtl: 'پیشنهاد ما بازدید خصوصی، سپس بررسی حقوقی و مذاکره تجاری است.',
      },
    ],
    photos: [],
    currency: 'OMR',
    rtlLanguage: 'fa',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.fullName,
    createdByPersonnelId: actor?.id,
  };
}

function mapParty(raw: Record<string, unknown>): RealEstateProposalParty {
  return {
    id: str(raw.id, uid('party')),
    labelEn: str(raw.labelEn),
    labelRtl: str(raw.labelRtl),
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

function mapSection(raw: Record<string, unknown>): RealEstateProposalSection {
  return {
    id: str(raw.id, uid('sec')),
    sectionNum: str(raw.sectionNum),
    titleEn: str(raw.titleEn),
    titleRtl: str(raw.titleRtl),
    contentEn: str(raw.contentEn),
    contentRtl: str(raw.contentRtl),
  };
}

function mapPhoto(raw: Record<string, unknown>): RealEstateProposalPhoto {
  return {
    id: str(raw.id, uid('ph')),
    url: str(raw.url),
    captionEn: str(raw.captionEn) || undefined,
    captionRtl: str(raw.captionRtl) || undefined,
  };
}

function mapProperty(raw: Record<string, unknown> | undefined): RealEstatePropertyHighlight {
  const base = emptyRealEstateProperty();
  if (!raw) return base;
  const deal = RE_DEAL_TYPES.includes(raw.dealType as RealEstateDealType)
    ? (raw.dealType as RealEstateDealType)
    : 'sale';
  return {
    dealType: deal,
    propertyTypeEn: str(raw.propertyTypeEn, base.propertyTypeEn),
    propertyTypeRtl: str(raw.propertyTypeRtl, base.propertyTypeRtl),
    titleEn: str(raw.titleEn),
    titleRtl: str(raw.titleRtl),
    addressEn: str(raw.addressEn) || undefined,
    addressRtl: str(raw.addressRtl) || undefined,
    city: str(raw.city) || undefined,
    district: str(raw.district) || undefined,
    areaSqm: str(raw.areaSqm) || undefined,
    bedrooms: str(raw.bedrooms) || undefined,
    bathrooms: str(raw.bathrooms) || undefined,
    floors: str(raw.floors) || undefined,
    yearBuilt: str(raw.yearBuilt) || undefined,
    furnishingEn: str(raw.furnishingEn) || undefined,
    furnishingRtl: str(raw.furnishingRtl) || undefined,
    price: str(raw.price) || undefined,
    priceNoteEn: str(raw.priceNoteEn) || undefined,
    priceNoteRtl: str(raw.priceNoteRtl) || undefined,
    currency: str(raw.currency, 'OMR'),
    amenitiesEn: Array.isArray(raw.amenitiesEn) ? raw.amenitiesEn.map(x => str(x)).filter(Boolean) : [],
    amenitiesRtl: Array.isArray(raw.amenitiesRtl) ? raw.amenitiesRtl.map(x => str(x)).filter(Boolean) : [],
  };
}

const STATUS: RealEstateProposalStatus[] = ['draft', 'sent', 'accepted', 'declined'];

export function parseRealEstateProposalJson(
  input: unknown,
  actor?: { fullName?: string; id?: string },
): RealEstateProposal {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const root = input as Record<string, unknown>;
  const raw = (root.realEstateProposal && typeof root.realEstateProposal === 'object'
    ? root.realEstateProposal
    : root.proposal && typeof root.proposal === 'object'
      ? root.proposal
      : root) as Record<string, unknown>;

  if (!str(raw.titleEn) && !str(raw.titleRtl) && !str(raw.refNo)) {
    throw new Error('missing_fields');
  }

  const base = emptyRealEstateProposal(actor);
  const now = new Date().toISOString();
  const status = STATUS.includes(raw.status as RealEstateProposalStatus)
    ? (raw.status as RealEstateProposalStatus)
    : 'draft';
  const rtlLanguage: ProposalRtlLanguage = raw.rtlLanguage === 'ar' ? 'ar' : 'fa';

  return {
    ...base,
    id: `rep-${Date.now()}`,
    refNo: str(raw.refNo) || genRealEstateProposalRefNo(),
    titleEn: str(raw.titleEn, base.titleEn),
    titleRtl: str(raw.titleRtl, base.titleRtl),
    subtitleEn: str(raw.subtitleEn) || undefined,
    subtitleRtl: str(raw.subtitleRtl) || undefined,
    proposalDate: str(raw.proposalDate, today()),
    validUntil: str(raw.validUntil, plusDays(21)),
    logoUrl: str(raw.logoUrl) || undefined,
    logo2Url: str(raw.logo2Url) || undefined,
    contractLogoLayout: (raw.contractLogoLayout as RealEstateProposal['contractLogoLayout']) || 'corners',
    contractLogoAlign: (raw.contractLogoAlign as RealEstateProposal['contractLogoAlign']) || 'center',
    contractLogoSize: (raw.contractLogoSize as RealEstateProposal['contractLogoSize']) || 'md',
    companyName: str(raw.companyName) || base.companyName,
    parties: Array.isArray(raw.parties) && raw.parties.length
      ? (raw.parties as Record<string, unknown>[]).map(mapParty)
      : base.parties,
    property: mapProperty(raw.property as Record<string, unknown> | undefined),
    sections: Array.isArray(raw.sections)
      ? (raw.sections as Record<string, unknown>[]).map(mapSection)
      : base.sections,
    photos: Array.isArray(raw.photos)
      ? (raw.photos as Record<string, unknown>[]).map(mapPhoto).filter(p => p.url)
      : [],
    currency: str(raw.currency, 'OMR'),
    rtlLanguage,
    status,
    createdAt: now,
    updatedAt: now,
    createdBy: actor?.fullName || str(raw.createdBy) || undefined,
    createdByPersonnelId: actor?.id || str(raw.createdByPersonnelId) || undefined,
  };
}

export function exportRealEstateProposalEnvelope(p: RealEstateProposal): Record<string, unknown> {
  return {
    _schema_version: '1.0',
    _about: 'Bilingual real-estate proposal (صورت پروپوزال املاک). Property presentation with gallery at the end.',
    _for_ai_models:
      'Return ONLY valid JSON with top-level "realEstateProposal". Include property{}, sections[], photos[] (url + captions). '
      + 'dealType: sale|rent|investment|lease. Write full professional bilingual content.',
    realEstateProposal: {
      refNo: p.refNo,
      titleEn: p.titleEn,
      titleRtl: p.titleRtl,
      subtitleEn: p.subtitleEn || '',
      subtitleRtl: p.subtitleRtl || '',
      proposalDate: p.proposalDate,
      validUntil: p.validUntil,
      logoUrl: p.logoUrl || '',
      logo2Url: p.logo2Url || '',
      companyName: p.companyName || '',
      parties: p.parties,
      property: p.property,
      sections: p.sections,
      photos: p.photos,
      currency: p.currency,
      rtlLanguage: p.rtlLanguage,
      status: p.status,
    },
  };
}

export function buildRealEstateProposalSampleEnvelope(): Record<string, unknown> {
  const sample = emptyRealEstateProposal();
  sample.refNo = 'REP-2026-1001';
  sample.titleEn = 'REAL ESTATE PROPOSAL — AL MOUJ VILLA';
  sample.titleRtl = 'صورت پروپوزال املاک — ویلای الموج';
  sample.subtitleEn = 'Waterfront residence · Muscat';
  sample.subtitleRtl = 'اقامتگاه ساحلی · مسقط';
  sample.property = {
    dealType: 'sale',
    propertyTypeEn: 'Luxury Villa',
    propertyTypeRtl: 'ویلای لوکس',
    titleEn: '4-Bedroom Waterfront Villa — Al Mouj',
    titleRtl: 'ویلای ۴ خوابه ساحلی — الموج',
    addressEn: 'Al Mouj Muscat, Wave Boulevard',
    addressRtl: 'الموج مسقط، بلوار موج',
    city: 'Muscat',
    district: 'Al Mouj',
    areaSqm: '420',
    bedrooms: '4',
    bathrooms: '5',
    floors: '2',
    yearBuilt: '2022',
    furnishingEn: 'Semi-furnished',
    furnishingRtl: 'نیمه‌مبله',
    price: '485,000',
    priceNoteEn: 'Negotiable · Exclusive listing',
    priceNoteRtl: 'قابل مذاکره · لیست اختصاصی',
    currency: 'OMR',
    amenitiesEn: ['Private pool', 'Maid room', 'Covered parking ×2', 'Smart home', 'Sea view'],
    amenitiesRtl: ['استخر خصوصی', 'اتاق خدمه', 'پارکینگ مسقف ×۲', 'خانه هوشمند', 'ویو دریا'],
  };
  sample.sections = [
    {
      id: 's1',
      sectionNum: '01',
      titleEn: 'PROPERTY OVERVIEW',
      titleRtl: 'معرفی ملک',
      contentEn: 'A contemporary waterfront villa in Al Mouj with open living spaces, a landscaped garden, and direct marina proximity. Designed for family living with a discreet staff wing and premium finishes throughout.',
      contentRtl: 'ویلای معاصر ساحلی در الموج با فضاهای نشیمن باز، باغ محوطه‌سازی‌شده و نزدیکی به مارینا. مناسب زندگی خانوادگی با بخش خدمه و متریال ممتاز در تمام فضاها.',
    },
    {
      id: 's2',
      sectionNum: '02',
      titleEn: 'LOCATION & ACCESS',
      titleRtl: 'موقعیت و دسترسی',
      contentEn: 'Minutes from The Walk, international schools, and the airport expressway — combining resort ambience with practical daily connectivity.',
      contentRtl: 'دقایقی تا The Walk، مدارس بین‌المللی و بزرگراه فرودگاه — ترکیب فضای تفریحی با دسترسی روزمره.',
    },
    {
      id: 's3',
      sectionNum: '03',
      titleEn: 'INVESTMENT RATIONALE',
      titleRtl: 'منطق سرمایه‌گذاری',
      contentEn: 'Al Mouj remains one of Muscat’s most liquid premium residential nodes. This asset offers scarcity (waterfront plot), strong tenant demand, and clear exit optionality.',
      contentRtl: 'الموج از نقدشونده‌ترین نقاط مسکونی ممتاز مسقط است. این دارایی کمیابی (پلاک ساحلی)، تقاضای اجاره قوی و امکان خروج شفاف دارد.',
    },
  ];
  sample.photos = [
    { id: 'ph1', url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200', captionEn: 'Facade & entrance', captionRtl: 'نمای اصلی و ورودی' },
    { id: 'ph2', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200', captionEn: 'Living pavilion', captionRtl: 'سالن نشیمن' },
    { id: 'ph3', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200', captionEn: 'Pool terrace', captionRtl: 'تراس استخر' },
    { id: 'ph4', url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200', captionEn: 'Master suite', captionRtl: 'سوئیت مستر' },
  ];
  return exportRealEstateProposalEnvelope(sample);
}

export function downloadRealEstateProposalJson(data: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function realEstateProposalClientName(p: RealEstateProposal): string {
  const client = p.parties[1] || p.parties[0];
  return client?.companyEn || client?.companyRtl || client?.repNameEn || '—';
}

export function dealTypeLabel(deal: RealEstateDealType, lang: 'fa' | 'en'): string {
  const map: Record<RealEstateDealType, { fa: string; en: string }> = {
    sale: { fa: 'فروش', en: 'For Sale' },
    rent: { fa: 'اجاره', en: 'For Rent' },
    investment: { fa: 'سرمایه‌گذاری', en: 'Investment' },
    lease: { fa: 'لیزینگ', en: 'Lease' },
  };
  return lang === 'fa' ? map[deal].fa : map[deal].en;
}
