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
  return `CTR-${y}-${n}`;
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
    currency: 'OMR',
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
    articleNum: str(raw.articleNum ?? raw.sectionNum, '1'),
    titleEn: str(raw.titleEn),
    titleRtl: str(raw.titleRtl),
    contentEn: str(raw.contentEn),
    contentRtl: str(raw.contentRtl),
  };
}

function mapSchedule(raw: Record<string, unknown>): ContractScheduleRow {
  return {
    id: str(raw.id, uid('sr')),
    tierEn: str(raw.tierEn ?? raw.itemEn),
    tierRtl: str(raw.tierRtl ?? raw.itemRtl),
    buildFee: str(raw.buildFee ?? raw.unitPrice ?? raw.total, '0'),
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

/** Normalize AI/proposal-style aliases into contract fields. */
function normalizeContractRaw(input: Record<string, unknown>): Record<string, unknown> {
  let raw: Record<string, unknown>;
  if (input.contract && typeof input.contract === 'object') {
    raw = { ...(input.contract as Record<string, unknown>) };
  } else if (input.proposal && typeof input.proposal === 'object') {
    raw = { ...(input.proposal as Record<string, unknown>) };
  } else {
    raw = { ...input };
  }

  if (!Array.isArray(raw.clauses) && Array.isArray(raw.sections)) {
    raw.clauses = (raw.sections as Record<string, unknown>[]).map(mapClause);
  }
  if (!Array.isArray(raw.scheduleRows) && Array.isArray(raw.lineItems)) {
    raw.scheduleRows = (raw.lineItems as Record<string, unknown>[]).map(mapSchedule);
  }
  if (!str(raw.effectiveDate) && str(raw.proposalDate)) {
    raw.effectiveDate = raw.proposalDate;
  }

  return raw;
}

const STATUS: ContractStatus[] = ['draft', 'final', 'signed'];
const LAYOUTS: ContractLogoLayout[] = ['title-left', 'title-right', 'banner-top', 'corners'];

export function parseContractJson(input: unknown, actor?: { fullName?: string; id?: string }): LegalContract {
  if (!input || typeof input !== 'object') throw new Error('invalid_json');
  const raw = normalizeContractRaw(input as Record<string, unknown>);

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
    currency: str(raw.currency, 'OMR'),
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

const AI_MODELS_HINT =
  'Return ONLY valid JSON. Use envelope with top-level "contract", OR a flat root with the same keys. '
  + 'Mirror the commercial proposal layout: bilingual title/subtitle, parties[], clauses[] (like sections[]), '
  + 'scheduleRows[] (like lineItems[]), addOns[], currency, rtlLanguage, status. '
  + 'Each clause: id, articleNum (use "RECITALS" for recitals, then "1","2",…), titleEn, titleRtl, contentEn, contentRtl. '
  + 'Write full professional legal paragraphs in BOTH languages (not placeholders). Use \\n for lists. '
  + 'scheduleRows[]: tierEn, tierRtl, buildFee, annualFee, interpretation, selected. '
  + 'effectiveDate = YYYY-MM-DD (not proposalDate). Aliases accepted on import: sections→clauses, lineItems→scheduleRows, proposalDate→effectiveDate. '
  + 'Omit id/createdAt/updatedAt on import — app assigns them.';

export function exportContractEnvelope(c: LegalContract): Record<string, unknown> {
  return {
    _schema_version: '1.0',
    _about: 'Bilingual legal contract JSON (English + RTL). Used by Invoices → Contracts. Same layout as commercial proposal JSON but with contract fields.',
    _for_ai_models: AI_MODELS_HINT,
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
      companyName: c.companyName || '',
      parties: c.parties,
      clauses: c.clauses,
      scheduleRows: c.scheduleRows,
      addOns: c.addOns,
      currency: c.currency,
      rtlLanguage: c.rtlLanguage,
      status: c.status,
    },
  };
}

/** Ready-to-download bilingual legal contract sample for AI prompts and quick import. */
export function buildContractSampleEnvelope(actor?: { fullName?: string; id?: string }): Record<string, unknown> {
  const sample = exportContractEnvelope(emptyContract(actor));
  const contract = sample.contract as LegalContract;
  contract.refNo = 'CTR-2026-PKG-020';
  contract.titleEn = 'METAVERSE EXPORT PAVILION — SERVICES AGREEMENT';
  contract.titleRtl = 'قرارداد خدمات غرفه صادراتی متاورسی';
  contract.subtitleEn = 'Export Pavilion Build, MetaShop Setup & Market Entry Support';
  contract.subtitleRtl = 'راه‌اندازی غرفه صادراتی، متا‌شاپ و پشتیبانی ورود به بازار';
  contract.effectiveDate = today();
  contract.currency = 'OMR';
  contract.parties = [
    {
      id: 'sp1',
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
      contactEmail: '',
      contactPhone: '',
    },
    {
      id: 'cl1',
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
      contactEmail: '',
      contactPhone: '',
    },
  ];
  contract.clauses = [
    {
      id: 'rec',
      articleNum: 'RECITALS',
      titleEn: 'RECITALS',
      titleRtl: 'مقدمه',
      contentEn:
        'WHEREAS the Service Provider specialises in export consultancy, digital trade infrastructure, and Metaverse Export Pavilion solutions;\n'
        + 'AND WHEREAS the Client wishes to engage the Service Provider to design, build, and operate a bilingual export pavilion with integrated MetaShop catalog and market-entry support;\n'
        + 'NOW, THEREFORE, the parties agree to enter into this Services Agreement on the terms set out below.',
      contentRtl:
        'با عنایت به تخصص ارائه‌دهنده‌ی خدمات در مشاوره صادرات، زیرساخت تجارت دیجیتال و راهکارهای غرفه صادراتی متاورسی؛\n'
        + 'و با عنایت به تمایل مشتری برای بهره‌گیری از طراحی، راه‌اندازی و بهره‌برداری از غرفه صادراتی دوزبانه همراه با کاتالوگ متا‌شاپ و پشتیبانی ورود به بازار؛\n'
        + 'اکنون طرفین توافق می‌نمایند این قرارداد خدمات را با شرایط زیر منعقد کنند.',
    },
    {
      id: 'a1',
      articleNum: '1',
      titleEn: 'SCOPE & DELIVERABLES',
      titleRtl: 'دامنه و تحویل‌دادنی‌ها',
      contentEn:
        'The Service Provider shall deliver the following, as further detailed in Schedule A:\n'
        + '• Metaverse Export Pavilion environment (branded booth, product zones, visitor flow)\n'
        + '• MetaShop bilingual product catalog (SKU upload, pricing, media assets)\n'
        + '• Export documentation starter pack and compliance checklist\n'
        + '• Market-entry briefing and handover session',
      contentRtl:
        'ارائه‌دهنده‌ی خدمات موارد زیر را طبق جزئیات پیوست الف تحویل می‌دهد:\n'
        + '• محیط غرفه صادراتی متاورسی (غرفه برندشده، زون محصول، مسیر بازدیدکننده)\n'
        + '• کاتالوگ دوزبانه متا‌شاپ (بارگذاری SKU، قیمت‌گذاری، رسانه)\n'
        + '• بسته آغازین مستندات صادرات و چک‌لیست انطباق\n'
        + '• جلسه توجیهی ورود به بازار و تحویل نهایی',
    },
    {
      id: 'a2',
      articleNum: '2',
      titleEn: 'FEES & PAYMENT',
      titleRtl: 'حق‌الزحمه و پرداخت',
      contentEn:
        'Fees are set out in Schedule A (OMR). Unless otherwise agreed in writing, fifty percent (50%) is payable upon execution of this Agreement and fifty percent (50%) upon completion of deliverables.\n'
        + 'All amounts are exclusive of applicable taxes. Late payments may accrue interest at 1% per month.',
      contentRtl:
        'حق‌الزحمه در پیوست الف (ریال عمان) تعیین شده است. مگر خلاف آن کتباً توافق شود، پنجاه درصد (۵۰٪) هنگام امضا و پنجاه درصد (۵۰٪) پس از تکمیل تحویل‌دادنی‌ها قابل پرداخت است.\n'
        + 'کلیه مبالغ بدون مالیات‌های قابل اجرا است. تأخیر در پرداخت می‌تواند مشمول جریمه ۱٪ ماهانه شود.',
    },
    {
      id: 'a3',
      articleNum: '3',
      titleEn: 'TERM & GOVERNING LAW',
      titleRtl: 'مدت و قانون حاکم',
      contentEn:
        'This Agreement commences on the Effective Date and continues for twelve (12) months unless terminated earlier in accordance with its terms.\n'
        + 'This Agreement is governed by the laws of the Sultanate of Oman. Disputes shall be resolved amicably, failing which the courts of Muscat shall have exclusive jurisdiction.',
      contentRtl:
        'این قرارداد از تاریخ اجرا آغاز و به مدت دوازده (۱۲) ماه ادامه می‌یابد مگر زودتر طبق شرایط فسخ شود.\n'
        + 'این قرارداد تابع قوانین سلطنت عمان است. اختلافات ابتدا دوستانه حل می‌شود و در غیر این صورت دادگاه‌های مسقط صلاحیت انحصاری دارند.',
    },
  ];
  contract.scheduleRows = [
    {
      id: 'sr1',
      tierEn: 'Package A — Pavilion Standard',
      tierRtl: 'بسته الف — غرفه استاندارد',
      buildFee: '1,500',
      annualFee: '350',
      interpretation: '10',
      selected: true,
    },
    {
      id: 'sr2',
      tierEn: 'Package B — Pavilion Premium',
      tierRtl: 'بسته ب — غرفه ویژه',
      buildFee: '2,800',
      annualFee: '600',
      interpretation: '20',
      selected: false,
    },
  ];
  contract.addOns = [
    {
      id: 'ao1',
      nameEn: 'Rush delivery (7 business days)',
      nameRtl: 'تحویل فوری (۷ روز کاری)',
      descEn: 'Expedited pavilion build and catalog upload',
      descRtl: 'راه‌اندازی تسریع‌شده غرفه و بارگذاری کاتالوگ',
      price: '250',
      selected: false,
    },
  ];
  return sample;
}

export function downloadContractJson(data: Record<string, unknown>, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function contractClientName(c: LegalContract): string {
  const client = c.parties.find(x => /client|مشتری/i.test(x.labelEn) || /مشتری/.test(x.labelRtl)) || c.parties[1];
  return client?.companyEn || client?.companyRtl || client?.repNameEn || '—';
}
