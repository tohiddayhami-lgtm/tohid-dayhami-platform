
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CustomerForm } from './components/CustomerForm';
import { AdminDashboard } from './components/AdminDashboard';
import { TrackingView } from './components/TrackingView';
import { LoginView } from './components/LoginView';
import { CustomerDashboard } from './components/CustomerDashboard';
import { FeaturedBusinesses } from './components/FeaturedBusinesses';
import { NewsPage } from './components/NewsPage';
import { PublicFormView } from './components/PublicFormView';
import { Ticket, TicketStatus, ViewState, ServiceOption, Personnel, Customer, AppConfig, FormField, TimelineEntry, AttachedFile, InternalMessage, Task, Meeting, KPI, NewsArticle, CustomerAccount, CompanyProcess, Invoice, MetaShop, MetaShopOrder, MetaBazaar, CustomForm } from './types';
import { IconPlus, IconSearch, IconShield, IconBulb, IconNewspaper, IconLock, IconPort, IconLayout, IconMagic, IconTrendingUp, IconTarget, IconDatabase, IconFileText, IconMessageSquare, IconGlobe, IconMegaphone, IconAward, IconCloud, IconFolder, IconBriefcase } from './components/Icons';
import {
  saveTicketToCloud, updateTicketInCloud, deleteTicketFromCloud,
  saveCustomerToCloud, saveCustomersBulkToCloud, updateCustomerInCloud, deleteCustomerFromCloud,
  saveAppConfigToCloud,
  saveServicesToCloud,
  savePersonnelToCloud,
  subscribeToTickets, subscribeToCustomers, subscribeToSettings, subscribeToCustomForms,
  subscribeToMessages, sendInternalMessage, subscribeToTasks, subscribeToMeetings, subscribeToKPIs, sanitizeData, logSystemAction,
  subscribeToNews, logPageView, subscribeToAnalytics, saveNotificationLog,
  subscribeToCustomerAccounts, saveCustomerAccount, deleteCustomerAccount,
  subscribeToProcesses, saveProcess, deleteProcess,
  subscribeToInvoices, saveInvoiceToCloud, deleteInvoiceFromCloud,
  subscribeToMetaShops, saveMetaShopToCloud, deleteMetaShopFromCloud, getMetaShopBySlug,
  subscribeToMetaShopOrders, saveMetaShopOrderToCloud, updateMetaShopOrderInCloud, lookupMetaShopOrders, lookupMetaShopOrdersByTracking,
  subscribeToMetaBazaars, saveMetaBazaarToCloud, deleteMetaBazaarFromCloud, getMetaBazaarBySlug,
  getTicketById,
} from './services/firebaseService';
import { MetaShopView } from './components/MetaShopView';
import { MetaShopCatalog } from './components/MetaShopCatalog';
import { MetaShopDirectory } from './components/MetaShopDirectory';
// Heavy 3D / WebXR viewer — lazy-loaded so three.js + R3F only ship to the public ?expo= route.
const MetaverseExpoView = React.lazy(() => import('./components/metaverse/MetaverseExpoView').then(m => ({ default: m.MetaverseExpoView })));
// Tiny CSS-only "mall doors opening" loader (no 3D deps) — shown while the heavy chunk downloads.
import { ExpoDoorsLoader } from './components/metaverse/ExpoDoorsLoader';
import { BazaarPassageLoader } from './components/BazaarPassageLoader';
import { GlobalSearch } from './components/GlobalSearch';
import { ShopShutterLoader } from './components/ShopShutterLoader';
import { sendWhatsAppNotification, sendMasterCopy, renderTemplate, buildLog, DEFAULT_MEETING_REMINDER_TEMPLATE, DEFAULT_DAILY_SUMMARY_TEMPLATE } from './services/notificationService';

export type Language = 'fa' | 'en';

export const DICTIONARY = {
  fa: {
    startBtn: 'شروع مشاوره و خدمات',
    trackBtn: 'پیگیری درخواست',
    newTicket: 'ثبت درخواست',
    tracking: 'پیگیری',
    expertPanel: 'پنل کارشناسان',
    footer: '© ۱۴۰۳ پلتفرم جامع خدمات صادراتی',
    features: [
      { title: 'ارسال آنلاین مدارک', desc: 'بارگذاری کاتالوگ، عکس و ویدیو جهت بررسی کارشناسان' },
      { title: 'تحلیل هوشمند بازار', desc: 'استفاده از هوش مصنوعی برای ارزیابی پتانسیل محصول' },
      { title: 'پیگیری مرحله به مرحله', desc: 'اطلاع از وضعیت دقیق درخواست در پنل کاربری' },
    ],
    alertSuccess: 'درخواست شما با موفقیت ثبت شد.\nشماره پیگیری: ',
    landingSubtitle: 'اولین و بزرگترین پلتفرم هوشمند خدمات صادراتی و بازرگانی کشور.'
  },
  en: {
    startBtn: 'Get Started',
    trackBtn: 'Track Request',
    newTicket: 'New Request',
    tracking: 'Track',
    expertPanel: 'Staff Login',
    footer: '© 2024 Comprehensive Export Platform. All rights reserved.',
    features: [
      { title: 'Online Submission', desc: 'Upload documents for expert review' },
      { title: 'AI Market Analysis', desc: 'Smart evaluation of product potential' },
      { title: 'Live Tracking', desc: 'Track your request status in real-time' },
    ],
    alertSuccess: 'Your request has been submitted successfully.\nTracking ID: ',
    landingSubtitle: 'The leading smart export and trade services platform.'
  }
};

const DEFAULT_SERVICES: ServiceOption[] = [
  { id: 's3', title: 'خدمات طراحی بسته بندی', titleEn: 'Packaging Design', description: 'طراحی استاندارد برای بازارهای جهانی', descriptionEn: 'Standard design for global markets', isActive: true, price: { amount: 30000000, currency: 'IRR' } },
  { id: 's4', title: 'خدمات طراحی گرافیک', titleEn: 'Graphic Design', description: 'تولید محتوای بصری بین‌المللی', descriptionEn: 'International visual content production', isActive: true, price: { amount: 15000000, currency: 'IRR' }, subServices: [
      { id: 'sub1', title: 'طراحی لوگو', titleEn: 'Logo Design', price: { amount: 5000000, currency: 'IRR' } },
      { id: 'sub2', title: 'کارت ویزیت', titleEn: 'Business Card', price: { amount: 2000000, currency: 'IRR' } },
      { id: 'sub3', title: 'کاتالوگ دیجیتال', titleEn: 'Digital Catalog', price: { amount: 10000000, currency: 'IRR' } },
      { id: 'sub4', title: 'هویت بصری (برندینگ)', titleEn: 'Visual Identity', price: { amount: 25000000, currency: 'IRR' } }
  ]},
  { id: 's8', title: 'خدمات خرید محصول صادراتی', titleEn: 'Export Product Procurement', description: 'تامین و خرید محصولات برای صادرات', descriptionEn: 'Sourcing and procurement of export products', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's9', title: 'خدمات فروش محصول صادراتی', titleEn: 'Export Product Sales', description: 'بازاریابی و فروش در بازارهای خارجی', descriptionEn: 'Marketing and sales in foreign markets', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's10', title: 'خرید نرم افزار تخصصی صادراتی توحید پلاس', titleEn: 'Tohid Plus Export Software', description: 'نرم افزار تخصصی مدیریت فرآیند صادرات', descriptionEn: 'Specialized export management software', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's1', title: 'خدمات مشاوره تخصصی', titleEn: 'Expert Consultation', description: 'مشاوره ورود به بازار و قوانین گمرکی', descriptionEn: 'Market entry strategy and customs regulations', isActive: true, price: { amount: 5000000, currency: 'IRR' } },
  { id: 's7', title: 'خدمات غرفه مجازی متاپورت', titleEn: 'Metaport Virtual Booth', description: 'نمایش محصولات در نمایشگاه‌های آنلاین', descriptionEn: 'Product display in online exhibitions', isActive: true, price: { amount: 10000000, currency: 'IRR' } },
  { id: 's11', title: 'خدمات ثبت شرکت در عمان', titleEn: 'Company Registration in Oman', description: 'ثبت و راه‌اندازی شرکت در کشور عمان', descriptionEn: 'Company registration and setup in Oman', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's12', title: 'انتقادات و پیشنهادات', titleEn: 'Feedback & Suggestions', description: 'ارسال پیشنهادات و انتقادات به تیم ما', descriptionEn: 'Send your feedback and suggestions to our team', isActive: true, price: { amount: 0, currency: 'IRR' } },
  { id: 's_other', title: 'سایر', titleEn: 'Other', description: 'سایر خدمات مورد نیاز', descriptionEn: 'Other required services', isActive: true, price: { amount: 0, currency: 'IRR' } },
];

const DEFAULT_PERSONNEL: Personnel[] = [
  { id: 'p_master', fullName: 'Master Admin', roles: ['مدیر'], jobDescription: 'مدیر کل سیستم با دسترسی نامحدود به تمامی بخش‌ها.', email: 'master@export.com', username: 'master', password: '', status: 'active', permissions: { canAssign: true, canViewCustomers: true, canViewTariffs: true, canViewAllTickets: true, canIssueInvoices: true } },
  { id: 'p1', fullName: 'مدیر ارشد سیستم', roles: ['مدیر'], jobDescription: 'نظارت بر عملکرد تیم فروش و پیگیری قراردادهای کلان.', reportsTo: 'p_master', email: 'admin@export.com', username: 'admin', password: '', status: 'active', permissions: { canAssign: true, canViewCustomers: true, canViewTariffs: true, canViewAllTickets: true, canIssueInvoices: true } },
  { id: 'p2', fullName: 'کارشناس فروش', roles: ['کارشناس صادرات'], jobDescription: 'پیگیری لیدهای ورودی و تبدیل به مشتری نهایی.', reportsTo: 'p1', email: 'sales@export.com', username: 'sales', password: '', status: 'active', permissions: { canAssign: false, canViewCustomers: false, canViewTariffs: true, canViewAllTickets: false, canIssueInvoices: true } },
];

