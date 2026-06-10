import { MetaShop } from '../types';

// Full sample shops in the native MetaShop import format.
// Importing either one builds a complete shop (theme, cover/background image, logo,
// contact, and products/services) that you can then fine-tune in the editor.

const CF = 'https://d8j0ntlcm91z4.cloudfront.net/user_37LxMnMIKo1nDrfSeM1P16PUV6Y';

export const PRODUCTS_SAMPLE: MetaShop = {
  id: 'sample-products',
  slug: 'iranian-fresh-produce',
  name: 'Premium Iranian Fresh Produce',
  type: 'products',
  isActive: true,
  currency: 'USD',
  theme: {
    primary: '#2d4a1a',
    cover: '#2d4a1a',
    coverText: '#fdfbf6',
    bg: '#fdfbf6',
    heading: '#1f2a18',
    text: '#2d3a24',
  },
  collectionText: 'Iranian Fresh Produce Range',
  title: 'PREMIUM IRANIAN FRESH PRODUCE CATALOGUE',
  subtitle: 'From Iranian Orchards & Greenhouses to Global Markets via Sohar Port — 2026 Edition',
  coverImage: `${CF}/hf_20260515_160733_5dc0c535-0fb8-478b-8c7b-e456964d7213.png`,
  logo: '',
  phone: '+968 98 1030 64',
  email: 'info@tohiddayhami.com',
  website: 'www.tohiddayhami.com',
  address: 'Muscat, Sultanate of Oman | CR No. 1617064 | Cold-chain ex Sohar Port',
  footerText: 'Tohid Dayhami Business Solutions | Premium Iranian Fresh Produce Exporter | Cold-chain via Sohar, Oman',
  cartButtonText: 'Request FOB/CIF Quote',
  orderThankYouText: 'Thank you! Your fresh produce inquiry has been received. We will prepare a proforma invoice with FOB Sohar / CIF pricing within 24 hours. Keep your tracking code below.',
  searchPlaceholder: 'Search all products...',
  defaultLang: 'en',
  languages: [{ code: 'en', name: 'English' }, { code: 'zh', name: '中文' }],
  i18n: { zh: { title: '高级伊朗新鲜农产品目录', subtitle: '从伊朗果园和温室经苏哈尔港销往全球 — 2026 版', collectionText: '伊朗新鲜农产品系列' } },
  productsTabLabel: 'فهرست محصولات',
  productsTabLabelEn: 'Product List',
  assignType: undefined,
  assignedPersonnelIds: [],
  extraFees: [
    { id: 'fee-ship', label: 'هزینه ارسال', labelEn: 'Shipping fee', amount: 2, required: false, defaultOn: true },
    { id: 'fee-pack', label: 'هزینه بسته‌بندی ویژه', labelEn: 'Special packaging', amount: 1, required: false, defaultOn: false },
  ],
  discounts: [
    { id: 'disc-nowruz', code: 'NOWRUZ', type: 'percent', value: 10, scope: 'all', active: true, label: 'Nowruz 10% off everything' },
    { id: 'disc-pistachio', code: 'PISTACHIO5', type: 'fixed', value: 5, scope: 'products', productIds: ['sp1'], active: true, label: '$5 off pistachios' },
  ],
  taxRate: 9,
  taxInclusive: false,
  taxLabel: 'مالیات بر ارزش افزوده',
  taxLabelEn: 'VAT',
  pages: [
    {
      id: 'pg-about', label: 'درباره ما', labelEn: 'About Us', type: 'text',
      bodyEn: 'Tohid Dayhami Business Solutions is a Muscat-based exporter of premium Iranian fresh produce, dried fruits, nuts, and specialty agricultural products. We operate strategic cold-chain logistics from Sohar Port, Sultanate of Oman — serving 30+ countries.\n\nWe source the very best from Iran’s flagship regions: Akbari pistachios from Rafsanjan, Piarom dates from Hormozgan, Sargol saffron from Qaenat, Rabab pomegranates from Neyriz, and year-round hydroponic greenhouse vegetables.\n\nEvery shipment is fully certified — Global G.A.P., HACCP, ISO 22000:2018, Halal, and Phytosanitary Certificate. Selected lines carry EU Organic certification.',
      body: 'توحید دیهمی بیزینس سولوشنز صادرکننده‌ی محصولات تازه و خشک‌بار ممتاز ایرانی مستقر در مسقط است. ما لجستیک زنجیره سرد را از بندر صحار عمان مدیریت می‌کنیم و به بیش از ۳۰ کشور خدمات می‌دهیم.\n\nبهترین‌ها را از مناطق شاخص ایران تأمین می‌کنیم: پسته اکبری رفسنجان، خرمای پیارم هرمزگان، زعفران سرگل قائنات، انار رباب نِی‌ریز و سبزیجات گلخانه‌ای تمام‌فصل.\n\nهر محموله دارای گواهی‌های Global G.A.P، HACCP، ISO 22000، حلال و بهداشت گیاهی است.',
      images: [`${CF}/hf_20260515_160741_f6b419f8-74d1-424a-bc12-4c1bd7b192ba.png`, `${CF}/hf_20260515_160750_2669ecb7-f9ab-472f-a053-aaca6be06b3d.png`],
    },
    {
      id: 'pg-certs', label: 'گواهینامه‌ها و استانداردها', labelEn: 'Certifications & Standards', type: 'cards',
      descriptionEn: 'Every shipment carries the full suite of international certifications — giving our clients market access worldwide.',
      description: 'هر محموله مجموعه کامل گواهینامه‌های بین‌المللی را دارد تا دسترسی مشتریان ما به بازارهای جهانی تضمین شود.',
      cards: [
        { id: 'cc1', name: 'Global G.A.P.', nameEn: 'Global G.A.P.', descEn: 'Good Agricultural Practices certification across all supplier farms.', desc: 'گواهی شیوه‌های خوب کشاورزی برای همه مزارع تأمین‌کننده.', image: `${CF}/hf_20260515_160847_556a5f3d-a753-4850-bbff-90f87e225963.png` },
        { id: 'cc2', name: 'HACCP', nameEn: 'HACCP Certified', descEn: 'Hazard Analysis & Critical Control Points food-safety system.', desc: 'سیستم ایمنی غذایی تحلیل خطر و نقاط کنترل بحرانی.', image: `${CF}/hf_20260515_160855_6a23e8d2-0071-4bda-9f42-fe63722b097c.png` },
        { id: 'cc3', name: 'ISO 22000:2018', nameEn: 'ISO 22000:2018', descEn: 'International food-safety management system certification.', desc: 'گواهی سیستم مدیریت ایمنی غذایی بین‌المللی.', image: `${CF}/hf_20260515_160903_e2be6f66-a062-4cfc-a88a-69e646721398.png` },
        { id: 'cc4', name: 'Phytosanitary', nameEn: 'Phytosanitary Certificate', descEn: 'Plant-health certificate issued for every export shipment.', desc: 'گواهی بهداشت گیاهی برای هر محموله صادراتی.', image: `${CF}/hf_20260515_160910_8ffc307d-99f9-4df7-bb6b-90615dfcdb7e.png` },
        { id: 'cc5', name: 'HALAL', nameEn: 'HALAL Certified', descEn: 'Compliance with Islamic dietary law across the product range.', desc: 'مطابقت با قوانین غذایی اسلامی در کل سبد محصولات.', image: `${CF}/hf_20260515_160917_c3c38086-67da-4de0-8238-2c0e06d73039.png` },
        { id: 'cc6', name: 'EU Organic', nameEn: 'EU Organic Certified', descEn: 'European Union Organic certification for select product lines.', desc: 'گواهی ارگانیک اتحادیه اروپا برای خطوط منتخب.', image: `${CF}/hf_20260515_160924_024f6c10-dafb-4f5c-853b-8d59c731fc80.png` },
      ],
    },
  ],
  products: [
    { id: 'sp1', name: 'Premium Akbari Pistachios — 1kg Vacuum Pack', sku: 'TDH-PIS-AKB-1KG', hsCode: '08025100', group: 'Iconic Iranian Specialties', description: 'Top-grade long Akbari pistachios from Rafsanjan, vacuum-packed for freshness.', i18n: { zh: { name: '高级阿克巴里开心果 — 1公斤真空装', description: '来自拉夫桑詹的顶级长形阿克巴里开心果，真空包装保鲜。' } }, images: [`${CF}/hf_20260515_160554_0e06b51a-499d-44c9-92ac-74d09dd74696.png`, `${CF}/hf_20260515_160741_f6b419f8-74d1-424a-bc12-4c1bd7b192ba.png`, `${CF}/hf_20260515_160750_2669ecb7-f9ab-472f-a053-aaca6be06b3d.png`], active: true, currency: 'USD', price: 13.5, packPrice: 13.5, unit: 'kg', pack: 1, moq: '8000', stockLabel: 'In stock', origin: { name: 'Iran' } },
    { id: 'sp2', name: 'Piarom Dates — 500g Royal Gift Box', sku: 'TDH-DAT-PRM-500', hsCode: '08041000', group: 'Iconic Iranian Specialties', description: 'Semi-dry Piarom (Maryami) dates from Hormozgan in an elegant gift box.', images: [`${CF}/hf_20260515_160602_e9e83a3c-473e-4b3e-a86d-7728c6665998.png`], active: true, currency: 'USD', price: 11, packPrice: 5.5, unit: 'kg', pack: 0.5, moq: '12000', stockLabel: 'In stock' },
    { id: 'sp3', name: 'Sargol Saffron — 5g Premium Vial', sku: 'TDH-SAF-SGL-5G', hsCode: '09102010', group: 'Iconic Iranian Specialties', description: 'All-red Sargol saffron from Qaenat, coloring strength 240+.', images: [`${CF}/hf_20260515_160610_f586a550-da82-413e-8d6f-1a79e64434fb.png`], active: true, currency: 'USD', price: 2200, packPrice: 11, unit: 'kg', pack: 0.005, moq: '50', stockLabel: 'In stock' },
    { id: 'sp4', name: 'Iranian Red Apples — 10kg Export Carton', sku: 'TDH-APP-RED-10', hsCode: '08081000', group: 'Premium Fresh Fruits', description: 'Crisp Damavand high-altitude red apples, export-graded and waxed.', images: [`${CF}/hf_20260515_160627_d2dc14af-3a49-473a-a8b4-221301f05428.png`], active: true, currency: 'USD', price: 0.95, packPrice: 9.5, unit: 'kg', pack: 10, moq: '100000', stockLabel: 'In stock', priceOptions: [{ id: 'o-fob', label: 'FOB', labelEn: 'FOB', price: 0.95 }, { id: 'o-cif', label: 'CIF', labelEn: 'CIF', price: 1.15 }, { id: 'o-ddp', label: 'DDP', labelEn: 'DDP', price: 1.45 }] },
    { id: 'sp5', name: 'Rabab Pomegranates — 8kg Export Carton', sku: 'TDH-POM-RAB-8', hsCode: '08109010', group: 'Premium Fresh Fruits', description: 'Sweet-tart Rabab pomegranates from Neyriz, deep ruby arils.', images: [`${CF}/hf_20260515_160635_1a90f764-ce39-4a58-b31e-ea3ee4c63363.png`], active: true, currency: 'USD', price: 1.4, packPrice: 11.2, unit: 'kg', pack: 8, moq: '60000', stockLabel: 'In stock' },
    { id: 'sp6', name: 'Greenhouse Vine Tomatoes — 5kg Export Carton', sku: 'TDH-TOM-VIN-5', hsCode: '07020000', group: 'Greenhouse Vegetables', description: 'Year-round hydroponic vine tomatoes from Yazd greenhouses.', images: [`${CF}/hf_20260515_160659_b1702d1b-ce9e-489b-9fee-e288bdbea9a4.png`], active: true, currency: 'USD', price: 0.85, packPrice: 4.25, unit: 'kg', pack: 5, moq: '150000', stockLabel: 'In stock' },
    { id: 'sp7', name: 'Yellow Onions — 25kg Export Mesh Sack', sku: 'TDH-ONI-YEL-25', hsCode: '07031019', group: 'Strategic Storage Crops', description: 'Long-shelf-life yellow onions in breathable mesh sacks.', images: [`${CF}/hf_20260515_160724_1b9081bc-deac-4357-b172-714513cfe8ee.png`], active: true, currency: 'USD', price: 0.35, packPrice: 8.75, unit: 'kg', pack: 25, moq: '500000', stockLabel: 'In stock' },
  ],
};

