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
    _about: 'Bilingual legal contract JSON (English + RTL). Used by Invoices → Contracts. NOT a commercial proposal.',
    _for_ai_models:
      'Return ONLY valid JSON. Use envelope { "contract": { ... } } OR a flat object with the same keys. '
      + 'This is a LEGAL CONTRACT — use clauses[] (not proposal sections[]), scheduleRows[] (not lineItems[]), and effectiveDate (not proposalDate). '
      + 'Required: titleEn or titleRtl, parties[] (min 2: Service Provider + Client), clauses[] with articleNum/titleEn/titleRtl/contentEn/contentRtl. '
      + 'Optional: refNo, subtitleEn/subtitleRtl, effectiveDate YYYY-MM-DD, scheduleRows[] ({ tierEn, tierRtl, buildFee, annualFee, interpretation }), '
      + 'addOns[] ({ nameEn, nameRtl, price, descEn?, descRtl? }), rtlLanguage (fa|ar), status (draft|final|signed), '
      + 'contractLogoLayout (corners|title-left|title-right|banner-top), contractLogoAlign, contractLogoSize. '
      + 'Party fields: labelEn, labelRtl, companyEn, companyRtl, regNo, country, repNameEn/Rtl, repTitleEn/Rtl, aliasEn/Rtl, contactEmail, contactPhone. '
      + 'Use articleNum "RECITALS" for the recitals block. Preserve clauses[] order. Omit id/createdAt/updatedAt on import — app assigns them.',
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
      parties: c.parties.map(p => ({
        labelEn: p.labelEn,
        labelRtl: p.labelRtl,
        companyEn: p.companyEn,
        companyRtl: p.companyRtl,
        regNo: p.regNo || '',
        country: p.country || '',
        repNameEn: p.repNameEn || '',
        repNameRtl: p.repNameRtl || '',
        repTitleEn: p.repTitleEn || '',
        repTitleRtl: p.repTitleRtl || '',
        aliasEn: p.aliasEn || '',
        aliasRtl: p.aliasRtl || '',
        contactEmail: p.contactEmail || '',
        contactPhone: p.contactPhone || '',
      })),
      clauses: c.clauses.map(cl => ({
        articleNum: cl.articleNum,
        titleEn: cl.titleEn,
        titleRtl: cl.titleRtl,
        contentEn: cl.contentEn,
        contentRtl: cl.contentRtl,
      })),
      scheduleRows: c.scheduleRows.map(sr => ({
        tierEn: sr.tierEn,
        tierRtl: sr.tierRtl,
        buildFee: sr.buildFee,
        annualFee: sr.annualFee,
        interpretation: sr.interpretation,
        ...(sr.selected ? { selected: true } : {}),
      })),
      addOns: c.addOns.map(ao => ({
        nameEn: ao.nameEn,
        nameRtl: ao.nameRtl,
        price: ao.price,
        descEn: ao.descEn || '',
        descRtl: ao.descRtl || '',
        ...(ao.selected ? { selected: true } : {}),
      })),
      rtlLanguage: c.rtlLanguage,
      status: c.status,
    },
  };
}