const INITIAL_CONFIG: AppConfig = {
  appTitle: 'پلتفرم جامع صادراتی',
  appTitleEn: 'Export Platform',
  appSubtitle: 'مشاوره، توسعه بازار و خدمات بازرگانی',
  appSubtitleEn: 'Consultancy, Market Development & Trade Services',
  landingHeroTitle: 'مسیر جهانی شدن کسب‌وکار شما',
  landingHeroSubtitle: 'اولین و بزرگترین پلتفرم هوشمند خدمات صادراتی و بازرگانی کشور. با ما مسیر ورود به بازارهای جهانی را هموار کنید.',
  footerText: '© ۱۴۰۳ پلتفرم جامع خدمات صادراتی. تمامی حقوق محفوظ است.',
  dailyTips: [
    "موفقیت در صادرات نیازمند شناخت دقیق بازار هدف است.",
    "بسته‌بندی مناسب، نماینده خاموش محصول شما در قفسه‌های فروشگاه‌های جهانی است.",
    "اخذ گواهی‌نامه‌های بین‌المللی، کلید ورود به بازارهای اروپایی است."
  ],
  showDailyTips: true,
  personnelRoles: ['مدیر', 'کارشناس صادرات', 'طراح گرافیک/بسته بندی', 'پشتیبانی', 'کارشناس آموزش', 'مدیر مالی'],
  formFields: [
    { id: 'h1', key: 'h_contact', label: 'اطلاعات تماس و موقعیت', labelEn: 'Contact Information', type: 'header', required: false, order: 0, isSystem: true },
    { id: 'f1', key: 'fullName', label: 'نام و نام خانوادگی (شخص مسئول)', labelEn: 'Full Name (Contact Person)', type: 'text', required: true, placeholder: 'مثال: علی محمدی', placeholderEn: 'e.g. John Smith', order: 1, isSystem: true },
    { id: 'f2', key: 'companyName', label: 'نام شرکت / برند (اختیاری)', labelEn: 'Company / Brand (Optional)', type: 'text', required: false, placeholder: 'مثال: بازرگانی پارس', placeholderEn: 'e.g. Pars Trading Co.', order: 2, isSystem: true },
    { id: 'f3', key: 'location', label: 'کشور و شهر', labelEn: 'Country & City', type: 'text', required: true, placeholder: 'مثال: ایران، تهران', placeholderEn: 'e.g. Iran, Tehran', order: 3, isSystem: true },
    { id: 'f4', key: 'phoneNumber', label: 'شماره موبایل', labelEn: 'Mobile Number', type: 'tel', required: true, placeholder: '0912...', placeholderEn: '+1 555 000 0000', order: 4, isSystem: true },
    { id: 'f5', key: 'whatsappNumber', label: 'شماره واتس‌اپ', labelEn: 'WhatsApp Number', type: 'tel', required: true, placeholder: 'مثال: 09120000000', placeholderEn: '+1 555 000 0000', order: 5, isSystem: true },
    { id: 'f6', key: 'email', label: 'ایمیل (اختیاری)', labelEn: 'Email (Optional)', type: 'email', required: false, placeholder: 'email@example.com', placeholderEn: 'email@example.com', order: 6, isSystem: true },
    { id: 'h2', key: 'h_req', label: 'جزئیات درخواست', labelEn: 'Request Details', type: 'header', required: false, order: 7, isSystem: true },
    { id: 'f7', key: 'businessType', label: 'نوع کسب‌وکار', labelEn: 'Business Type', type: 'select', required: true, options: ['تولیدی', 'بازرگانی', 'صنایع دستی', 'کشاورزی', 'خدماتی', 'دانش‌بنیان', 'سایر'], optionsEn: ['Manufacturing', 'Trading', 'Handicrafts', 'Agriculture', 'Services', 'Knowledge-Based', 'Other'], order: 8, isSystem: true },
    { id: 'f8', key: 'description', label: 'اطلاعات محصول', labelEn: 'Product Information', type: 'textarea', required: false, placeholder: 'نوع محصول یا خدمتی که ارائه می‌دهید را توضیح دهید...', placeholderEn: 'Describe the type of product or service you offer...', order: 9, isSystem: true },
  ],
  assignmentConfig: { mode: 'manual', targetType: 'role', serviceRoleMap: {}, servicePersonnelMap: {} },
  invoiceTemplate: {
    companyName: 'Tohid Dayhami Business Solutions',
    address: 'Unit A09, New Work, First Floor, Avenues Mall, Muscat, Sultanate of Oman',
    crNumber: '1617064',
    phone: '+968 98 1030 64',
    email: 'info@tohiddayhami.com',
    website: 'www.tohiddayhami.com',
    bankName: 'Bank Muscat',
    accountHolder: 'Tohid Abbas Dayhami',
    accountNumber: '0325064426130011',
    swiftCode: 'BMUSOMRXXXX',
    iban: 'OM0402703250644426130011',
    defaultPaymentTerms: 'Advance Payment: 80% to start the project / 20% upon completion.',
    defaultNotes: 'Project Details & Timeline\n• Deliverables: High-quality design files (Print-ready Adobe Illustrator files) and professional mockups for presentation.\n• Estimated Timeline: Approximately 20 days.\n• Included: 3 revisions and Minor changes in the future\n\nThank you for choosing our services. We look forward to delivering a world-class design for your brand.',
    footerText: 'Thank you for choosing our services.',
    termsConditions: 'Advance Payment: 80% to start the project / 20% upon completion.',
    defaultTaxRate: 5,
    vatInclusive: true,
    invoicePrefix: 'SVC',
    colorTheme: '#0f766e',
  }
};

const STORAGE_KEYS = { USER: 'crm_session_user', VIEW: 'crm_last_view', LAST_ACTIVE: 'crm_last_active' };
const CACHE_KEYS = { SERVICES: 'crm_cache_services', CONFIG: 'crm_cache_config' };
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