export const SERVICES_SAMPLE: MetaShop = {
  id: 'sample-services',
  slug: 'tohid-services',
  name: 'Tohid Dayhami Services',
  type: 'services',
  isActive: true,
  currency: 'OMR',
  theme: {
    primary: '#0f766e',
    cover: '#0f172a',
    coverText: '#f8fafc',
    bg: '#ffffff',
    heading: '#0f172a',
    text: '#334155',
  },
  collectionText: 'Professional Services',
  title: 'Tohid Dayhami — Business & Mobility Services',
  subtitle: 'Consulting, market entry, design and car rental — book online and we will get back to you.',
  coverImage: `${CF}/hf_20260515_160741_f6b419f8-74d1-424a-bc12-4c1bd7b192ba.png`,
  logo: '',
  phone: '+968 98 1030 64',
  email: 'info@tohiddayhami.com',
  website: 'www.tohiddayhami.com',
  address: 'Muscat, Sultanate of Oman',
  footerText: 'Tohid Dayhami Business Solutions — Services Division',
  cartButtonText: 'Request Service',
  orderThankYouText: 'Thank you! Your service request has been received. Our team will contact you shortly. Keep your tracking code below.',
  searchPlaceholder: 'Search services...',
  defaultLang: 'fa',
  languages: [{ code: 'fa', name: 'فارسی', rtl: true }, { code: 'en', name: 'English' }, { code: 'zh', name: '中文' }],
  i18n: { zh: { title: 'Tohid Dayhami — 商务与出行服务', subtitle: '咨询、市场进入、设计与租车 — 在线预订，我们会尽快与您联系。', collectionText: '专业服务' } },
  productsTabLabel: 'خدمات',
  productsTabLabelEn: 'Services',
  assignType: undefined,
  assignedPersonnelIds: [],
  extraFees: [
    { id: 'fee-delivery', label: 'هزینه تحویل در محل', labelEn: 'On-site delivery', amount: 3, required: false, defaultOn: false },
  ],
  discounts: [
    { id: 'disc-rent', code: 'RENT10', type: 'percent', value: 10, scope: 'categories', categories: ['Car Rental'], active: true, label: '10% off car rentals' },
  ],
  taxRate: 5,
  taxInclusive: true,
  taxLabel: 'مالیات بر ارزش افزوده',
  taxLabelEn: 'VAT',
  pages: [
    {
      id: 'pg-about', label: 'درباره ما', labelEn: 'About Us', type: 'text',
      body: 'مجموعه خدمات توحید دیهمی شامل مشاوره صادرات و ورود به بازار، طراحی برند و بسته‌بندی، و اجاره خودرو در مسقط است. تیم ما با تجربه‌ی بین‌المللی در کنار شماست.',
      bodyEn: 'Tohid Dayhami Services covers export & market-entry consulting, brand & packaging design, and car rental in Muscat. Our internationally experienced team is here for you.',
      images: [`${CF}/hf_20260515_160750_2669ecb7-f9ab-472f-a053-aaca6be06b3d.png`],
    },
  ],
  products: [
    { id: 'ss1', name: 'Export Market-Entry Consulting', sku: 'SVC-CONSULT-EXP', group: 'Consulting', description: 'One-on-one strategic consulting session for entering GCC & global markets: pricing, logistics, certifications.', images: [`${CF}/hf_20260515_160822_b37cc5a5-15ca-4401-91d4-eb896a48fc09.png`], active: true, currency: 'OMR', price: 45, unit: 'session', priceUnit: 'per session', features: [{ label: 'Duration', value: '90 minutes' }, { label: 'Format', value: 'Online / In-person' }] },
    { id: 'ss2', name: 'Brand & Packaging Design', sku: 'SVC-DESIGN-PKG', group: 'Design', description: 'Print-ready Adobe Illustrator packaging design + professional mockups. Includes 3 revisions.', images: [`${CF}/hf_20260515_160807_15f8d67c-56ed-4a12-9962-063b8be3924a.png`], active: true, currency: 'OMR', price: 120, unit: 'project', priceUnit: 'per project', features: [{ label: 'Deliverables', value: 'AI files + mockups' }, { label: 'Timeline', value: '~20 days' }, { label: 'Revisions', value: '3 included' }] },
    { id: 'ss3', name: 'Economy Car Rental', sku: 'SVC-CAR-ECO', group: 'Car Rental', description: 'Compact economy car rental in Muscat. Insurance and 200km/day included.', i18n: { zh: { name: '经济型租车', description: '马斯喀特紧凑型经济租车，含保险及每日200公里。' } }, images: [`${CF}/hf_20260515_160830_d8bb0e62-ed41-4e9e-bf1e-3b086cacd6bf.png`], active: true, currency: 'OMR', price: 12, unit: 'rental', priceOptions: [{ id: 'd1', label: '۱ روز', labelEn: '1 day', price: 12 }, { id: 'd3', label: '۳ روز', labelEn: '3 days', price: 33 }, { id: 'd10', label: '۱۰ روز', labelEn: '10 days', price: 100 }], features: [{ label: 'Mileage', value: '200 km/day' }, { label: 'Insurance', value: 'Included' }, { label: 'Transmission', value: 'Automatic' }] },
    { id: 'ss4', name: 'SUV Rental', sku: 'SVC-CAR-SUV', group: 'Car Rental', description: 'Full-size SUV rental, ideal for desert and family trips. Insurance and 250km/day included.', images: [`${CF}/hf_20260515_160838_8fda62d3-3580-4ab2-a3e6-354d406285bf.png`], active: true, currency: 'OMR', price: 28, unit: 'rental', priceOptions: [{ id: 'd1', label: '۱ روز', labelEn: '1 day', price: 28 }, { id: 'd3', label: '۳ روز', labelEn: '3 days', price: 78 }, { id: 'd10', label: '۱۰ روز', labelEn: '10 days', price: 240 }], features: [{ label: 'Mileage', value: '250 km/day' }, { label: 'Seats', value: '7' }, { label: 'Insurance', value: 'Included' }] },
    // Hotel room — demonstrates option groups (occupancy / children / extras) on top of nightly rate options
    { id: 'ss5', name: 'Deluxe Hotel Room — Muscat', sku: 'SVC-HOTEL-DLX', group: 'Hotel', description: 'Deluxe room near Muscat city centre. Choose occupancy, add children, and pick extras.', images: [`${CF}/hf_20260515_160741_f6b419f8-74d1-424a-bc12-4c1bd7b192ba.png`], active: true, currency: 'OMR', unit: 'night', priceOptions: [{ id: 'n1', label: '۱ شب', labelEn: '1 night', price: 35 }, { id: 'n3', label: '۳ شب', labelEn: '3 nights', price: 95 }, { id: 'n7', label: '۷ شب', labelEn: '7 nights', price: 200 }], optionGroups: [
      { id: 'occ', label: 'ظرفیت اتاق', labelEn: 'Occupancy', type: 'select', required: true, options: [{ id: 'single', label: 'یک نفره', labelEn: 'Single', priceDelta: 0 }, { id: 'double', label: 'دو نفره', labelEn: 'Double', priceDelta: 8 }, { id: 'triple', label: 'سه نفره', labelEn: 'Triple', priceDelta: 15 }] },
      { id: 'children', label: 'تعداد کودک', labelEn: 'Children', type: 'counter', min: 0, max: 4, unitPrice: 5 },
      { id: 'extras', label: 'خدمات اضافی', labelEn: 'Extras', type: 'checkbox', options: [{ id: 'breakfast', label: 'صبحانه', labelEn: 'Breakfast', priceDelta: 4 }, { id: 'airport', label: 'ترانسفر فرودگاه', labelEn: 'Airport transfer', priceDelta: 10 }, { id: 'late', label: 'تحویل دیرهنگام اتاق', labelEn: 'Late checkout', priceDelta: 6 }] },
    ], features: [{ label: 'View', value: 'City / Sea' }, { label: 'Wi-Fi', value: 'Free' }] },
  ],
};

export const downloadSample = (kind: 'products' | 'services') => {
  const data = kind === 'products' ? PRODUCTS_SAMPLE : SERVICES_SAMPLE;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metashop-sample-${kind}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