/** Ready-to-download bilingual legal contract sample for AI prompts and quick import. */
export function buildContractSampleEnvelope(actor?: { fullName?: string; id?: string }): Record<string, unknown> {
  const base = emptyContract(actor);
  const sample: LegalContract = {
    ...base,
    titleEn: 'SERVICES AGREEMENT — EXPORT CONSULTANCY',
    titleRtl: 'قرارداد ارائه خدمات — مشاوره صادرات',
    subtitleEn: 'Metaverse Export Pavilion & Market Entry Support',
    subtitleRtl: 'غرفه صادراتی متاورسی و پشتیبانی ورود به بازار',
    effectiveDate: today(),
    parties: [
      {
        ...base.parties[0],
        companyEn: 'Tohid Dayhami Business Solutions Center SPC',
        companyRtl: 'مرکز راهکارهای کسب‌وکار توحید دیهمی',
        regNo: '1234567',
        country: 'Sultanate of Oman',
        repNameEn: 'Tohid Dayhami',
        repNameRtl: 'توحید دیهمی',
        repTitleEn: 'Managing Director',
        repTitleRtl: 'مدیرعامل',
        aliasEn: 'the Service Provider',
        aliasRtl: 'ارائه‌دهنده‌ی خدمات',
        contactEmail: 'info@tohiddayhami.com',
        contactPhone: '+968 XXXX XXXX',
      },
      {
        ...base.parties[1],
        companyEn: 'Gulf Trading LLC',
        companyRtl: 'بازرگانی خلیج',
        regNo: '7654321',
        country: 'Sultanate of Oman',
        repNameEn: 'Ali Rezaei',
        repNameRtl: 'علی رضایی',
        repTitleEn: 'General Manager',
        repTitleRtl: 'مدیر عامل',
        aliasEn: 'the Client',
        aliasRtl: 'مشتری',
        contactEmail: 'ali@example.com',
        contactPhone: '+968 9123 4567',
      },
    ],
    clauses: [
      {
        id: 'rec',
        articleNum: 'RECITALS',
        titleEn: 'RECITALS',
        titleRtl: 'مقدمه',
        contentEn:
          'WHEREAS the Service Provider is engaged in export consultancy, digital trade solutions, and business development services; '
          + 'AND WHEREAS the Client wishes to engage the Service Provider for market entry and export support services; '
          + 'NOW, THEREFORE, the parties agree as follows.',
        contentRtl:
          'با عنایت به اینکه ارائه‌دهنده‌ی خدمات در حوزه مشاوره صادرات، راهکارهای تجارت دیجیتال و توسعه کسب‌وکار فعالیت می‌کند؛ '
          + 'و با عنایت به اینکه مشتری تمایل دارد از خدمات ورود به بازار و پشتیبانی صادراتی بهره‌مند شود؛ '
          + 'اکنون طرفین توافق می‌نمایند.',
      },
      {
        id: 'a1',
        articleNum: '1',
        titleEn: 'DEFINITIONS',
        titleRtl: 'تعاریف',
        contentEn:
          '"Services" means export consultancy, documentation, MetaShop setup, and related deliverables described in Schedule A.\n'
          + '"Effective Date" means the date first written above.\n'
          + '"Fees" means the amounts payable under Schedule A.',
        contentRtl:
          '«خدمات» به مشاوره صادرات، مستندسازی، راه‌اندازی متا‌شاپ و تحویل‌دادنی‌های مندرج در پیوست الف اطلاق می‌شود.\n'
          + '«تاریخ اجرا» تاریخ مندرج در ابتدای این قرارداد است.\n'
          + '«حق‌الزحمه» مبالغ قابل پرداخت طبق پیوست الف است.',
      },
      {
        id: 'a2',
        articleNum: '2',
        titleEn: 'SCOPE OF SERVICES',
        titleRtl: 'دامنه خدمات',
        contentEn:
          'The Service Provider shall perform the Services with reasonable skill and care, including:\n'
          + '• Export market assessment and documentation package\n'
          + '• Brand and product positioning for target markets\n'
          + '• MetaShop catalog setup (up to agreed SKU count)\n'
          + '• Coordination of registration and compliance steps as agreed',
        contentRtl:
          'ارائه‌دهنده‌ی خدمات موظف است خدمات را با مهارت و دقت معقول انجام دهد، از جمله:\n'
          + '• ارزیابی بازار صادرات و بسته مستندسازی\n'
          + '• جایگاه‌یابی برند و محصول در بازارهای هدف\n'
          + '• راه‌اندازی کاتالوگ متا‌شاپ (تا تعداد SKU توافق‌شده)\n'
          + '• هماهنگی مراحل ثبت و انطباق طبق توافق',
      },
      {
        id: 'a3',
        articleNum: '3',
        titleEn: 'FEES & PAYMENT',
        titleRtl: 'حق‌الزحمه و پرداخت',
        contentEn:
          'The Client shall pay the Fees set out in Schedule A. Unless otherwise stated, 50% is due upon signing and 50% upon delivery of final deliverables. '
          + 'All amounts are in Omani Rial (OMR) unless specified otherwise.',
        contentRtl:
          'مشتری حق‌الزحمه مندرج در پیوست الف را پرداخت می‌نماید. مگر خلاف آن مقرر شود، ۵۰٪ هنگام امضا و ۵۰٪ پس از تحویل نهایی قابل پرداخت است. '
          + 'کلیه مبالغ به ریال عمان مگر آنکه خلاف آن ذکر شده باشد.',
      },
    ],
    scheduleRows: [
      {
        id: 'sr1',
        tierEn: 'Standard Package',
        tierRtl: 'بسته استاندارد',
        buildFee: '1,500',
        annualFee: '350',
        interpretation: '10',
        selected: true,
      },
      {
        id: 'sr2',
        tierEn: 'Premium Package',
        tierRtl: 'بسته ویژه',
        buildFee: '2,800',
        annualFee: '600',
        interpretation: '20',
        selected: false,
      },
    ],
    addOns: [
      {
        id: 'ao1',
        nameEn: 'Rush processing (7 days)',
        nameRtl: 'پردازش فوری (۷ روز)',
        descEn: 'Expedited delivery of documentation',
        descRtl: 'تحویل تسریع‌شده مستندات',
        price: '250',
        selected: false,
      },
      {
        id: 'ao2',
        nameEn: 'Extra interpretation hours',
        nameRtl: 'ساعت تفسیر اضافه',
        descEn: 'Per hour beyond Schedule A allowance',
        descRtl: 'به ازای هر ساعت فراتر از سقف پیوست الف',
        price: '45',
        selected: false,
      },
    ],
    status: 'draft',
  };
  return exportContractEnvelope(sample);
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