const readCache = <T,>(key: string): T | null => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : null; } catch { return null; }
};
const writeCache = (key: string, data: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

// Extracts form ID from ?form=... (social media safe) or #/f/... (internal nav)
const extractFormId = (): string | null => {
  try {
    const qp = new URLSearchParams(window.location.search).get('form');
    if (qp) return qp;
  } catch {}
  const h = window.location.hash;
  if (h.startsWith('#/f/')) return h.replace('#/f/', '').split('?')[0] || null;
  return null;
};

// Extracts a Meta Shop slug from ?shop=... (or ?c=... — short share links) or #/shop/...
const extractShopSlug = (): string | null => {
  try {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('shop') || p.get('c');
    if (s) return s;
  } catch {}
  const h = window.location.hash;
  if (h.startsWith('#/shop/')) return h.replace('#/shop/', '').split('?')[0] || null;
  return null;
};

// True when the shop is opened inside an iframe embed (Google Sites / external website) via ?embed=1.
// Used to render a compact catalog and to tag orders so staff see they came from the embedded site.
const extractEmbedFlag = (): boolean => {
  try {
    const v = new URLSearchParams(window.location.search).get('embed');
    if (v && v !== '0' && v !== 'false') return true;
  } catch {}
  return false;
};

// True when the shop link should render the printable A4 PDF catalog (?catalog=1 or ?pdf=1).
// Reuses the same ?shop=<slug> resolution; only the rendered component differs.
const extractCatalogFlag = (): boolean => {
  try {
    const p = new URLSearchParams(window.location.search);
    const v = p.get('catalog') ?? p.get('pdf');
    if (v != null && v !== '0' && v !== 'false') return true;
  } catch {}
  return false;
};

// Extracts a Meta Bazaar slug from ?bazaar=... or #/bazaar/...
const extractBazaarSlug = (): string | null => {
  try {
    const s = new URLSearchParams(window.location.search).get('bazaar');
    if (s) return s;
  } catch {}
  const h = window.location.hash;
  if (h.startsWith('#/bazaar/')) return h.replace('#/bazaar/', '').split('?')[0] || null;
  return null;
};

// Extracts a Metaverse Expo slug from ?expo=... or #/expo/... (the slug is the parent bazaar's slug)
const extractExpoSlug = (): string | null => {
  try {
    const s = new URLSearchParams(window.location.search).get('expo');
    if (s) return s;
  } catch {}
  const h = window.location.hash;
  if (h.startsWith('#/expo/')) return h.replace('#/expo/', '').split('?')[0] || null;
  return null;
};

// Extracts a pre-selected service ID from ?service=... — used by per-service share links (?page=form&service=<id>)
const extractServiceId = (): string | null => {
  try {
    const qp = new URLSearchParams(window.location.search).get('service');
    if (qp) return qp;
  } catch {}
  return null;
};

// Parses current URL into a ViewState, checking query params first (social-media-safe),
// then hash fragments (internal navigation). Query params survive Instagram/WhatsApp/Telegram.
const parseUrl = (search: string, hash: string): ViewState | null => {
  try {
    const p = new URLSearchParams(search);
    const page = p.get('page');
    if (page === 'form')     return 'new-ticket';
    if (page === 'tracking') return 'tracking';
    if (page === 'news')     return 'news';
    if (p.get('form'))       return 'custom-form';
    if (p.get('expo')) return 'expo';
    if (p.get('bazaar')) return 'bazaar';
    if (p.has('shops')) return 'shopsdir';
    if (p.get('shop') || p.get('c')) return 'metashop';
  } catch {}
  if (!hash || hash === '#' || hash === '#/') return 'landing';
  if (hash.startsWith('#/expo/'))             return 'expo';
  if (hash.startsWith('#/bazaar/'))           return 'bazaar';
  if (hash === '#/shops')                     return 'shopsdir';
  if (hash.startsWith('#/shop/'))             return 'metashop';
  if (hash === '#/form' || hash === '#form')  return 'new-ticket';
  if (hash === '#/tracking')                  return 'tracking';
  if (hash.startsWith('#/news'))              return 'news';
  if (hash.startsWith('#/f/'))                return 'custom-form';
  if (hash === '#/admin')                     return 'admin';
  return null;
};

const getInitialView = (): ViewState => {
  const v = parseUrl(window.location.search, window.location.hash);
  if (v && v !== 'admin') return v;
  if (v === 'admin') {
    try { if (localStorage.getItem('crm_session_user')) return 'admin'; } catch {}
  }
  return 'landing';
};

const App: React.FC = () => {
  const [view, setViewState] = useState<ViewState>(getInitialView);
  const [contactTick, setContactTick] = useState(0); // bumped to open the "Contact Us" tab inside TrackingView
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string | null>(extractServiceId);
  const [expandedServiceId,    setExpandedServiceId]    = useState<string | null>(null);
  // Reads from ?form= (social media links) OR #/f/ (internal nav), synchronously on first render
  const [customFormId, setCustomFormId] = useState<string | null>(extractFormId);
  const [lang, setLang] = useState<Language>('fa');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customForms, setCustomForms] = useState<CustomForm[]>([]);
  const [services, setServices] = useState<ServiceOption[]>(() => readCache<ServiceOption[]>(CACHE_KEYS.SERVICES) ?? []);
  const [isServicesLoaded, setIsServicesLoaded] = useState<boolean>(() => !!readCache(CACHE_KEYS.SERVICES));
  const [personnel, setPersonnel] = useState<Personnel[]>(DEFAULT_PERSONNEL);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metaShops, setMetaShops] = useState<MetaShop[]>([]);
  const [metaShopOrders, setMetaShopOrders] = useState<MetaShopOrder[]>([]);
  const [shopSlug, setShopSlug] = useState<string | null>(extractShopSlug);
  const [isEmbed] = useState<boolean>(extractEmbedFlag); // shop loaded inside an iframe (Google Sites / external site)
  const [catalogMode, setCatalogMode] = useState<boolean>(extractCatalogFlag); // shop link opened as a printable A4 PDF catalog (?catalog=1)
  const [publicShop, setPublicShop] = useState<MetaShop | null>(null);
  const [shopLoading, setShopLoading] = useState(false);
  const [metaBazaars, setMetaBazaars] = useState<MetaBazaar[]>([]);
  const [bazaarSlug, setBazaarSlug] = useState<string | null>(extractBazaarSlug);
  const [publicBazaar, setPublicBazaar] = useState<MetaBazaar | null>(null);
  const [bazaarLoading, setBazaarLoading] = useState(false);
  // Metaverse expo (3D exhibition) — resolves the parent bazaar by slug, then reads bazaar.expo
  const [expoSlug, setExpoSlug] = useState<string | null>(extractExpoSlug);
  const [publicExpoBazaar, setPublicExpoBazaar] = useState<MetaBazaar | null>(null);
  const [expoLoading, setExpoLoading] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [analyticsEvents, setAnalyticsEvents] = useState<import('./types').AnalyticsEvent[]>([]);
  const [currentUser, setCurrentUser] = useState<Personnel | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig>(() => readCache<AppConfig>(CACHE_KEYS.CONFIG) ?? INITIAL_CONFIG);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [customerAccounts, setCustomerAccounts] = useState<CustomerAccount[]>([]);
  const [processes, setProcesses] = useState<CompanyProcess[]>([]);
  const [currentCustomerUser, setCurrentCustomerUser] = useState<CustomerAccount | null>(null);

  const t = DICTIONARY[lang];

  // All public views use query params — survive Instagram/WhatsApp/Telegram link sharing.
  const VIEW_URL: Record<ViewState, string> = {
    landing: '/', 'new-ticket': '?page=form', tracking: '?page=tracking',
    news: '?page=news', admin: '#/admin', 'custom-form': '?form=', metashop: '?shop=', shopsdir: '?shops=1', bazaar: '?bazaar=', expo: '?expo=',
  };

  // Public "ثبت درخواست" entry point. If an external URL is configured (e.g. a Google
  // Form), open it in a new tab; otherwise open the in-app request form.
  const goToRequest = () => {
    const url = appConfig.requestExternalUrl?.trim();
    if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    setView('new-ticket');
  };

  const openFormWithService = (serviceId: string) => {
    const url = appConfig.requestExternalUrl?.trim();
    if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    setPreSelectedServiceId(serviceId);
    setView('new-ticket');
  };

  const setView = (newView: ViewState, extra?: string) => {
    setViewState(newView);
    localStorage.setItem(STORAGE_KEYS.VIEW, newView);
    let newUrl = VIEW_URL[newView];
    if (newView === 'custom-form' && extra) newUrl = `?form=${extra}`;
    if (newView === 'news' && extra)        newUrl = `?page=news&id=${extra}`;
    if (newView === 'landing')              newUrl = window.location.pathname;
    const currentFull = window.location.search + window.location.hash;
    if (currentFull !== newUrl && (window.location.pathname + currentFull) !== newUrl) {
      history.pushState(null, '', newUrl);
    }
    logPageView(newView, extra);
  };

  const toAbsoluteUrl = (url: string) => {
    if (!url) return '#';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    const title = appConfig.seoTitle || appConfig.appTitle;
    document.title = title;
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.name = name; document.head.appendChild(el); }
      el.content = content;
    };
    const setOg = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
      el.content = content;
    };
    if (appConfig.seoDescription) setMeta('description', appConfig.seoDescription);
    if (appConfig.seoKeywords) setMeta('keywords', appConfig.seoKeywords);
    if (appConfig.ogTitle) setOg('og:title', appConfig.ogTitle);
    if (appConfig.ogDescription) setOg('og:description', appConfig.ogDescription);
    if (appConfig.ogImage) setOg('og:image', appConfig.ogImage);
    if (appConfig.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = appConfig.favicon;
    }
  }, [appConfig]);

  useEffect(() => {
    // Determine view from current URL (query params take priority over hash)
    const initialView = getInitialView();

    // Extract form ID synchronously
    const fid = extractFormId();
    if (fid) setCustomFormId(fid);

    const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
    const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
    const now = Date.now();

    const isPublicView = initialView === 'new-ticket' || initialView === 'tracking' || initialView === 'custom-form' || initialView === 'metashop' || initialView === 'shopsdir' || initialView === 'bazaar' || initialView === 'expo';

    if (storedUser && lastActive && !isPublicView) {
      if (now - parseInt(lastActive) > INACTIVITY_TIMEOUT) {
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem(STORAGE_KEYS.VIEW);
        localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
        setCurrentUser(null);
      } else {
        try {
          setCurrentUser(JSON.parse(storedUser));
          localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
        } catch { localStorage.removeItem(STORAGE_KEYS.USER); setCurrentUser(null); }
      }
    } else if (storedUser && !isPublicView) {
      try { setCurrentUser(JSON.parse(storedUser)); } catch { localStorage.removeItem(STORAGE_KEYS.USER); }
    }

    setViewState(initialView);
    // Only reset to root for true landing (don't overwrite public ?page= URLs)
    if (initialView === 'landing' && !window.location.search && !window.location.hash.startsWith('#/')) {
      history.replaceState(null, '', '/');
    }
    logPageView(initialView);
  }, []);

  useEffect(() => {
    const handleNav = () => {
      const v = parseUrl(window.location.search, window.location.hash);
      if (!v) return;
      if (v === 'admin' && !currentUser) { setViewState('landing'); return; }
      const fid = extractFormId();
      if (v === 'custom-form' && fid) setCustomFormId(fid);
      if (v === 'metashop') { setShopSlug(extractShopSlug()); setCatalogMode(extractCatalogFlag()); }
      if (v === 'bazaar') setBazaarSlug(extractBazaarSlug());
      if (v === 'expo') setExpoSlug(extractExpoSlug());
      if (v === 'new-ticket') setPreSelectedServiceId(extractServiceId());
      setViewState(v);
      localStorage.setItem(STORAGE_KEYS.VIEW, v);
    };
    window.addEventListener('popstate', handleNav);
    window.addEventListener('hashchange', handleNav);
    return () => {
      window.removeEventListener('popstate', handleNav);
      window.removeEventListener('hashchange', handleNav);
    };
  }, [currentUser]);

  useEffect(() => {
    const updateActivity = () => { if (currentUser) localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString()); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, updateActivity));
    const interval = setInterval(() => {
      const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
      if (currentUser && lastActive && Date.now() - parseInt(lastActive) > INACTIVITY_TIMEOUT) {
        handleLogout();
        alert('نشست کاربری شما به دلیل عدم فعالیت منقضی شد.');
      }
    }, 60000);
    return () => { events.forEach(e => window.removeEventListener(e, updateActivity)); clearInterval(interval); };
  }, [currentUser]);

  useEffect(() => {
    const unsubTickets = subscribeToTickets((data) => { setTickets(data); setIsLoadingData(false); });
    const unsubCustomForms = subscribeToCustomForms((data) => setCustomForms(data));
    const unsubCustomers = subscribeToCustomers((data) => setCustomers(data));
    const unsubMessages = subscribeToMessages((data) => setMessages(data));
    const unsubTasks = subscribeToTasks((data) => setTasks(data));
    const unsubMeetings = subscribeToMeetings((data) => setMeetings(data));
    const unsubKPIs = subscribeToKPIs((data) => setKpis(data));
    const unsubSettings = subscribeToSettings(
      (cfg) => {
        if (cfg) {
          const LABEL_MIGRATIONS: Record<string, string> = {
            'شرح درخواست و اطلاعات محصول': 'اطلاعات محصول',
            'Request Description & Product Info': 'Product Information',
          };
          const mergedFields = (cfg.formFields || []).map(field => {
            if (!field.isSystem) return field;
            const def = INITIAL_CONFIG.formFields.find(f => f.id === field.id);
            if (!def) return field;
            return {
              ...field,
              label:         LABEL_MIGRATIONS[field.label] ?? field.label,
              labelEn:       LABEL_MIGRATIONS[field.labelEn ?? ''] ?? (field.labelEn || def.labelEn),
              placeholder:   (field.id === 'f8' && field.placeholder?.includes('ابعاد')) ? def.placeholder : field.placeholder,
              placeholderEn: field.placeholderEn || def.placeholderEn,
              optionsEn:     field.optionsEn     || def.optionsEn,
              // "اطلاعات محصول" (Product Information) is now optional
              required:      field.id === 'f8' ? false : field.required,
            };
          });
          const merged = { ...cfg, formFields: mergedFields };
          setAppConfig(merged);
          writeCache(CACHE_KEYS.CONFIG, merged);
        }
      },
      (srv) => {
        if (srv) {
          const normalized = srv.map((s: any) => ({ ...s, price: typeof s.price === 'string' ? { amount: 0, currency: 'IRR' } : (s.price || { amount: 0, currency: 'IRR' }) }));
          setServices(normalized);
          setIsServicesLoaded(true);
          writeCache(CACHE_KEYS.SERVICES, normalized);
        }
      },
      (ppl) => {
        if (ppl) {
          const normalized = ppl.map((p: any) => ({ ...p, roles: Array.isArray(p.roles) ? p.roles : (p.role ? [p.role] : []), status: p.status || 'active', permissions: p.permissions || {} }));
          setPersonnel(normalized);
          setCurrentUser(prev => {
            if (!prev) return prev;
            const updated = normalized.find((p: Personnel) => p.id === prev.id);
            if (updated) {
              try { localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sanitizeData(updated))); } catch {}
              return updated;
            }
            return prev;
          });
        }
      }
    );
    const unsubNews = subscribeToNews((data) => { setNews(data); setIsLoadingNews(false); });
    const unsubAnalytics = subscribeToAnalytics((data) => setAnalyticsEvents(data));
    const unsubCustomerAccounts = subscribeToCustomerAccounts(setCustomerAccounts);
    const unsubProcesses = subscribeToProcesses(setProcesses);
    const unsubInvoices = subscribeToInvoices(setInvoices);
    const unsubMetaShops = subscribeToMetaShops(setMetaShops);
    const unsubMetaShopOrders = subscribeToMetaShopOrders(setMetaShopOrders);
    const unsubMetaBazaars = subscribeToMetaBazaars(setMetaBazaars);
    return () => { unsubTickets(); unsubCustomForms(); unsubCustomers(); unsubSettings(); unsubMessages(); unsubTasks(); unsubMeetings(); unsubKPIs(); unsubNews(); unsubAnalytics(); unsubCustomerAccounts(); unsubProcesses(); unsubInvoices(); unsubMetaShops(); unsubMetaShopOrders(); unsubMetaBazaars(); };
  }, []);

  // ── Client-side meeting reminder timers ─────────────────────────────────────
  // Sends WhatsApp 1 hour before each upcoming meeting when browser is open.
  // Server-side cron (api/meeting-reminder.js) handles the offline case.
  const meetingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Tickets already auto-assigned+notified this session — prevents duplicate WhatsApp
  // sends if the effect re-runs before the assignment update propagates back.
  const assignProcessedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    meetingTimersRef.current.forEach(clearTimeout);
    meetingTimersRef.current = [];

    const nc = appConfig.notificationConfig;
    if (!nc?.enabled || nc.onMeetingReminder === false) return;

    const SENT_KEY = 'meeting_reminder_sent_v1';
    let sent: Record<string, boolean> = {};
    try { sent = JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); } catch {}

    const now = Date.now();

    for (const meeting of meetings) {
      const meetingMs = new Date(`${meeting.date}T${meeting.startTime}:00`).getTime();
      const reminderMs = meetingMs - 60 * 60 * 1000; // 1 hour before
      const delay = reminderMs - now;

      // Skip if already past reminder time or more than 24 h away
      if (delay < 0 || delay > 24 * 60 * 60 * 1000) continue;

      const reminderKey = `${meeting.id}_1hr`;
      if (sent[reminderKey]) continue;

      const timer = setTimeout(async () => {
        const currentNc = appConfig.notificationConfig;
        if (!currentNc?.enabled || currentNc.onMeetingReminder === false) return;

        const allPersonIds = [...new Set([meeting.organizerId, ...(meeting.attendeeIds || [])])];
        for (const pid of allPersonIds) {
          const person = personnel.find(p => p.id === pid);
          if (!person) continue;
          const phone = currentNc.personnelPhones?.[pid];
          if (!phone) continue;
          const apiKey = currentNc.personnelApiKeys?.[pid];
          if (currentNc.provider === 'callmebot' && !apiKey) continue;

          const msg = renderTemplate(currentNc.meetingReminderTemplate || DEFAULT_MEETING_REMINDER_TEMPLATE, {
            recipientName:   person.fullName,
            meetingTitle:    meeting.title,
            meetingDate:     meeting.date,
            meetingTime:     meeting.startTime,
            meetingLocation: meeting.location || 'نامشخص',
            organizerName:   meeting.organizerName,
          });

          const result = await sendWhatsAppNotification(phone, msg, currentNc, apiKey);
          await saveNotificationLog(buildLog('meeting_reminder', pid, person.fullName, phone, msg, result, undefined, meeting.id));
          await sendMasterCopy({ config: currentNc, personnel, message: msg, originalRecipientId: pid, originalRecipientName: person.fullName, logType: 'meeting_reminder', meetingId: meeting.id, saveLog: saveNotificationLog });
        }

        // Mark sent in localStorage to avoid resend on re-render
        try {
          const updated = JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
          updated[reminderKey] = true;
          localStorage.setItem(SENT_KEY, JSON.stringify(updated));
        } catch {}
      }, delay);

      meetingTimersRef.current.push(timer);
    }

    return () => { meetingTimersRef.current.forEach(clearTimeout); };
  }, [meetings, appConfig.notificationConfig, personnel]);

  // ── Client-side daily summary at 17:00 Tehran time ──────────────────────────
  const dailySummaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dailySummaryTimerRef.current) clearTimeout(dailySummaryTimerRef.current);

    const nc = appConfig.notificationConfig;
    if (!nc?.enabled || nc.onDailySummary === false) return;

    const now = new Date();
    // 17:00 Tehran = local 17:00 (assuming client runs in Tehran timezone)
    const todayAt5PM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0, 0);
    const delay = todayAt5PM.getTime() - now.getTime();
    if (delay < 0) return; // Already past 5 PM today

    const DAILY_SENT_KEY = 'daily_summary_sent_v1';
    const todayStr = now.toISOString().split('T')[0];
    let sentDays: Record<string, boolean> = {};
    try { sentDays = JSON.parse(localStorage.getItem(DAILY_SENT_KEY) || '{}'); } catch {}
    if (sentDays[todayStr]) return; // Already sent today

    dailySummaryTimerRef.current = setTimeout(async () => {
      const currentNc = appConfig.notificationConfig;
      if (!currentNc?.enabled || currentNc.onDailySummary === false) return;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const tomorrowMeetings = meetings.filter(m => m.date === tomorrowStr);
      if (tomorrowMeetings.length === 0) return;

      // Group meetings by person
      const personMeetingsMap: Record<string, Meeting[]> = {};
      for (const meeting of tomorrowMeetings) {
        const pids = [...new Set([meeting.organizerId, ...(meeting.attendeeIds || [])])];
        for (const pid of pids) {
          if (!personMeetingsMap[pid]) personMeetingsMap[pid] = [];
          personMeetingsMap[pid].push(meeting);
        }
      }

      for (const [pid, pMeetings] of Object.entries(personMeetingsMap)) {
        const person = personnel.find(p => p.id === pid);
        if (!person) continue;
        const phone = currentNc.personnelPhones?.[pid];
        if (!phone) continue;
        const apiKey = currentNc.personnelApiKeys?.[pid];
        if (currentNc.provider === 'callmebot' && !apiKey) continue;

        const sortedMeetings = [...pMeetings].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const meetingsList = sortedMeetings
          .map(m => `• ${m.title} — ${m.startTime} تا ${m.endTime}${m.location ? ` — ${m.location}` : ''}`)
          .join('\n');

        const msg = renderTemplate(currentNc.dailySummaryTemplate || DEFAULT_DAILY_SUMMARY_TEMPLATE, {
          recipientName: person.fullName,
          tomorrowDate:  tomorrowStr,
          meetingsList,
        });

        const result = await sendWhatsAppNotification(phone, msg, currentNc, apiKey);
        await saveNotificationLog(buildLog('daily_summary', pid, person.fullName, phone, msg, result));
        await sendMasterCopy({ config: currentNc, personnel, message: msg, originalRecipientId: pid, originalRecipientName: person.fullName, logType: 'daily_summary', saveLog: saveNotificationLog });
      }

      // Mark today's summary as sent
      try {
        const updated = JSON.parse(localStorage.getItem(DAILY_SENT_KEY) || '{}');
        updated[todayStr] = true;
        localStorage.setItem(DAILY_SENT_KEY, JSON.stringify(updated));
      } catch {}
    }, delay);

    return () => { if (dailySummaryTimerRef.current) clearTimeout(dailySummaryTimerRef.current); };
  }, [meetings, appConfig.notificationConfig, personnel]);

  const normalizeRoleName = (role?: string) => (role || '')
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  const calculateAssignee = useCallback((serviceIdOrTitle: string): string | undefined => {
    const config = appConfig.assignmentConfig;
    if (!config || config.mode === 'manual') return undefined;

    const findServiceId = () => {
      const serviceObj = services.find(s => s.id === serviceIdOrTitle || s.title === serviceIdOrTitle || s.titleEn === serviceIdOrTitle || s.title.includes(serviceIdOrTitle));
      return serviceObj?.id || serviceIdOrTitle;
    };

    if (config.targetType === 'personnel') {
      const selectedPersonId = config.servicePersonnelMap?.[findServiceId()];
      const selectedPerson = personnel.find(p => p.id === selectedPersonId && (p.status || 'active') === 'active');
      return selectedPerson?.id;
    }

    if (!config.serviceRoleMap) return undefined;
    let targetRole = config.serviceRoleMap[serviceIdOrTitle]?.trim();
    if (!targetRole) {
      const serviceObj = services.find(s => s.title === serviceIdOrTitle || s.titleEn === serviceIdOrTitle || s.title.includes(serviceIdOrTitle));
      if (serviceObj) targetRole = config.serviceRoleMap[serviceObj.id]?.trim();
    }
    if (!targetRole) return undefined;
    const normalizedTargetRole = normalizeRoleName(targetRole);
    const eligibleStaff = personnel.filter(p =>
      (p.status || 'active') === 'active' &&
      (p.roles || []).some(role => normalizeRoleName(role) === normalizedTargetRole)
    );
    if (eligibleStaff.length === 0) return undefined;
    if (config.mode === 'random') return eligibleStaff[Math.floor(Math.random() * eligibleStaff.length)].id;
    if (config.mode === 'auto_load_balance') {
      const staffWorkload = eligibleStaff.map(staff => ({ id: staff.id, count: tickets.filter(t => t.assignedTo === staff.id && t.status !== TicketStatus.COMPLETED && t.status !== TicketStatus.CANCELLED).length }));
      staffWorkload.sort((a, b) => a.count - b.count);
      return staffWorkload[0].id;
    }
    return undefined;
  }, [appConfig.assignmentConfig, personnel, tickets, services]);

  // Eligible active staff for a routing target (position takes priority over department)
  const eligibleForRouting = useCallback((routePosition?: string, routeDepartmentId?: string): Personnel[] => {
    if (routePosition) {
      const nr = normalizeRoleName(routePosition);
      return personnel.filter(p => (p.status || 'active') === 'active' && (p.roles || []).some(r => normalizeRoleName(r) === nr));
    }
    if (routeDepartmentId) {
      const dept = (appConfig.departments || []).find(d => d.id === routeDepartmentId);
      if (!dept) return [];
      const positions = dept.positions || [];
      return personnel.filter(p => (p.status || 'active') === 'active' && (p.roles || []).some(r => positions.includes(r)));
    }
    return [];
  }, [personnel, appConfig.departments]);

  const pickLeastLoaded = useCallback((eligible: Personnel[]): string | undefined => {
    if (eligible.length === 0) return undefined;
    if (eligible.length === 1) return eligible[0].id;
    const wl = eligible.map(s => ({ id: s.id, count: tickets.filter(t => t.assignedTo === s.id && t.status !== TicketStatus.COMPLETED && t.status !== TicketStatus.CANCELLED).length }));
    wl.sort((a, b) => a.count - b.count);
    return wl[0].id;
  }, [tickets]);

  // Per-service / per-sub-service routing configured in the Services & Tariffs section.
  // Sub-service routing takes priority over the service-level routing.
  const resolveServiceRouting = useCallback((ticket: Ticket): string | undefined => {
    const service = services.find(s => s.id === ticket.serviceId || s.title === ticket.serviceId || s.titleEn === ticket.serviceId || s.title.includes(ticket.serviceId));
    if (!service) return undefined;
    for (const subId of (ticket.selectedSubServices || [])) {
      const sub = service.subServices?.find(ss => ss.id === subId);
      if (sub && (sub.routePosition || sub.routeDepartmentId)) {
        const pick = pickLeastLoaded(eligibleForRouting(sub.routePosition, sub.routeDepartmentId));
        if (pick) return pick;
      }
    }
    if (service.routePosition || service.routeDepartmentId) {
      const pick = pickLeastLoaded(eligibleForRouting(service.routePosition, service.routeDepartmentId));
      if (pick) return pick;
    }
    return undefined;
  }, [services, eligibleForRouting, pickLeastLoaded]);

  useEffect(() => {
    if (!currentUser) return;
    const isAuthorized = currentUser.username === 'master' || currentUser.roles.includes('مدیر');
    if (!isAuthorized) return;
    const unassigned = tickets.filter(t => !t.assignedTo && t.status !== TicketStatus.CANCELLED && t.status !== TicketStatus.COMPLETED);
    if (unassigned.length === 0) return;
    const autoMode = !!appConfig.assignmentConfig && appConfig.assignmentConfig.mode !== 'manual';
    // Custom-form tickets (incl. those filled via the connected Google Form) are written
    // straight to Firestore and never pass through saveNewTicketToSystem. We resolve their
    // assignee here using the LIVE form config (looked up by formId) so it always matches
    // what you set in the form builder — falling back to any assignee embedded in customData.
    const resolveFormAssignee = (ticket: Ticket): string | undefined => {
      const cd = ticket.customData || {};
      // Assignee embedded in customData (custom forms + connected Google Forms)
      let directId = cd.__assigneePersonnelId;
      let roleStr  = cd.__assigneeRole;
      // For custom-form tickets, prefer the LIVE form config (so changing the assignee applies)
      if (ticket.serviceId?.startsWith('form:')) {
        const formId = cd.formId || ticket.serviceId.slice('form:'.length);
        const form = customForms.find(f => f.id === formId);
        if (form?.assigneePersonnelId) directId = form.assigneePersonnelId;
        if (form?.assigneeRole)        roleStr  = form.assigneeRole;
      }
      if (directId) return directId;
      if (roleStr) {
        const normalizedRole = roleStr.trim().toLowerCase();
        const eligible = personnel.filter(p => (p.status || 'active') === 'active' && (p.roles || []).some(r => r.trim().toLowerCase() === normalizedRole));
        if (eligible.length === 1) return eligible[0].id;
        if (eligible.length > 1) {
          const workload = eligible.map(p => ({ id: p.id, count: tickets.filter(t => t.assignedTo === p.id && t.status !== TicketStatus.COMPLETED && t.status !== TicketStatus.CANCELLED).length }));
          workload.sort((a, b) => a.count - b.count);
          return workload[0].id;
        }
      }
      return undefined;
    };
    const nc = appConfig.notificationConfig;
    const processAssignments = async () => {
      for (const ticket of unassigned) {
        if (assignProcessedRef.current.has(ticket.id)) continue;
        // Custom-form assignee first, then service/sub-service routing, then the global config
        let assigneeId = resolveFormAssignee(ticket);
        if (!assigneeId) assigneeId = resolveServiceRouting(ticket);
        if (!assigneeId && autoMode) assigneeId = calculateAssignee(ticket.serviceId);
        if (assigneeId) {
          const assignee = personnel.find(p => p.id === assigneeId);
          if (assignee) {
            assignProcessedRef.current.add(ticket.id);
            await updateTicketInCloud(ticket.id, { assignedTo: assigneeId, timeline: [...(ticket.timeline || []), { type: 'assignment', title: 'ارجاع خودکار (سیستم)', description: `ارجاع هوشمند به ${assignee.fullName}`, actorName: 'System Bot', timestamp: new Date().toISOString(), visibility: 'internal' }] });
            // WhatsApp notification — these tickets (e.g. from a connected Google Form) are
            // written straight to Firestore and bypass saveNewTicketToSystem, so notify here.
            // Only notify for RECENT submissions — when a big backlog of old unassigned
            // tickets first loads, we assign them silently instead of flooding WhatsApp.
            const ageMs = new Date().getTime() - new Date(ticket.createdAt).getTime();
            const isRecent = isFinite(ageMs) && ageMs >= 0 && ageMs < 30 * 60 * 1000;
            if (isRecent && nc?.enabled && nc.onNewTicket) {
              const msg = renderTemplate(nc.ticketTemplate, {
                recipientName: assignee.fullName,
                ticketId: ticket.id,
                customerName: ticket.customerName || '',
                formTitle: ticket.customData?.formTitle || ticket.serviceId,
                senderName: 'سیستم',
                status: ticket.status,
              });
              const phone = nc.personnelPhones?.[assigneeId];
              if (phone) {
                const result = await sendWhatsAppNotification(phone, msg, nc, nc.personnelApiKeys?.[assigneeId]);
                await saveNotificationLog(buildLog('new_ticket', assigneeId, assignee.fullName, phone, msg, result, ticket.id));
              }
              // Master copy — sent even if the assignee has NO phone configured.
              await sendMasterCopy({ config: nc, personnel, message: msg, originalRecipientId: assigneeId, originalRecipientName: assignee.fullName, logType: 'new_ticket', ticketId: ticket.id, saveLog: saveNotificationLog });
            }
          }
        }
      }
    };
    processAssignments();
  }, [tickets, currentUser, appConfig.assignmentConfig, appConfig.notificationConfig, calculateAssignee, resolveServiceRouting, personnel, customForms]);

  // Returns the best fallback assignee: prefers managers who have WhatsApp notification set up
  const getCeoFallbackId = (): string | undefined => {
    const nc = appConfig.notificationConfig;
    const phones  = nc?.personnelPhones  || {};
    const apiKeys = nc?.personnelApiKeys || {};
    const isCallMeBot = nc?.provider === 'callmebot';

    // A person is "notification-ready" if they have a phone (and API key for callmebot)
    const notifReady = (id: string) =>
      !!phones[id] && (!isCallMeBot || !!apiKeys[id]);

    const active = (p: Personnel) => (p.status || 'active') === 'active';
    const isManager = (p: Personnel) => (p.roles || []).some(r => r.includes('مدیر'));

    // 1. Master account with notification set up
    const masterWithNotif = personnel.find(p => p.username === 'master' && active(p) && notifReady(p.id));
    if (masterWithNotif) return masterWithNotif.id;

    // 2. Any active manager with notification set up
    const managerWithNotif = personnel.find(p => active(p) && isManager(p) && notifReady(p.id));
    if (managerWithNotif) return managerWithNotif.id;

    // 3. Master account even without notification (assignment still works)
    const master = personnel.find(p => p.username === 'master' && active(p));
    if (master) return master.id;

    // 4. Any active manager
    return personnel.find(p => active(p) && isManager(p))?.id;
  };

  const saveNewTicketToSystem = async (ticket: Ticket) => {
    // Guarantee a case code — if the caller didn't supply one, generate it now
    if (!ticket.id) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const suffix = (ticket.customData?.formId || ticket.serviceId || 'TKT').slice(0, 3).toUpperCase();
      (ticket as any).id = `FRM-${rand}-${suffix}`;
    }

    let assignedTo = ticket.assignedTo;
    let assignmentNote: TimelineEntry | null = null;

    if (!assignedTo) {
      // 1. For custom-form tickets: check if the form itself has an assignee config
      if (ticket.serviceId?.startsWith('form:') && ticket.customData?.formId) {
        // assignee info was already embedded in ticket.customData by PublicFormView
        const directId = ticket.customData.__assigneePersonnelId;
        const roleStr  = ticket.customData.__assigneeRole;
        if (directId) {
          // Direct person assignment
          assignedTo = directId;
        } else if (roleStr) {
          // Role-based → load-balance among eligible staff
          const normalizedRole = roleStr.trim().toLowerCase();
          const eligible = personnel.filter(p =>
            (p.status || 'active') === 'active' &&
            (p.roles || []).some(r => r.trim().toLowerCase() === normalizedRole)
          );
          if (eligible.length === 1) {
            assignedTo = eligible[0].id;
          } else if (eligible.length > 1) {
            // Pick person with fewest active tickets
            const workload = eligible.map(p => ({
              id: p.id,
              count: tickets.filter(t =>
                t.assignedTo === p.id &&
                t.status !== TicketStatus.COMPLETED &&
                t.status !== TicketStatus.CANCELLED
              ).length,
            }));
            workload.sort((a, b) => a.count - b.count);
            assignedTo = workload[0].id;
          }
        }
      }

      // 2. System assignment config
      if (!assignedTo) {
        const autoId = calculateAssignee(ticket.serviceId);
        if (autoId) assignedTo = autoId;
      }

      // 3. CEO/master fallback — nobody left unassigned
      if (!assignedTo) {
        assignedTo = getCeoFallbackId();
      }

      if (assignedTo) {
        const assigneeName = personnel.find(p => p.id === assignedTo)?.fullName || 'مدیریت';
        const wasCeoFallback = !ticket.customData?.__assigneePersonnelId && !ticket.customData?.__assigneeRole && !calculateAssignee(ticket.serviceId);
        const note = wasCeoFallback
          ? `فرم بدون تنظیم ارجاع ثبت شد — پرونده به‌صورت خودکار به ${assigneeName} ارجاع داده شد. ${assigneeName} می‌تواند پرونده را به کارشناس مربوطه ارجاع دهد.`
          : `پرونده به ${assigneeName} ارجاع داده شد.`;
        assignmentNote = { type: 'assignment', title: 'ارجاع خودکار', description: note, actorName: 'سیستم', timestamp: new Date().toISOString(), visibility: 'internal' };
      }
    }

    const initialTimeline: TimelineEntry[] = [
      { type: 'creation', title: 'ثبت درخواست', description: 'درخواست در سامانه ثبت شد', timestamp: new Date().toISOString(), actorName: 'سیستم', visibility: 'public' },
      ...(ticket.timeline || []),
    ];
    if (assignmentNote) initialTimeline.push(assignmentNote);

    let newCustomer: Customer | undefined;
    // Recognize the customer by mobile number (normalized) — same phone = same customer, even with a different name
    const ticketPhoneNorm = (ticket.phoneNumber || '').replace(/\D/g, '');
    const existingCustomer = customers.find(c => (c.phoneNumber || '').replace(/\D/g, '') === ticketPhoneNorm && ticketPhoneNorm !== '');
    if (existingCustomer) {
      newCustomer = { ...existingCustomer, fullName: ticket.customerName, companyName: ticket.companyName || existingCustomer.companyName, location: ticket.location || existingCustomer.location, whatsappNumber: ticket.whatsappNumber, businessType: ticket.businessType || existingCustomer.businessType, totalTickets: existingCustomer.totalTickets + 1, source: existingCustomer.source || 'Web Form' };
    } else {
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const phoneSuffix = (ticket.phoneNumber || '').slice(-4);
      newCustomer = { id: `C-${Date.now()}`, fullName: ticket.customerName, companyName: ticket.companyName, location: ticket.location, phoneNumber: ticket.phoneNumber, whatsappNumber: ticket.whatsappNumber, businessType: ticket.businessType, firstContact: new Date().toISOString(), totalTickets: 1, source: ticket.customData?.formTitle ? `Form: ${ticket.customData.formTitle}` : 'Web Form', loyaltyCode: `VIP-${phoneSuffix}-${randomStr}` };
    }
    await saveTicketToCloud({ ...ticket, assignedTo, timeline: initialTimeline });
    if (newCustomer) await saveCustomerToCloud(newCustomer);

    // WhatsApp notification to assignee
    const nc = appConfig.notificationConfig;
    if (nc?.enabled && nc.onNewTicket && assignedTo) {
      const assignee = personnel.find(p => p.id === assignedTo);
      if (assignee) {
        const msg = renderTemplate(nc.ticketTemplate, {
          recipientName: assignee.fullName,
          ticketId: ticket.id,
          customerName: ticket.customerName,
          formTitle: ticket.customData?.formTitle || ticket.serviceId,
          senderName: 'سیستم',
          status: ticket.status,
        });
        const phone = nc.personnelPhones[assignedTo];
        if (phone) {
          const result = await sendWhatsAppNotification(phone, msg, nc, nc.personnelApiKeys[assignedTo]);
          await saveNotificationLog(buildLog('new_ticket', assignedTo, assignee.fullName, phone, msg, result, ticket.id));
        }
        // Master copy — sent even if the assignee has NO phone configured.
        await sendMasterCopy({ config: nc, personnel, message: msg, originalRecipientId: assignedTo, originalRecipientName: assignee.fullName, logType: 'new_ticket', ticketId: ticket.id, saveLog: saveNotificationLog });
      }
    }
  };

  const handleNewTicket = async (ticketOrTickets: Ticket | Ticket[]) => {
    try {
      if (Array.isArray(ticketOrTickets)) { for (const t of ticketOrTickets) await saveNewTicketToSystem(t); }
      else await saveNewTicketToSystem(ticketOrTickets);
    } catch (e: any) { console.error("Database Save Error", e); alert("خطا در ذخیره سازی در دیتابیس."); throw e; }
  };

  const handleUpdateTicket = async (id: string, updates: Partial<Ticket>, actorName: string, actionNote?: string, visibility: 'public' | 'internal' = 'public', files?: AttachedFile[]) => {
    let updatePayload = { ...updates };
    const currentTicket = tickets.find(t => t.id === id);
    let newEntry: TimelineEntry | null = null;
    if (actionNote) {
      newEntry = { type: updates.projectData ? 'project_update' : (updates.status ? 'status_change' : (updates.assignedTo ? 'assignment' : 'comment')), title: updates.status ? 'تغییر وضعیت' : (updates.assignedTo ? 'تغییر مسئول' : (updates.projectData ? 'بروزرسانی پروژه' : 'یادداشت')), description: actionNote, timestamp: new Date().toISOString(), actorName, visibility, ...(files && files.length > 0 && { files }) };
    } else if (updates.status && updates.status !== currentTicket?.status) {
      newEntry = { type: 'status_change', title: `تغییر وضعیت به ${updates.status}`, timestamp: new Date().toISOString(), actorName, visibility: 'public' };
    }
    if (newEntry) updatePayload.timeline = [...(currentTicket?.timeline || []), newEntry];
    await updateTicketInCloud(id, updatePayload);
  };

  const handleDeleteTicket = async (id: string) => { await deleteTicketFromCloud(id); };
  const handleUpdateCustomers = async (newCustomersList: Customer[]) => {
    const imported = newCustomersList.filter(c => c.source?.startsWith('Import') && !customers.find(old => old.id === c.id));
    if (imported.length > 0) await saveCustomersBulkToCloud(imported);
  };
  const handleEditCustomer = async (id: string, updates: Partial<Customer>) => { await updateCustomerInCloud(id, updates); };
  const handleDeleteCustomer = async (id: string) => { await deleteCustomerFromCloud(id); };
  const handleUpdateServices = async (newServices: ServiceOption[]) => { await saveServicesToCloud(newServices); };
  const handleUpdatePersonnel = async (newPersonnel: Personnel[]) => { await savePersonnelToCloud(newPersonnel); };
  const handleUpdateConfig = async (newConfig: AppConfig) => { await saveAppConfigToCloud(newConfig); };

  const handleLogin = async (u: string, p: string): Promise<boolean> => {
    const user = personnel.find(person => person.username === u && person.password === p);
    if (user) {
      setCurrentUser(user);
      logSystemAction('LOGIN', 'System', 'ورود کاربر به سیستم', user.fullName, user.id);
      try { localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(sanitizeData(user))); localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString()); } catch { }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('landing');
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.VIEW);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
  };

  const handleCustomerLogin = async (username: string, password: string): Promise<boolean> => {
    const account = customerAccounts.find(a => a.username === username && a.password === password && a.isActive);
    if (account) {
      setCurrentCustomerUser(account);
      return true;
    }
    return false;
  };

  const handleCustomerLogout = () => {
    setCurrentCustomerUser(null);
  };

  const handleCustomerUploadSubmit = async (ticketId: string, message: string, files: AttachedFile[]) => {
    let ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) {
      // Ticket may have been found via direct Firestore lookup in TrackingView but not yet in local subscription
      ticket = await getTicketById(ticketId) ?? undefined;
    }
    if (!ticket) throw new Error('پرونده یافت نشد');
    const now = new Date().toISOString();
    const newEntry: TimelineEntry = {
      type: 'customer_upload',
      title: 'مدرک / اطلاعات از مشتری',
      description: message || undefined,
      actorName: ticket.customerName,
      timestamp: now,
      visibility: 'public',
      ...(files.length > 0 && { files }),
    };
    await updateTicketInCloud(ticketId, {
      timeline: [...(ticket.timeline || []), newEntry],
      customerUploadWindow: { ...(ticket.customerUploadWindow as any), isOpen: false },
    });
  };

  // ── Public "Contact Us" (from tracking page) → lands in مکاتبات, routed to a department ──
  const normalizePhone = (p: string) => (p || '').replace(/\D/g, '');

  const handleContactSubmit = async (data: { name: string; phone: string; departmentId: string; message: string }) => {
    const name = data.name.trim();
    const phoneRaw = data.phone.trim();
    const phone = normalizePhone(phoneRaw);
    const message = data.message.trim();
    if (!name || !phone || !message || !data.departmentId) throw new Error('اطلاعات ناقص است');

    const dept = (appConfig.departments || []).find(d => d.id === data.departmentId);
    if (!dept) throw new Error('دپارتمان نامعتبر است');

    // ── Customer recognition by mobile (same phone = same customer, even with a different name) ──
    const existingCustomer = customers.find(c => normalizePhone(c.phoneNumber) === phone);
    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Remember the latest name they used; keep their record (recognized by phone)
      await saveCustomerToCloud({ ...existingCustomer, fullName: name || existingCustomer.fullName });
    } else {
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const phoneSuffix = phone.slice(-4);
      const newCustomer: Customer = {
        id: `C-${Date.now()}`, fullName: name, location: '', phoneNumber: phoneRaw, whatsappNumber: phoneRaw,
        firstContact: new Date().toISOString(), totalTickets: 0, source: 'Contact Form',
        loyaltyCode: `VIP-${phoneSuffix}-${randomStr}`,
      };
      customerId = newCustomer.id;
      await saveCustomerToCloud(newCustomer);
    }

    // ── Route to a specific سمت if configured, otherwise to all staff of the selected department; fallback to master ──
    const targetPosition = dept.contactRecipientPosition;
    let recipients = targetPosition
      ? personnel.filter(p => (p.roles || []).includes(targetPosition))
      : personnel.filter(p => (p.roles || []).some(r => (dept.positions || []).includes(r)));
    // The master ALWAYS receives a copy of every customer correspondence
    const masterUser = personnel.find(p => p.username === 'master');
    if (masterUser && !recipients.some(p => p.id === masterUser.id)) recipients = [...recipients, masterUser];

    // Human-friendly tracking code for the correspondence (e.g. MK-1234-AB7C)
    const trackingRandom = Math.random().toString(36).substring(2, 6).toUpperCase();
    const trackingCode = `MK-${phone.slice(-4)}-${trackingRandom}`;

    const msg: InternalMessage = {
      id: `contact-${Date.now()}`,
      senderId: '',
      senderName: name,
      recipientIds: recipients.map(p => p.id),
      recipientNames: recipients.map(p => p.fullName),
      subject: `تماس از ${name} — دپارتمان ${dept.name}`,
      body: message,
      createdAt: new Date().toISOString(),
      readBy: [],
      isCustomerContact: true,
      contactName: name,
      contactPhone: phone,
      contactDepartmentId: dept.id,
      contactDepartmentName: dept.name,
      contactTrackingCode: trackingCode,
      customerId,
      replies: [],
      referrals: [],
    };
    await sendInternalMessage(msg);
    return trackingCode;
  };

  // Customer looks up a single correspondence by its tracking code (MK-...)
  const lookupContactByCode = (code: string): InternalMessage | null => {
    const c = code.trim().toUpperCase();
    if (!c) return null;
    return messages.find(m => m.isCustomerContact && (m.contactTrackingCode || '').toUpperCase() === c) || null;
  };

  // Customer looks up their own contact conversations by name + mobile (no auth)
  const lookupContactMessages = (name: string, phone: string): InternalMessage[] => {
    const n = name.trim().toLowerCase();
    const ph = normalizePhone(phone);
    if (!ph) return [];
    return messages
      .filter(m => m.isCustomerContact && normalizePhone(m.contactPhone || '') === ph && (!n || (m.contactName || '').trim().toLowerCase() === n))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // ── Meta Shop: resolve public shop by slug (from subscription, else direct fetch) ──
  useEffect(() => {
    if (view !== 'metashop' || !shopSlug) { setPublicShop(null); return; }
    const local = metaShops.find(s => s.slug === shopSlug);
    if (local) { setPublicShop(local); return; }
    if (metaShops.length === 0) {
      // subscription not warm yet — fetch directly
      let cancelled = false;
      setShopLoading(true);
      getMetaShopBySlug(shopSlug).then(s => { if (!cancelled) { setPublicShop(s); setShopLoading(false); } });
      return () => { cancelled = true; };
    }
    setPublicShop(null); // subscription warm but no match → not found
  }, [view, shopSlug, metaShops]);

  // ── Meta Bazaar: resolve public bazaar by slug ──
  useEffect(() => {
    if (view !== 'bazaar' || !bazaarSlug) { setPublicBazaar(null); return; }
    const local = metaBazaars.find(b => b.slug === bazaarSlug);
    if (local) { setPublicBazaar(local); return; }
    if (metaBazaars.length === 0) {
      let cancelled = false;
      setBazaarLoading(true);
      getMetaBazaarBySlug(bazaarSlug).then(b => { if (!cancelled) { setPublicBazaar(b); setBazaarLoading(false); } });
      return () => { cancelled = true; };
    }
    setPublicBazaar(null);
  }, [view, bazaarSlug, metaBazaars]);

  // ── Metaverse Expo: resolve the parent bazaar by slug (the expo config lives inside bazaar.expo) ──
  useEffect(() => {
    if (view !== 'expo' || !expoSlug) { setPublicExpoBazaar(null); return; }
    const local = metaBazaars.find(b => b.slug === expoSlug);
    if (local) { setPublicExpoBazaar(local); return; }
    if (metaBazaars.length === 0) {
      let cancelled = false;
      setExpoLoading(true);
      getMetaBazaarBySlug(expoSlug).then(b => { if (!cancelled) { setPublicExpoBazaar(b); setExpoLoading(false); } });
      return () => { cancelled = true; };
    }
    setPublicExpoBazaar(null);
  }, [view, expoSlug, metaBazaars]);

  // ── Meta Shop: customer places an order → save order + route to کارتابل + return tracking code ──
  const handleMetaShopOrder = async (shop: MetaShop, data: { customerName: string; company?: string; phone: string; email?: string; country?: string; city?: string; notes?: string; items: MetaShopOrder['items']; fees?: { label: string; amount: number }[]; itemsTotal?: number; discountCode?: string; discountAmount?: number; taxRate?: number; taxAmount?: number; taxInclusive?: boolean; total: number; currency: string; }): Promise<string> => {
    const phoneRaw = data.phone.trim();
    const phone = normalizePhone(phoneRaw);
    // Tracking code, e.g. SHP-1234-AB7C
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const trackingCode = `SHP-${phone.slice(-4)}-${rand}`;

    // Recognize / create customer by phone
    let customerId: string | undefined;
    const existing = customers.find(c => normalizePhone(c.phoneNumber) === phone);
    if (existing) {
      customerId = existing.id;
      await saveCustomerToCloud({ ...existing, fullName: data.customerName || existing.fullName, companyName: data.company || existing.companyName });
    } else {
      const newCustomer: Customer = {
        id: `C-${Date.now()}`, fullName: data.customerName, companyName: data.company, location: [data.city, data.country].filter(Boolean).join(', '),
        phoneNumber: phoneRaw, whatsappNumber: phoneRaw, email: data.email, firstContact: new Date().toISOString(), totalTickets: 0, source: `Meta Shop${isEmbed ? ' (Google Site)' : ''}: ${shop.name}`,
      };
      customerId = newCustomer.id;
      await saveCustomerToCloud(newCustomer);
    }

    const order: MetaShopOrder = {
      id: `mso-${Date.now()}`, shopId: shop.id, shopName: shop.name, shopType: shop.type,
      trackingCode, customerName: data.customerName, company: data.company, phone, email: data.email,
      country: data.country, city: data.city, notes: data.notes, items: data.items,
      fees: data.fees, itemsTotal: data.itemsTotal, discountCode: data.discountCode, discountAmount: data.discountAmount,
      taxRate: data.taxRate, taxAmount: data.taxAmount, taxInclusive: data.taxInclusive, total: data.total,
      currency: data.currency, status: 'new', createdAt: new Date().toISOString(), customerId,
      via: isEmbed ? 'gsite' : 'shop',
    };
    await saveMetaShopOrderToCloud(order);

    // Route to the کارتابل of assigned personnel / department (as an internal message)
    let recipients: Personnel[] = [];
    if (shop.assignType === 'department' && shop.assignedDepartmentId) {
      const dept = (appConfig.departments || []).find(d => d.id === shop.assignedDepartmentId);
      if (dept) recipients = personnel.filter(p => (p.roles || []).some(r => (dept.positions || []).includes(r)));
    } else if (shop.assignType === 'personnel' && shop.assignedPersonnelIds?.length) {
      recipients = personnel.filter(p => shop.assignedPersonnelIds!.includes(p.id));
    }
    // The master ALWAYS receives a copy of every shop order
    const masterUser = personnel.find(p => p.username === 'master');
    if (masterUser && !recipients.some(p => p.id === masterUser.id)) recipients = [...recipients, masterUser];

    const anyNeg = data.items.some((it: any) => it.priceHidden);
    const allNeg = data.items.length > 0 && data.items.every((it: any) => it.priceHidden);
    const itemsText = data.items.map((it: any, i: number) => `${i + 1}. ${it.name}${it.sku ? ` [${it.sku}]` : ''} × ${it.qty}${it.priceHidden ? ' — قابل مذاکره' : (it.unitPrice ? ` — ${it.currency || data.currency} ${(it.lineTotal || 0).toLocaleString()}` : '')}`).join('\n');
    const feesText = (data.fees && data.fees.length) ? `\n\nهزینه‌های اضافی:\n${data.fees.map(f => `• ${f.label}: ${data.currency} ${(f.amount || 0).toLocaleString()}`).join('\n')}` : '';
    const subtotalText = ((data.fees && data.fees.length) || data.discountAmount || data.taxAmount) && data.itemsTotal != null ? `\nجمع اقلام: ${data.currency} ${data.itemsTotal.toLocaleString()}` : '';
    const discountText = data.discountAmount ? `\nتخفیف (${data.discountCode || ''}): − ${data.currency} ${data.discountAmount.toLocaleString()}` : '';
    const taxText = data.taxAmount ? `\nمالیات (${data.taxRate}%${data.taxInclusive ? ' شامل' : ''}): ${data.taxInclusive ? '' : '+ '}${data.currency} ${data.taxAmount.toLocaleString()}` : '';
    const viaText = isEmbed ? `\n🌐 ثبت‌شده از طریق گوگل‌سایت / سایت تعبیه‌شده` : '';
    const body = `🛒 سفارش جدید از فروشگاه «${shop.name}»\nکد رهگیری: ${trackingCode}${viaText}\n\nمشتری: ${data.customerName}${data.company ? ` (${data.company})` : ''}\nموبایل: ${phoneRaw}${data.email ? `\nایمیل: ${data.email}` : ''}${data.country || data.city ? `\nمقصد: ${[data.city, data.country].filter(Boolean).join('، ')}` : ''}\n\nاقلام:\n${itemsText}${subtotalText}${discountText}${feesText}${taxText}\n\nجمع کل: ${allNeg ? 'قابل مذاکره' : `${data.currency} ${data.total.toLocaleString()}${anyNeg ? ' + اقلام قابل مذاکره' : ''}`}${data.notes ? `\n\nتوضیحات: ${data.notes}` : ''}`;
    const msg: InternalMessage = {
      id: `shopmsg-${Date.now()}`, senderId: '', senderName: data.customerName,
      recipientIds: recipients.map(p => p.id), recipientNames: recipients.map(p => p.fullName),
      subject: `سفارش ${shop.name} — ${data.customerName} (${trackingCode})`, body,
      createdAt: new Date().toISOString(), readBy: [],
      isCustomerContact: true, contactName: data.customerName, contactPhone: phone,
      contactDepartmentName: shop.name, contactTrackingCode: trackingCode, customerId, replies: [],
    };
    await sendInternalMessage(msg);
    return trackingCode;
  };

  const handleMetaShopLookup = async (criteria: { phone?: string; trackingCode?: string; name?: string }): Promise<MetaShopOrder[]> => {
    const code = (criteria.trackingCode || '').trim().toUpperCase();
    const ph = normalizePhone(criteria.phone || '');
    const nm = (criteria.name || '').trim().toLowerCase();
    // Primary lookup: tracking code if given, otherwise phone. (Name alone is too broad to query.)
    let results: MetaShopOrder[] = [];
    if (code) results = await lookupMetaShopOrdersByTracking(code);
    else if (ph) results = await lookupMetaShopOrders(ph);
    else return [];
    // Refine with any other fields the customer supplied, so the three together act as a filter.
    if (ph) results = results.filter(o => normalizePhone(o.phone) === ph);
    if (nm) results = results.filter(o => (o.customerName || '').trim().toLowerCase().includes(nm));
    return results;
  };

  const handleCustomerAddComment = async (ticketId: string, commentText: string, files?: AttachedFile[]) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket || !currentCustomerUser) return;
    const newEntry: TimelineEntry = {
      type: 'comment',
      title: 'پیام مشتری',
      description: commentText,
      actorName: currentCustomerUser.fullName,
      timestamp: new Date().toISOString(),
      visibility: 'public',
      ...(files && files.length > 0 && { files }),
    };
    await updateTicketInCloud(ticketId, { timeline: [...(ticket.timeline || []), newEntry] });
  };

  // ── Public Metaverse Expo (3D / WebXR full-screen takeover) ──
  if (view === 'expo') {
    const expo = publicExpoBazaar?.expo;
    if (publicExpoBazaar && publicExpoBazaar.isActive !== false && expo && expo.enabled) {
      const expoTitle = (lang === 'fa' ? expo.title?.fa : expo.title?.en) || publicExpoBazaar.name;
      const expoSub = (lang === 'fa' ? expo.subtitle?.fa : expo.subtitle?.en) || undefined;
      return (
        <React.Suspense fallback={<ExpoDoorsLoader lang={lang} title={expoTitle} subtitle={expoSub} primary={publicExpoBazaar.theme?.primary || '#2d4a1a'} />}>
          <MetaverseExpoView
            bazaar={publicExpoBazaar}
            shops={metaShops}
            lang={lang}
            onExit={() => setView('landing')}
            onOpenShop={(slug) => { history.pushState(null, '', `?shop=${encodeURIComponent(slug)}`); setShopSlug(slug); setViewState('metashop'); window.scrollTo(0, 0); }}
          />
        </React.Suspense>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
        {expoLoading || (metaBazaars.length === 0 && expoSlug)
          ? <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
          : <div className="text-center text-gray-400"><p className="text-lg font-semibold text-gray-600 mb-1">{lang === 'fa' ? 'نمایشگاه یافت نشد' : 'Exhibition not found'}</p><p className="text-sm">{lang === 'fa' ? 'این نمایشگاه وجود ندارد یا غیرفعال است.' : 'This exhibition does not exist or is inactive.'}</p><button onClick={() => setView('landing')} className="mt-4 text-sm text-indigo-600 hover:underline">{lang === 'fa' ? 'بازگشت به خانه' : 'Back home'}</button></div>}
      </div>
    );
  }

  // ── Public curated Bazaar (full-screen takeover) — with a neutral "grand doors" loader ──
  if (view === 'bazaar') {
    const ready = !!(publicBazaar && publicBazaar.isActive !== false);
    const loading = !ready && (bazaarLoading || (metaBazaars.length === 0 && !!bazaarSlug));
    if (!ready && !loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
          <div className="text-center text-gray-400"><p className="text-lg font-semibold text-gray-600 mb-1">{lang === 'fa' ? 'بازارچه یافت نشد' : 'Bazaar not found'}</p><button onClick={() => setView('landing')} className="mt-4 text-sm text-indigo-600 hover:underline">{lang === 'fa' ? 'بازگشت به خانه' : 'Back home'}</button></div>
        </div>
      );
    }
    const bzTitle = publicBazaar ? ((lang === 'fa' ? publicBazaar.title?.fa : publicBazaar.title?.en) || publicBazaar.name) : (lang === 'fa' ? 'بازارچه' : 'Bazaar');
    if (!ready) {
      return <BazaarPassageLoader lang={lang} title={bzTitle} primary="#5b6472" accent="#cbd5e1" />;
    }
    return (
      <>
        {publicBazaar && (
          <MetaShopDirectory
            shops={metaShops}
            lang={lang}
            bazaar={publicBazaar}
            onOpenShop={(slug) => { history.pushState(null, '', `?shop=${encodeURIComponent(slug)}`); setShopSlug(slug); setViewState('metashop'); window.scrollTo(0, 0); }}
          />
        )}
      </>
    );
  }

  // ── Public "all shops" bazaar/directory (full-screen takeover) ──
  if (view === 'shopsdir') {
    return (
      <MetaShopDirectory
        shops={metaShops}
        lang={lang}
        onOpenShop={(slug) => { history.pushState(null, '', `?shop=${encodeURIComponent(slug)}`); setShopSlug(slug); setViewState('metashop'); window.scrollTo(0, 0); }}
      />
    );
  }

  // ── Public Meta Shop page (full-screen takeover) ──
  if (view === 'metashop') {
    if (publicShop && publicShop.isActive !== false) {
      // ?catalog=1 / ?pdf=1 → printable A4 PDF catalog (same shop, different render)
      if (catalogMode) return <MetaShopCatalog shop={publicShop} lang={lang} autoPrint />;
      return <MetaShopView shop={publicShop} lang={lang} embed={isEmbed} onSubmitOrder={(d) => handleMetaShopOrder(publicShop, d)} onLookup={handleMetaShopLookup} />;
    }
    // Still resolving the shop → show the "raising the shutter" loader (no artificial delay)
    if (shopLoading || (metaShops.length === 0 && shopSlug)) {
      return <ShopShutterLoader lang={lang} />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
        <div className="text-center text-gray-400">
          <p className="text-lg font-semibold text-gray-600 mb-1">{lang === 'fa' ? 'فروشگاه یافت نشد' : 'Shop not found'}</p>
          <p className="text-sm">{lang === 'fa' ? 'این فروشگاه وجود ندارد یا غیرفعال است.' : 'This shop does not exist or is inactive.'}</p>
          <button onClick={() => setView('landing')} className="mt-4 text-sm text-indigo-600 hover:underline">{lang === 'fa' ? 'بازگشت به خانه' : 'Back to home'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" dir={lang === 'fa' ? 'rtl' : 'ltr'}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">

          {/* Logo + Back */}
          <div className="flex items-center gap-3">
            <button onClick={() => setView('landing')} className="flex items-center gap-2">
              <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
                <IconShield className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900 hidden sm:inline">
                {lang === 'fa' ? appConfig.appTitle : appConfig.appTitleEn}
              </span>
            </button>
            {view !== 'landing' && (
              <button
                onClick={() => setView('landing')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 border-s border-gray-200 ps-3 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                {lang === 'fa' ? 'بازگشت' : 'Back'}
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { id: 'new-ticket', label: t.newTicket,                           icon: <IconPlus      className="w-3.5 h-3.5" /> },
              { id: 'tracking',   label: t.tracking,                            icon: <IconSearch    className="w-3.5 h-3.5" /> },
              { id: 'news',       label: lang === 'fa' ? 'اخبار' : 'News',      icon: <IconNewspaper className="w-3.5 h-3.5" /> },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => item.id === 'new-ticket' ? goToRequest() : setView(item.id as ViewState)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
                  ${view === item.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            {/* تماس با ما — opens the Contact Us tab in the tracking view */}
            <button
              onClick={() => { setContactTick(c => c + 1); setView('tracking'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            >
              <IconMessageSquare className="w-3.5 h-3.5" />
              {lang === 'fa' ? 'تماس با ما' : 'Contact Us'}
            </button>
          </nav>

          {/* Right side: search + lang toggle + staff login icon */}
          <div className="flex items-center gap-2">
            <GlobalSearch
              news={news}
              services={services}
              shops={metaShops}
              lang={lang}
              onOpenNews={(id) => setView('news', id)}
              onOpenService={(id) => openFormWithService(id)}
              onOpenShop={(slug) => { history.pushState(null, '', `?shop=${encodeURIComponent(slug)}`); setShopSlug(slug); setViewState('metashop'); window.scrollTo(0, 0); }}
            />
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs">
              <button onClick={() => setLang('fa')} className={`px-2.5 py-1 font-semibold transition-colors ${lang === 'fa' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>FA</button>
              <button onClick={() => setLang('en')} className={`px-2.5 py-1 font-semibold transition-colors ${lang === 'en' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>EN</button>
            </div>
            <button
              onClick={() => setView('admin')}
              title={t.expertPanel}
              className={`p-1.5 rounded-lg transition-colors ${view === 'admin' ? 'text-gray-900 bg-gray-100' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <IconLock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className={`flex-grow w-full max-w-6xl mx-auto px-5 ${view === 'landing' ? 'py-0' : 'py-8'}`}>
        {isLoadingData && view === 'admin' ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
              <span className="text-sm">در حال بارگذاری...</span>
            </div>
          </div>
        ) : (
          <>
            {/* ── Landing ── */}
            {view === 'landing' && (
              <div className="animate-fade-in">

                {/* ── Hero ── */}
                <section className="relative pt-10 pb-12 text-center border-b border-gray-100 overflow-hidden">
                  {appConfig.heroBgImage && (
                    <div className="absolute inset-0 pointer-events-none" style={{zIndex: 0}} aria-hidden="true">
                      <img src={appConfig.heroBgImage} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-white/75" />
                    </div>
                  )}
                  <div className="relative" style={{zIndex: 1}}>
                  <span className="inline-flex items-center gap-1.5 border border-gray-200 text-[11px] text-gray-500 px-3 py-1 rounded-full mb-5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
                    {lang === 'fa' ? 'پلتفرم رسمی خدمات صادراتی توحید دیهمی' : 'Tohid Dayhami Official Export Platform'}
                  </span>
                  <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-4 tracking-tight">
                    {lang === 'fa'
                      ? (appConfig.landingHeroTitle || 'مسیر جهانی شدن کسب‌وکار شما')
                      : 'Your Path to Global Business'}
                  </h1>
                  <p className="text-sm md:text-base text-gray-500 max-w-md mx-auto mb-7 leading-relaxed">
                    {lang === 'fa' ? (appConfig.landingHeroSubtitle || t.landingSubtitle) : t.landingSubtitle}
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={goToRequest}
                      className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black transition-colors"
                    >
                      {t.startBtn}
                    </button>
                    <button
                      onClick={() => setView('tracking')}
                      className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      {t.trackBtn}
                    </button>
                  </div>
                  </div>{/* end z-index wrapper */}
                </section>

                {/* ── Services ── */}
                <section className="py-8 border-b border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                    {lang === 'fa' ? 'خدمات تخصصی ما' : 'Our Services'}
                  </p>
                  {/* skeleton while loading */}
                  {!isServicesLoaded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {[1,2,3,4,5,6].map(n => (
                        <div key={n} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex items-center gap-3 animate-pulse">
                          <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0"/>
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-gray-200 rounded w-3/4"/>
                            <div className="h-2.5 bg-gray-100 rounded w-1/2"/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 ${!isServicesLoaded ? 'hidden' : ''}`}>
                    {services.filter(s => s.isActive).map((service, i) => {
                      const title    = lang === 'en' && service.titleEn ? service.titleEn : service.title;
                      const desc     = lang === 'en' && service.descriptionEn ? service.descriptionEn : service.description;
                      const isOpen   = expandedServiceId === service.id;
                      const t        = (service.title + ' ' + (service.titleEn||'')).toLowerCase();
                      const SvcIcon  =
                        service.id === 's_other'                                          ? IconMessageSquare :
                        t.includes('بسته‌بندی')||t.includes('packaging')                 ? IconLayout        :
                        t.includes('گرافیک')||t.includes('graphic')||t.includes('طراحی') ? IconMagic         :
                        t.includes('صادرات')||t.includes('export')                       ? IconTrendingUp    :
                        t.includes('فروش')||t.includes('sales')                          ? IconTarget        :
                        t.includes('مشاوره')||t.includes('consul')||t.includes('expert') ? IconBulb          :
                        t.includes('نرم‌افزار')||t.includes('software')                  ? IconDatabase      :
                        t.includes('ثبت')||t.includes('شرکت')||t.includes('register')    ? IconFileText      :
                        t.includes('بازخورد')||t.includes('feedback')                    ? IconMessageSquare :
                        t.includes('متاپورت')||t.includes('metaport')                    ? IconPort          :
                        t.includes('برند')||t.includes('brand')                          ? IconAward         :
                        t.includes('تبلیغ')||t.includes('market')                        ? IconMegaphone     :
                        t.includes('وب')||t.includes('web')||t.includes('سایت')          ? IconGlobe         :
                        t.includes('پروژه')||t.includes('project')                       ? IconFolder        :
                        t.includes('ابر')||t.includes('cloud')                           ? IconCloud         :
                        IconBriefcase;

                      return (
                        <div key={service.id}
                          className={`rounded-xl border transition-all duration-200 overflow-hidden
                            ${isOpen ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-gray-50 hover:border-gray-300 hover:bg-white'}`}>

                          {/* ── header row — always visible, click to toggle ── */}
                          <button
                            type="button"
                            onClick={() => setExpandedServiceId(isOpen ? null : service.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-start"
                          >
                            {/* SVG icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                              ${isOpen ? 'bg-white/10' : 'bg-white border border-gray-100'}`}>
                              <SvcIcon className={`w-4 h-4 ${isOpen ? 'text-white' : 'text-gray-500'}`} />
                            </div>
                            {/* title */}
                            <span className={`flex-1 text-sm font-medium leading-snug
                              ${isOpen ? 'text-white' : 'text-gray-800'}`}>
                              {title}
                            </span>
                            {/* chevron */}
                            <span className={`text-xs transition-transform duration-200 shrink-0
                              ${isOpen ? 'text-gray-400 rotate-180' : 'text-gray-300'}`}>▼</span>
                          </button>

                          {/* ── expandable body ── */}
                          {isOpen && (
                            <div className="px-4 pb-4 animate-fade-in">
                              {desc && (
                                <p className="text-xs text-gray-300 leading-relaxed border-t border-white/10 pt-3 mb-4">
                                  {desc}
                                </p>
                              )}
                              <button
                                onClick={() => openFormWithService(service.id)}
                                className="w-full py-2.5 px-4 rounded-lg bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors"
                              >
                                {lang === 'fa' ? 'ثبت درخواست' : 'Request Service'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* ── Stats ── */}
                <section className="py-8 border-b border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[
                      { num: lang === 'fa' ? '+۷۰۰' : '700+', label: lang === 'fa' ? 'مشتری موفق' : 'Clients' },
                      { num: lang === 'fa' ? '+۳۰'  : '30+',  label: lang === 'fa' ? 'کشور هدف' : 'Countries' },
                      { num: lang === 'fa' ? '+۱۲'  : '12+',  label: lang === 'fa' ? 'سال تجربه' : 'Years' },
                      { num: lang === 'fa' ? '۲۴/۷' : '24/7', label: lang === 'fa' ? 'پشتیبانی آنلاین' : 'Support' },
                    ].map((s, i) => (
                      <div key={i}>
                        <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-0.5">{s.num}</div>
                        <div className="text-xs text-gray-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── How it works ── */}
                <section className="py-8 border-b border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
                    {lang === 'fa' ? 'نحوه دریافت خدمات' : 'How It Works'}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {t.features.map((f, i) => (
                      <div key={i} className="flex gap-3 p-4 rounded-xl border border-gray-100">
                        <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-white text-[10px] font-bold">{i + 1}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{f.title}</h3>
                          <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Daily Tip ── */}
                {appConfig.showDailyTips && appConfig.dailyTips && appConfig.dailyTips.length > 0 && (
                  <section className="py-6 border-b border-gray-100">
                    <div className="flex gap-3 items-start">
                      <IconBulb className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                          {lang === 'fa' ? 'نکته صادراتی روز' : 'Export Tip'}
                        </p>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {appConfig.dailyTips[Math.floor(Math.random() * appConfig.dailyTips.length)]}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* ── CTA ── */}
                <section className="py-8">
                  <div className="bg-gray-900 rounded-2xl p-8 md:p-10 text-center">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                      {lang === 'fa' ? 'شروع همکاری' : 'Get Started'}
                    </p>
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      {lang === 'fa' ? 'آماده ورود به بازارهای جهانی هستید؟' : 'Ready to go global?'}
                    </h2>
                    <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
                      {lang === 'fa'
                        ? 'درخواست خود را ثبت کنید، کارشناسان ما در اسرع وقت با شما تماس می‌گیرند.'
                        : 'Submit your request and our experts will reach out promptly.'}
                    </p>
                    <button
                      onClick={goToRequest}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                    >
                      {t.startBtn}
                    </button>
                  </div>

                  {/* Social links — directly below CTA box */}
                  {(() => {
                    const active = (appConfig.socialLinks || [])
                      .filter(l => l.isActive && l.url)
                      .sort((a, b) => a.order - b.order);
                    if (active.length === 0) return null;
                    const icons: Record<string, React.ReactNode> = {
                      instagram: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
                      linkedin:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
                      whatsapp:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
                      facebook:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
                      telegram:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="m22 2-7 20-4-9-9-4 20-7z"/><path d="M22 2 11 13"/></svg>,
                      twitter:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M4 4l16 16M4 20 20 4"/><path d="M4 4h4l12 16h-4"/></svg>,
                    };
                    return (
                      <div className="flex items-center justify-center gap-5 pt-6">
                        {active.map(link => (
                          <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-700 transition-colors duration-200"
                            aria-label={link.platform}>
                            {icons[link.platform]}
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                </section>

                {appConfig.featuredBusinesses && appConfig.featuredBusinesses.length > 0 && (
                  <FeaturedBusinesses businesses={appConfig.featuredBusinesses} lang={lang} />
                )}
              </div>
            )}

            {view === 'new-ticket' && (
              <CustomerForm
                config={appConfig}
                services={services.filter(s => s.isActive)}
                onSubmit={handleNewTicket}
                onCancel={() => { setPreSelectedServiceId(null); setView('landing'); }}
                onGoToTracking={() => setView('tracking')}
                initialServiceId={preSelectedServiceId ?? undefined}
                lang={lang}
              />
            )}

            {view === 'tracking' && (
              <TrackingView tickets={tickets} services={services} config={appConfig} lang={lang} onCustomerUpload={handleCustomerUploadSubmit} onContactSubmit={handleContactSubmit} lookupContactMessages={lookupContactMessages} lookupContactByCode={lookupContactByCode} lookupShopOrder={(code) => lookupMetaShopOrdersByTracking(code.trim().toUpperCase())} openContactTick={contactTick} />
            )}

            {view === 'custom-form' && (
              customFormId
                ? <PublicFormView
                    formId={customFormId}
                    lang={lang}
                    appTitle={lang === 'en' ? appConfig.appTitleEn : appConfig.appTitle}
                    onGoToTracking={() => setView('tracking')}
                    onSubmit={handleNewTicket}
                    trackingBaseUrl={`${window.location.origin}${window.location.pathname}?page=tracking`}
                  />
                : <div className="flex items-center justify-center py-24">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                  </div>
            )}

            {view === 'news' && (
              <NewsPage
                articles={news}
                lang={lang}
                onBack={() => setView('landing')}
                isLoading={isLoadingNews}
                initialArticleId={new URLSearchParams(window.location.search).get('id') || undefined}
              />
            )}

            {view === 'admin' && (
              <>
                {currentCustomerUser ? (
                  <CustomerDashboard
                    customerUser={currentCustomerUser}
                    tickets={tickets.filter(t => currentCustomerUser.ticketIds.includes(t.id))}
                    personnel={personnel}
                    onAddComment={handleCustomerAddComment}
                    onLogout={handleCustomerLogout}
                    lang={lang}
                  />
                ) : !currentUser ? (
                  <LoginView onLogin={handleLogin} onCustomerLogin={handleCustomerLogin} onBack={() => setView('landing')} />
                ) : (
                  <AdminDashboard
                    lang={lang}
                    currentUser={currentUser}
                    tickets={tickets}
                    services={services}
                    personnel={personnel}
                    customers={customers}
                    messages={messages}
                    tasks={tasks}
                    meetings={meetings}
                    kpis={kpis}
                    news={news}
                    analyticsEvents={analyticsEvents}
                    config={appConfig}
                    onCreateTicket={async (t) => handleNewTicket(t)}
                    onUpdateTicket={handleUpdateTicket}
                    onDeleteTicket={handleDeleteTicket}
                    onUpdateServices={handleUpdateServices}
                    onUpdatePersonnel={handleUpdatePersonnel}
                    onUpdateCustomers={handleUpdateCustomers}
                    onEditCustomer={handleEditCustomer}
                    onDeleteCustomer={handleDeleteCustomer}
                    onUpdateConfig={handleUpdateConfig}
                    onLogout={handleLogout}
                    customerAccounts={customerAccounts}
                    onSaveCustomerAccount={async (acc) => { await saveCustomerAccount(acc); }}
                    onDeleteCustomerAccount={async (id) => { await deleteCustomerAccount(id); }}
                    processes={processes}
                    onSaveProcess={async (proc) => { await saveProcess(proc); }}
                    onDeleteProcess={async (id) => { await deleteProcess(id); }}
                    invoices={invoices}
                    onSaveInvoice={async (inv) => { await saveInvoiceToCloud(inv); }}
                    onDeleteInvoice={async (id) => { await deleteInvoiceFromCloud(id); }}
                    metaShops={metaShops}
                    metaShopOrders={metaShopOrders}
                    onSaveMetaShop={async (s) => { await saveMetaShopToCloud(s); }}
                    onDeleteMetaShop={async (id) => { await deleteMetaShopFromCloud(id); }}
                    onUpdateMetaShopOrder={async (id, u) => { await updateMetaShopOrderInCloud(id, u); }}
                    shopBaseUrl={`${window.location.origin}${window.location.pathname}`}
                    metaBazaars={metaBazaars}
                    onSaveMetaBazaar={async (b) => { await saveMetaBazaarToCloud(b); }}
                    onDeleteMetaBazaar={async (id) => { await deleteMetaBazaarFromCloud(id); }}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-4 text-center">
        <p className="text-[11px] text-gray-400">{appConfig.footerText || t.footer}</p>
      </footer>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 flex justify-around py-2 z-50">
        {[
          { id: 'new-ticket', icon: <IconPlus className="w-5 h-5" />,      label: t.newTicket },
          { id: 'tracking',   icon: <IconSearch className="w-5 h-5" />,     label: t.tracking },
          { id: 'news',       icon: <IconNewspaper className="w-5 h-5" />,  label: lang === 'fa' ? 'اخبار' : 'News' },
          { id: 'admin',      icon: <IconLock className="w-5 h-5" />,       label: t.expertPanel },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id as ViewState)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 ${view === item.id ? 'text-gray-900' : 'text-gray-400'}`}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => { setContactTick(c => c + 1); setView('tracking'); }}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-400"
        >
          <IconMessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium">{lang === 'fa' ? 'تماس با ما' : 'Contact'}</span>
        </button>
      </div>
    </div>
  );
};

export default App;
